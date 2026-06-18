"use client";

// eslint-disable-next-line import/no-unresolved
import { useFormState } from "react-dom";
import { Card } from "@/components/ui";
import { TextInput, NumberInput, SelectInput, CheckboxInput, TextArea, FormError, FormActions } from "@/components/form";
import { INITIAL_FORM_STATE, type FormState } from "@/lib/form-state";

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

export type OrderDefaults = Partial<{
  material: string;
  supplier: string;
  quantity_kg: number;
  unit_price: number;
  lead_time_days: number;
  order_date: string;
  required_by: string;
  expected_delivery: string;
  actual_delivery: string;
  status: string;
  linked_month: string;
  auto_generated: boolean;
  notes: string;
}>;

const STATUSES = ["pending", "ordered", "delivered", "cancelled"].map((s) => ({ value: s, label: s }));
const toMonth = (v?: string) => (v ? v.slice(0, 7) : undefined);

export default function OrderForm({
  action,
  defaults = {},
  submitLabel,
}: {
  action: Action;
  defaults?: OrderDefaults;
  submitLabel?: string;
}) {
  const [state, formAction] = useFormState(action, INITIAL_FORM_STATE);
  const err = state.errors ?? {};

  return (
    <form action={formAction} className="mx-auto max-w-2xl">
      <Card className="space-y-4 p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextInput name="material" label="Material" required defaultValue={defaults.material} placeholder="UCO / Methanol" error={err.material} />
          <TextInput name="supplier" label="Supplier" defaultValue={defaults.supplier} error={err.supplier} />
          <NumberInput name="quantity_kg" label="Quantity (kg)" required defaultValue={defaults.quantity_kg} error={err.quantity_kg} />
          <NumberInput name="unit_price" label="Unit price" defaultValue={defaults.unit_price} error={err.unit_price} />
          <NumberInput name="lead_time_days" label="Lead time (days)" required step="1" defaultValue={defaults.lead_time_days} error={err.lead_time_days} />
          <SelectInput name="status" label="Status" options={STATUSES} defaultValue={defaults.status ?? "pending"} error={err.status} />
          <TextInput name="order_date" type="date" label="Order date" defaultValue={defaults.order_date} error={err.order_date} />
          <TextInput name="required_by" type="date" label="Required by" required defaultValue={defaults.required_by} error={err.required_by} />
          <TextInput name="expected_delivery" type="date" label="Expected delivery" defaultValue={defaults.expected_delivery} error={err.expected_delivery} />
          <TextInput name="actual_delivery" type="date" label="Actual delivery" defaultValue={defaults.actual_delivery} error={err.actual_delivery} />
          <TextInput name="linked_month" type="month" label="Linked month" required defaultValue={toMonth(defaults.linked_month)} error={err.linked_month} />
        </div>
        <CheckboxInput name="auto_generated" label="Auto-generated" defaultChecked={defaults.auto_generated ?? false} hint="(reorder system)" />
        <TextArea name="notes" label="Notes" defaultValue={defaults.notes} error={err.notes} />
        <FormError message={state.formError} />
        <FormActions cancelHref="/inventory" submitLabel={submitLabel} />
      </Card>
    </form>
  );
}
