"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { taskSchema, type TaskInput } from "@/lib/schemas";
import { logAudit } from "@/lib/audit";
import { requireWriter, zodErrors, type FormState } from "@/lib/form-actions";
import { extraTable } from "@/lib/supabase/extra";
import type { TaskStatus } from "./types";

function toRow(t: TaskInput) {
  return {
    title: t.title,
    description: t.description ?? null,
    status: t.status,
    priority: t.priority,
    assignee: t.assignee ?? null,
    due_date: t.due_date ?? null,
    link_type: t.link_type ?? null,
    link_id: t.link_id ?? null,
  };
}

export async function createTask(_prev: FormState, formData: FormData): Promise<FormState> {
  const gate = await requireWriter("tasks");
  if ("error" in gate) return gate.error;
  const { writer } = gate;

  const parsed = taskSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, errors: zodErrors(parsed.error) };

  const row = { ...toRow(parsed.data), created_by: writer.userId };
  const { data, error } = await extraTable(writer.supabase, "tasks").insert(row).select("id").single();
  if (error) return { ok: false, formError: error.message };

  await logAudit(writer.supabase, {
    userId: writer.userId,
    action: "create",
    entityType: "task",
    entityId: (data as { id: string } | null)?.id ?? null,
    newValue: row,
  });

  revalidatePath("/tasks");
  redirect("/tasks");
}

export async function updateTask(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const gate = await requireWriter("tasks");
  if ("error" in gate) return gate.error;
  const { writer } = gate;

  const parsed = taskSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, errors: zodErrors(parsed.error) };

  const { data: existing } = await extraTable(writer.supabase, "tasks").select("*").eq("id", id).single();
  const row = { ...toRow(parsed.data), updated_at: new Date().toISOString() };
  const { error } = await extraTable(writer.supabase, "tasks").update(row).eq("id", id);
  if (error) return { ok: false, formError: error.message };

  await logAudit(writer.supabase, {
    userId: writer.userId,
    action: "update",
    entityType: "task",
    entityId: id,
    oldValue: existing,
    newValue: row,
  });

  revalidatePath("/tasks");
  redirect("/tasks");
}

/** Board move: change just the status (no redirect — stays on the board). */
export async function moveTask(id: string, status: TaskStatus): Promise<void> {
  const gate = await requireWriter("tasks");
  if ("error" in gate) return;
  const { writer } = gate;

  await extraTable(writer.supabase, "tasks")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);

  await logAudit(writer.supabase, {
    userId: writer.userId,
    action: "update",
    entityType: "task",
    entityId: id,
    newValue: { status },
  });

  revalidatePath("/tasks");
}

export async function deleteTask(id: string): Promise<void> {
  const gate = await requireWriter("tasks");
  if ("error" in gate) return;
  const { writer } = gate;

  await extraTable(writer.supabase, "tasks").delete().eq("id", id);
  await logAudit(writer.supabase, {
    userId: writer.userId,
    action: "delete",
    entityType: "task",
    entityId: id,
  });

  revalidatePath("/tasks");
}
