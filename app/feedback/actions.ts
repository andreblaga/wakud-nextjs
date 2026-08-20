"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  feedbackCommentSchema,
  feedbackSchema,
  feedbackTriageSchema,
} from "@/lib/schemas";
import { validateTriage } from "@/lib/feedback";
import { logAudit } from "@/lib/audit";
import {
  requireSignedIn,
  requireWriter,
  zodErrors,
  type FormState,
} from "@/lib/form-actions";
import { FEEDBACK_TRIAGE_DOMAIN } from "@/lib/feedback";
import type { FeedbackCommentRow } from "./types";

/**
 * Raise a feedback item.
 *
 * requireSignedIn(), never requireWriter(): an executive_viewer holds no write
 * domains but must be able to use the suggestion box. submitted_by is stamped
 * from the session here and is never read from the form — the RLS policy also
 * insists on `submitted_by = auth.uid()`, so a forged value would be rejected
 * by the database as well.
 */
export async function createFeedback(_prev: FormState, formData: FormData): Promise<FormState> {
  const gate = await requireSignedIn();
  if ("error" in gate) return gate.error;
  const { writer } = gate;

  const parsed = feedbackSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, errors: zodErrors(parsed.error) };

  const row = {
    title: parsed.data.title,
    description: parsed.data.description ?? null,
    category: parsed.data.category ?? null,
    submitted_by: writer.userId,
  };

  const { data, error } = await writer.supabase
    .from("feedback")
    .insert(row as never)
    .select("id")
    .single();
  if (error) return { ok: false, formError: error.message };

  const id = (data as { id: string } | null)?.id ?? null;
  await logAudit(writer.supabase, {
    userId: writer.userId,
    action: "create",
    entityType: "feedback",
    entityId: id,
    newValue: row,
  });

  revalidatePath("/feedback");
  // Straight to the item, so the submitter can see it landed and follow the reply.
  redirect(id ? `/feedback/${id}` : "/feedback");
}

/**
 * Post a comment on a feedback item.
 *
 * Returns the inserted row rather than a bare FormState: the thread appends it
 * immediately, so a comment shows up even where Realtime cannot connect. The
 * Realtime copy of the same insert is de-duplicated by id on arrival.
 */
export async function addFeedbackComment(
  feedbackId: string,
  body: string,
): Promise<{ ok: true; comment: FeedbackCommentRow } | { ok: false; error: string }> {
  const gate = await requireSignedIn();
  if ("error" in gate) return { ok: false, error: gate.error.formError ?? "You must be signed in." };
  const { writer } = gate;

  const parsed = feedbackCommentSchema.safeParse({ body });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "That comment isn't valid." };
  }
  if (!feedbackId) return { ok: false, error: "Missing feedback item." };

  const { data, error } = await writer.supabase
    .from("feedback_comments")
    .insert({
      feedback_id: feedbackId,
      body: parsed.data.body,
      author_id: writer.userId,
    } as never)
    .select("id, feedback_id, body, author_id, created_at")
    .single();

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/feedback/${feedbackId}`);
  return { ok: true, comment: data as FeedbackCommentRow };
}

/**
 * Set a feedback item's status and resolution. Admin/gm only.
 *
 * The "declined needs a reason" rule is applied here through validateTriage(),
 * not only in the form: server actions are reachable by direct POST, and a
 * request that vanishes without explanation is how people stop submitting.
 */
export async function triageFeedback(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const gate = await requireWriter(FEEDBACK_TRIAGE_DOMAIN);
  if ("error" in gate) return gate.error;
  const { writer } = gate;

  const parsed = feedbackTriageSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, errors: zodErrors(parsed.error) };

  const checked = validateTriage(parsed.data);
  if (!checked.ok) return { ok: false, errors: { [checked.field]: checked.message } };

  const { data: existing } = await writer.supabase
    .from("feedback")
    .select("id, status, resolution")
    .eq("id", id)
    .maybeSingle();
  if (!existing) return { ok: false, formError: "That feedback item no longer exists." };

  const row = {
    status: checked.status,
    resolution: checked.resolution,
    updated_at: new Date().toISOString(),
  };
  const { error } = await writer.supabase.from("feedback").update(row as never).eq("id", id);
  if (error) return { ok: false, formError: error.message };

  await logAudit(writer.supabase, {
    userId: writer.userId,
    action: "update",
    entityType: "feedback",
    entityId: id,
    oldValue: existing,
    newValue: row,
  });

  revalidatePath(`/feedback/${id}`);
  revalidatePath("/feedback");
  return { ok: true, message: "Status updated." };
}

/**
 * Turn an accepted request into a to-do item, seeded from its title and
 * description, and link the two. Admin/gm only, same gate as the rest of triage.
 *
 * The link is stored on feedback.task_id and rendered from both ends, so the
 * request and the work stay connected once the conversation has moved on.
 */
export async function createTaskFromFeedback(
  id: string,
  _prev: FormState,
  _formData: FormData,
): Promise<FormState> {
  const gate = await requireWriter(FEEDBACK_TRIAGE_DOMAIN);
  if ("error" in gate) return gate.error;
  const { writer } = gate;

  const { data: existing } = await writer.supabase
    .from("feedback")
    .select("id, title, description, task_id")
    .eq("id", id)
    .maybeSingle();
  if (!existing) return { ok: false, formError: "That feedback item no longer exists." };

  const feedback = existing as {
    id: string;
    title: string;
    description: string | null;
    task_id: string | null;
  };
  if (feedback.task_id) {
    return { ok: false, formError: "This already has a task — see the link above." };
  }

  const taskRow = {
    title: feedback.title,
    description: feedback.description,
    status: "todo",
    priority: "medium",
    created_by: writer.userId,
  };
  const { data: created, error: taskError } = await writer.supabase
    .from("tasks")
    .insert(taskRow as never)
    .select("id")
    .single();
  if (taskError) return { ok: false, formError: taskError.message };

  const taskId = (created as { id: string } | null)?.id ?? null;
  if (!taskId) return { ok: false, formError: "The task was created but returned no id." };

  const { error: linkError } = await writer.supabase
    .from("feedback")
    .update({ task_id: taskId, updated_at: new Date().toISOString() } as never)
    .eq("id", id);
  // The task exists either way; say so rather than pretending nothing happened.
  if (linkError) {
    return {
      ok: false,
      formError: `The task was created but could not be linked: ${linkError.message}`,
    };
  }

  await logAudit(writer.supabase, {
    userId: writer.userId,
    action: "create",
    entityType: "task",
    entityId: taskId,
    newValue: { ...taskRow, from_feedback: id },
  });
  await logAudit(writer.supabase, {
    userId: writer.userId,
    action: "update",
    entityType: "feedback",
    entityId: id,
    oldValue: { task_id: null },
    newValue: { task_id: taskId },
  });

  revalidatePath(`/feedback/${id}`);
  revalidatePath("/feedback");
  revalidatePath("/tasks");
  return { ok: true, message: "Task created." };
}
