import { redirect } from "next/navigation";
import { ListChecks } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { getSessionUser } from "@/lib/auth";
import { canWrite } from "@/lib/permissions";
import TaskForm from "../TaskForm";
import { createTask } from "../actions";

export default async function NewTaskPage() {
  const user = await getSessionUser();
  if (!canWrite(user?.role, "tasks")) redirect("/tasks");

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="New task" description="Add to the team to-do" icon={ListChecks} />
      <TaskForm action={createTask} submitLabel="Create task" />
    </div>
  );
}
