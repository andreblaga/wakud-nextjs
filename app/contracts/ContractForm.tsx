"use client";

// eslint-disable-next-line import/no-unresolved
import { useFormState } from "react-dom";
import { Card } from "@/components/ui";
import { TextInput, NumberInput, SelectInput, CheckboxInput, FormError, FormActions } from "@/components/form";
import { INITIAL_FORM_STATE, type FormState } from "@/lib/form-state";

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

export type ContractDefaults = Partial<{
  name: string;
  buyer: string;
  price_per_tonne: number;
  is_active: boolean;
  status: string;
  start_date: string;
  end_date: string;
  renewal_date: string;
  payment_terms: string;
  incoterm: string;
  auto_renew: boolean;
  termination_notice_days: number;
}>;

const STATUSES = ["active", "pending", "expired", "terminated"].map((s) => ({ value: s, label: s }));

export default function ContractForm({
  action,
  defaults = {},
  submitLabel,
}: {
  action: Action;
  defaults?: ContractDefaults;
  submitLabel?: string;
}) {
  const [state, formAction] = useFormState(action, INITIAL_FORM_STATE);
  const err = state.errors ?? {};

  return (
    <form action={formAction} className="mx-auto max-w-2xl">
      <Card className="space-y-4 p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextInput name="name" label="Name" required defaultValue={defaults.name} error={err.name} />
          <TextInput name="buyer" label="Buyer" required defaultValue={defaults.buyer} error={err.buyer} />
          <NumberInput name="price_per_tonne" label="Price /t" required defaultValue={defaults.price_per_tonne} error={err.price_per_tonne} />
          <SelectInput name="status" label="Status" required options={STATUSES} defaultValue={defaults.status ?? "active"} error={err.status} />
          <TextInput name="start_date" type="date" label="Start date" defaultValue={defaults.start_date} error={err.start_date} />
          <TextInput name="end_date" type="date" label="End date" defaultValue={defaults.end_date} error={err.end_date} />
          <TextInput name="renewal_date" type="date" label="Renewal date" defaultValue={defaults.renewal_date} error={err.renewal_date} />
          <TextInput name="payment_terms" label="Payment terms" defaultValue={defaults.payment_terms} placeholder="prepaid" error={err.payment_terms} />
          <TextInput name="incoterm" label="Incoterm" defaultValue={defaults.incoterm} placeholder="FOB" error={err.incoterm} />
          <NumberInput name="termination_notice_days" label="Termination notice (days)" defaultValue={defaults.termination_notice_days} error={err.termination_notice_days} />
        </div>
        <div className="flex flex-wrap gap-6 pt-1">
          <CheckboxInput name="is_active" label="Active" defaultChecked={defaults.is_active ?? true} />
          <CheckboxInput name="auto_renew" label="Auto-renew" defaultChecked={defaults.auto_renew ?? false} />
        </div>
        <FormError message={state.formError} />
        <FormActions cancelHref="/contracts" submitLabel={submitLabel} />
      </Card>
    </form>
  );
}
