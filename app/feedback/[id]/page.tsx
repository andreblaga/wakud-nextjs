import Link from "next/link";
import { notFound } from "next/navigation";
import { Lightbulb, ListChecks } from "lucide-react";
import {
  BackLink,
  Card,
  DetailField,
  DetailSection,
  PageHeader,
  StatusBadge,
} from "@/components/ui";
import { ErrorState } from "@/components/DataTable";
import { RoleGate } from "@/components/RoleGate";
import ArchiveButton from "@/components/ArchiveButton";
import { ArchivedNotice } from "@/components/ArchivedNotice";
import AuditTrail from "@/components/AuditTrail";
import { toggleArchive } from "@/app/archive/actions";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth";
import { getUserDirectory } from "@/lib/user-directory";
import { CATEGORY_LABELS, FEEDBACK_TRIAGE_DOMAIN } from "@/lib/feedback";
import { formatDate, timeOfDay } from "@/lib/dates";
import FeedbackThread from "../FeedbackThread";
import TriagePanel from "../TriagePanel";
import { triageFeedback, createTaskFromFeedback } from "../actions";
import type { FeedbackCommentRow, FeedbackRow } from "../types";

/**
 * One feedback item and its thread.
 *
 * Readable and repliable by every signed-in user, executive_viewer included —
 * feedback is not business data. Only triage (status, resolution, converting to
 * a task, archiving) sits behind RoleGate, and each of those actions re-checks
 * the role server-side.
 */
export default async function FeedbackDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  if (!supabase) {
    return (
      <div className="mx-auto max-w-5xl">
        <ErrorState message="Supabase isn't configured." />
      </div>
    );
  }

  const { data } = await supabase
    .from("feedback")
    .select(
      "id, title, description, status, category, resolution, submitted_by, task_id, created_at, updated_at, archived_at",
    )
    .eq("id", params.id)
    .maybeSingle();

  if (!data) notFound();
  const item = data as FeedbackRow;

  const [{ data: commentData }, user] = await Promise.all([
    supabase
      .from("feedback_comments")
      .select("id, feedback_id, body, author_id, created_at")
      .eq("feedback_id", item.id)
      .order("created_at", { ascending: true }),
    getSessionUser(),
  ]);

  const comments = (commentData ?? []) as FeedbackCommentRow[];
  const directory = await getUserDirectory(user?.id);

  // Names resolved once on the server and handed to the thread as a plain map:
  // the browser has no way to read auth.users, and Realtime delivers only an
  // author_id. Anyone who joins the conversation mid-session falls back to a
  // short id until the next load, which is a fair price for not shipping a
  // service-role lookup to the client.
  const names: Record<string, string> = {};
  for (const authorId of Array.from(new Set(comments.map((c) => c.author_id)))) {
    names[authorId] = directory.nameFor(authorId);
  }

  const task = item.task_id
    ? ((
        await supabase.from("tasks").select("id, title, status").eq("id", item.task_id).maybeSingle()
      ).data as { id: string; title: string; status: string } | null)
    : null;

  return (
    <div className="mx-auto max-w-6xl">
      <BackLink href="/feedback" label="Feedback" />
      {item.archived_at && <ArchivedNotice archivedAt={item.archived_at} label="feedback item" />}
      <PageHeader
        title={item.title}
        description={`Raised by ${directory.nameFor(item.submitted_by)} · ${formatDate(item.created_at)} ${timeOfDay(item.created_at)}`}
        icon={Lightbulb}
        action={
          <ArchiveButton
            action={toggleArchive.bind(null, "feedback", item.id, !item.archived_at)}
            domain={FEEDBACK_TRIAGE_DOMAIN}
            archived={!!item.archived_at}
            label="feedback item"
          />
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <DetailSection>
            <DetailField label="Status" value={<StatusBadge status={item.status} />} />
            <DetailField
              label="Category"
              value={item.category ? CATEGORY_LABELS[item.category] : null}
            />
            <DetailField label="Description" value={item.description} full />
            {item.resolution && (
              <DetailField
                label={item.status === "declined" ? "Why this was declined" : "Resolution"}
                value={item.resolution}
                full
              />
            )}
          </DetailSection>

          {task && (
            <Card className="flex items-center gap-3 px-5 py-4">
              <ListChecks className="h-5 w-5 shrink-0 text-brand-700" />
              <div className="min-w-0">
                <p className="text-sm text-slate-700">
                  A to-do item was created from this request.
                </p>
                <Link
                  href="/tasks"
                  className="text-xs font-medium text-brand-700 hover:underline"
                >
                  {task.title} · {task.status.replace(/_/g, " ")}
                </Link>
              </div>
            </Card>
          )}

          <FeedbackThread feedbackId={item.id} initialComments={comments} names={names} />

          <AuditTrail entityType="feedback" entityId={item.id} />
        </div>

        <div className="space-y-4">
          <RoleGate domain={FEEDBACK_TRIAGE_DOMAIN}>
            <TriagePanel
              triageAction={triageFeedback.bind(null, item.id)}
              createTaskAction={createTaskFromFeedback.bind(null, item.id)}
              status={item.status}
              resolution={item.resolution}
              taskId={item.task_id}
            />
          </RoleGate>

          <Card className="p-5 text-xs text-slate-500">
            <p className="font-medium text-slate-700">Who sees this</p>
            <p className="mt-1">
              Everyone signed in can read and reply to every feedback item, whatever their role.
              Setting a status or turning a request into work is limited to admin and GM.
            </p>
          </Card>

          <p className="text-xs text-slate-400">
            Last updated {formatDate(item.updated_at)} {timeOfDay(item.updated_at)}
          </p>
        </div>
      </div>
    </div>
  );
}
