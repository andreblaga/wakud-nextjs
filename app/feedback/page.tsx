import { Suspense } from "react";
import Link from "next/link";
import { Lightbulb, MessageSquare, Plus, ListChecks } from "lucide-react";
import { PageHeader, StatCard, StatusBadge } from "@/components/ui";
import { DataTable, EmptyState, ErrorState, TableSkeleton, type Column } from "@/components/DataTable";
import { ShowArchivedToggle } from "@/components/ShowArchivedToggle";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth";
import { getUserDirectory } from "@/lib/user-directory";
import { showArchivedFrom, toggleArchivedHref } from "@/lib/archive";
import { getParam, type SearchParams } from "@/lib/query-params";
import {
  CATEGORY_LABELS,
  STATUS_LABELS,
  isFeedbackCategory,
  isFeedbackStatus,
} from "@/lib/feedback";
import { formatDate } from "@/lib/dates";
import { FeedbackFilters } from "./FeedbackFilters";
import type { FeedbackListRow } from "./types";

/**
 * Feedback index.
 *
 * Everyone signed in sees everything, including executive_viewer — with a team
 * of eight, duplicate requests cost more than the candour risk and one answer
 * serves everybody (decision 2026-08-19, mirrored by the RLS policy).
 *
 * The default view is the open queue: archived items and anything already done
 * are out of the way until asked for, because the list exists to show what is
 * still waiting on somebody.
 */
export default function FeedbackPage({ searchParams }: { searchParams: SearchParams }) {
  const status = getParam(searchParams, "status");
  const category = getParam(searchParams, "category");
  const showArchived = showArchivedFrom(searchParams);

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Feedback"
        description="Ideas, problems and questions from the team — anyone can raise one"
        icon={Lightbulb}
        action={
          <Link
            href="/feedback/new"
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-700 px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-800"
          >
            <Plus className="h-4 w-4" /> New feedback
          </Link>
        }
      />

      <FeedbackFilters
        searchParams={searchParams}
        activeStatus={status}
        activeCategory={category}
      />

      <Suspense
        key={`${status}-${category}-${showArchived}`}
        fallback={<TableSkeleton columns={6} />}
      >
        <FeedbackContent
          status={status}
          category={category}
          showArchived={showArchived}
          toggleHref={toggleArchivedHref("/feedback", searchParams)}
        />
      </Suspense>
    </div>
  );
}

async function FeedbackContent({
  status,
  category,
  showArchived,
  toggleHref,
}: {
  status: string | null;
  category: string | null;
  showArchived: boolean;
  toggleHref: string;
}) {
  const supabase = createClient();
  if (!supabase) return <ErrorState message="Supabase isn't configured." />;

  let request = supabase
    .from("feedback")
    .select("id, title, status, category, submitted_by, created_at, task_id, archived_at");

  if (!showArchived) request = request.is("archived_at", null);
  if (isFeedbackStatus(status)) request = request.eq("status", status);
  // No status filter means the open queue: done items are finished business.
  else request = request.neq("status", "done");
  if (isFeedbackCategory(category)) request = request.eq("category", category);

  const { data, error } = await request.order("created_at", { ascending: false });
  if (error) {
    return <ErrorState message={`${error.message} — has supabase/phase6-feedback.sql been run?`} />;
  }

  const rows = (data ?? []) as Omit<FeedbackListRow, "commentCount">[];

  // Thread sizes in one extra query and counted here, rather than a PostgREST
  // embed: an aggregate embed types poorly and this table is small.
  const { data: commentData } = await supabase.from("feedback_comments").select("feedback_id");
  const counts = new Map<string, number>();
  for (const c of (commentData ?? []) as { feedback_id: string }[]) {
    counts.set(c.feedback_id, (counts.get(c.feedback_id) ?? 0) + 1);
  }

  const user = await getSessionUser();
  const directory = await getUserDirectory(user?.id);
  const items: FeedbackListRow[] = rows.map((r) => ({
    ...r,
    commentCount: counts.get(r.id) ?? 0,
  }));

  const countBy = (s: string) => items.filter((i) => i.status === s && !i.archived_at).length;

  return (
    <>
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Showing" value={String(items.length)} />
        <StatCard label="New" value={String(countBy("new"))} hint="awaiting triage" accent />
        <StatCard label="Reviewing" value={String(countBy("reviewing"))} />
        <StatCard label="Planned" value={String(countBy("planned"))} />
      </div>

      <div className="mb-3 flex justify-end">
        <ShowArchivedToggle href={toggleHref} showArchived={showArchived} />
      </div>

      {items.length > 0 ? (
        <DataTable
          columns={columnsFor(directory.nameFor)}
          rows={items}
          getRowKey={(i) => i.id}
          rowClassName={(i) => (i.archived_at ? "opacity-55" : "")}
        />
      ) : (
        <EmptyState
          title="Nothing here"
          message={
            status || category
              ? "No feedback matches these filters."
              : "No open feedback. Raise the first one — ideas, problems and questions all belong here."
          }
          icon={Lightbulb}
        />
      )}
    </>
  );
}

function columnsFor(nameFor: (id: string | null | undefined) => string): Column<FeedbackListRow>[] {
  return [
    {
      key: "title",
      header: "Feedback",
      render: (i) => (
        <span className="flex items-center gap-2">
          <Link
            href={`/feedback/${i.id}`}
            className="font-medium text-slate-900 hover:text-brand-700 hover:underline"
          >
            {i.title}
          </Link>
          {i.archived_at && <StatusBadge status="archived" />}
        </span>
      ),
    },
    {
      key: "category",
      header: "Category",
      render: (i) => (i.category ? CATEGORY_LABELS[i.category] : null),
    },
    { key: "submitted_by", header: "Raised by", render: (i) => nameFor(i.submitted_by) },
    { key: "created_at", header: "When", render: (i) => formatDate(i.created_at) },
    {
      key: "commentCount",
      header: "Replies",
      align: "right",
      render: (i) =>
        i.commentCount > 0 ? (
          <span className="inline-flex items-center gap-1 text-slate-500">
            <MessageSquare className="h-3.5 w-3.5 text-slate-400" />
            {i.commentCount}
          </span>
        ) : null,
    },
    {
      key: "task_id",
      header: "",
      render: (i) =>
        i.task_id ? (
          <Link
            href="/tasks"
            title="A to-do item was created from this"
            className="inline-flex items-center gap-1 text-[11px] text-brand-700 hover:underline"
          >
            <ListChecks className="h-3.5 w-3.5" /> Task
          </Link>
        ) : null,
    },
    {
      key: "status",
      header: "Status",
      render: (i) => <StatusBadge status={i.status} />,
    },
  ];
}
