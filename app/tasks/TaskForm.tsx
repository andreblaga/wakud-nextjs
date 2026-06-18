"use client";

// eslint-disable-next-line import/no-unresolved
import { useFormState } from "react-dom";
import { Card } from "@/components/ui";
import { TextInput, SelectInput, TextArea, FormError, FormActions } from "@/components/form";
import { INITIAL_FORM_STATE, type FormState } from "@/lib/form-state";
import { TASK_STATUSES, TASK_PRIORITIES } from "./types";

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

export type TaskDefaults = Partial<{
  title: string;
  description: string;
  status: string;
  priority: string;
  assignee: string;
  due_date: string;
  link_type: string;
  link_id: string;
}>;

const LINK_TYPES = [
  { value: "deal", label: "Deal" },
  { value: "contract", label: "Contract" },
  { value: "batch", label: "Batch" },
];

export default function TaskForm({
  action,
  defaults = {},
  submitLabel,
}: {
  action: Action;
  defaults?: TaskDefaults;
  submitLabel?: string;
}) {
  const [state, formAction] = useFormState(action, INITIAL_FORM_STATE);
  const err = state.errors ?? {};

  return (
    <form action={formAction} className="mx-auto max-w-2xl">
      <Card className="space-y-4 p-5">
        <TextInput name="title" label="Title" required defaultValue={defaults.title} error={err.title} />
        <TextArea name="description" label="Description" defaultValue={defaults.description} error={err.description} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SelectInput name="status" label="Status" required options={TASK_STATUSES} defaultValue={defaults.status ?? "todo"} error={err.status} />
          <SelectInput name="priority" label="Priority" required options={TASK_PRIORITIES} defaultValue={defaults.priority ?? "medium"} error={err.priority} />
          <TextInput name="assignee" label="Assignee" defaultValue={defaults.assignee} placeholder="name or email" error={err.assignee} />
          <TextInput name="due_date" type="date" label="Due date" defaultValue={defaults.due_date} error={err.due_date} />
          <SelectInput name="link_type" label="Link to (optional)" options={LINK_TYPES} defaultValue={defaults.link_type} error={err.link_type} />
          <TextInput name="link_id" label="Link reference" defaultValue={defaults.link_id} placeholder="e.g. WK-2026-001" error={err.link_id} />
        </div>
        <FormError message={state.formError} />
        <FormActions cancelHref="/tasks" submitLabel={submitLabel} />
      </Card>
    </form>
  );
}
