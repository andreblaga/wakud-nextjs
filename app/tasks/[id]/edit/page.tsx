import { notFound, redirect } from "next/navigation";
import { ListChecks } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth";
import { canWrite } from "@/lib/permissions";
import TaskForm, { type TaskDefaults } from "../../TaskForm";
import { updateTask } from "../../actions";
import type { TaskRow } from "../../types";

export default async function EditTaskPage({ params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!canWrite(user?.role, "tasks")) redirect("/tasks");

  const supabase = createClient();
  if (!supabase) redirect("/tasks");

  const { data } = await supabase.from("tasks").select("*").eq("id", params.id).maybeSingle();
  if (!data) notFound();
  const task = data as TaskRow;
  const defaults: TaskDefaults = {
    title: task.title,
    description: task.description ?? undefined,
    status: task.status,
    priority: task.priority,
    assignee: task.assignee ?? undefined,
    due_date: task.due_date ?? undefined,
    link_type: task.link_type ?? undefined,
    link_id: task.link_id ?? undefined,
  };
  const action = updateTask.bind(null, params.id);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Edit task" description="Update the team to-do" icon={ListChecks} />
      <TaskForm action={action} defaults={defaults} submitLabel="Save changes" />
    </div>
  );
}
