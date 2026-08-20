"use client";

// eslint-disable-next-line import/no-unresolved
import { useFormState } from "react-dom";
import { useState } from "react";
import { ListChecks, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui";
import { SelectInput, TextArea, FormError, SubmitButton } from "@/components/form";
import { INITIAL_FORM_STATE, type FormState } from "@/lib/form-state";
import {
  FEEDBACK_STATUSES,
  STATUS_LABELS,
  resolutionRequiredFor,
  isFeedbackStatus,
  type FeedbackStatus,
} from "@/lib/feedback";

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

const STATUS_OPTIONS = FEEDBACK_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }));

/**
 * Triage controls — status, resolution, and turning a request into work.
 *
 * Rendered only for admin/gm (the caller wraps it in RoleGate). The required
 * resolution is marked here as soon as "declined" is picked, but the rule that
 * actually holds is in the server action: this is a hint, not the gate.
 */
export default function TriagePanel({
  triageAction,
  createTaskAction,
  status,
  resolution,
  taskId,
}: {
  triageAction: Action;
  createTaskAction: Action;
  status: FeedbackStatus;
  resolution: string | null;
  /** Set once a to-do item has been created from this request. */
  taskId: string | null;
}) {
  const [state, formAction] = useFormState(triageAction, INITIAL_FORM_STATE);
  const [taskState, taskFormAction] = useFormState(createTaskAction, INITIAL_FORM_STATE);
  const [picked, setPicked] = useState<FeedbackStatus>(status);
  const err = state.errors ?? {};
  const needsResolution = resolutionRequiredFor(picked);

  return (
    <Card className="space-y-4 p-5">
      <h2 className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
        <ShieldCheck className="h-4 w-4 text-slate-400" /> Triage
      </h2>

      <form action={formAction} className="space-y-4">
        {/*
          The select stays uncontrolled so a failed submission keeps what was
          chosen; this wrapper just listens to the bubbled change so the
          resolution field can label itself required before the server says so.
        */}
        <div
          onChange={(e) => {
            const target = e.target as HTMLSelectElement;
            if (target.name === "status" && isFeedbackStatus(target.value)) setPicked(target.value);
          }}
        >
          <SelectInput
            name="status"
            label="Status"
            required
            options={STATUS_OPTIONS}
            defaultValue={status}
            error={err.status}
          />
        </div>
        <TextArea
          name="resolution"
          label={needsResolution ? "Reason (required)" : "Resolution"}
          rows={3}
          defaultValue={resolution ?? undefined}
          error={err.resolution}
          hint={
            needsResolution
              ? "Declining without a reason is how people stop submitting."
              : "What was decided, or what was done."
          }
        />
        <FormError message={state.formError} />
        {state.ok && state.message && (
          <p className="text-[11px] text-brand-700">{state.message}</p>
        )}
        <SubmitButton pendingLabel="Saving…">Save triage</SubmitButton>
      </form>

      <div className="border-t border-slate-100 pt-4">
        {taskId ? (
          <p className="flex items-center gap-1.5 text-xs text-slate-500">
            <ListChecks className="h-4 w-4 text-slate-400" /> A to-do item was created from this.
          </p>
        ) : (
          <form action={taskFormAction} className="space-y-2">
            <p className="text-xs text-slate-500">
              Accepting this? Create a to-do item seeded from its title and description; the two
              stay linked.
            </p>
            <FormError message={taskState.formError} />
            <SubmitButton
              pendingLabel="Creating…"
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              <ListChecks className="h-4 w-4" /> Create task from this
            </SubmitButton>
          </form>
        )}
      </div>

    </Card>
  );
}
