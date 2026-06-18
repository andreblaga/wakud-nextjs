"use client";

// eslint-disable-next-line import/no-unresolved
import { useFormState } from "react-dom";
import { Card } from "@/components/ui";
import { TextInput, NumberInput, SelectInput, TextArea, FormError, FormActions } from "@/components/form";
import { INITIAL_FORM_STATE, type FormState } from "@/lib/form-state";

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

export type ProductionPlanDefaults = Partial<{
  month: string;
  target_output: number;
  actual_output: number;
  b100_output: number;
  glycerin_output: number;
  uco_consumed: number;
  status: string;
  notes: string;
}>;

const STATUSES = ["planned", "in_progress", "complete"].map((s) => ({ value: s, label: s.replace(/_/g, " ") }));
const toMonth = (v?: string) => (v ? v.slice(0, 7) : undefined);

export default function ProductionPlanForm({
  action,
  defaults = {},
  submitLabel,
}: {
  action: Action;
  defaults?: ProductionPlanDefaults;
  submitLabel?: string;
}) {
  const [state, formAction] = useFormState(action, INITIAL_FORM_STATE);
  const err = state.errors ?? {};

  return (
    <form action={formAction} className="mx-auto max-w-2xl">
      <Card className="space-y-4 p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextInput name="month" type="month" label="Month" required defaultValue={toMonth(defaults.month)} error={err.month} />
          <SelectInput name="status" label="Status" options={STATUSES} defaultValue={defaults.status ?? "planned"} error={err.status} />
          <NumberInput name="target_output" label="Target output (t)" required defaultValue={defaults.target_output} error={err.target_output} />
          <NumberInput name="actual_output" label="Actual output (t)" defaultValue={defaults.actual_output} error={err.actual_output} />
          <NumberInput name="b100_output" label="B100 output (t)" defaultValue={defaults.b100_output} error={err.b100_output} />
          <NumberInput name="glycerin_output" label="Glycerol output (t)" defaultValue={defaults.glycerin_output} error={err.glycerin_output} />
          <NumberInput name="uco_consumed" label="UCO consumed (t)" defaultValue={defaults.uco_consumed} error={err.uco_consumed} />
        </div>
        <TextArea name="notes" label="Notes" defaultValue={defaults.notes} error={err.notes} />
        <FormError message={state.formError} />
        <FormActions cancelHref="/production" submitLabel={submitLabel} />
      </Card>
    </form>
  );
}
