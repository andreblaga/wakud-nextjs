"use client";

import { useState } from "react";
// eslint-disable-next-line import/no-unresolved
import { useFormState } from "react-dom";
import { Card } from "@/components/ui";
import { TextInput, NumberInput, SelectInput, TextArea, FormError, FormActions } from "@/components/form";
import { INITIAL_FORM_STATE, type FormState } from "@/lib/form-state";
import { formatOMR, usdToOmr } from "@/lib/currency";

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

export type InvoiceDefaults = Partial<{
  invoice_number: string;
  deal_id: string;
  buyer: string;
  amount_usd: number;
  issue_date: string;
  due_date: string;
  paid_date: string;
  status: string;
  payment_method: string;
  notes: string;
}>;

const STATUSES = ["draft", "sent", "paid", "overdue", "cancelled"].map((s) => ({ value: s, label: s }));

export default function InvoiceForm({
  action,
  defaults = {},
  submitLabel,
}: {
  action: Action;
  defaults?: InvoiceDefaults;
  submitLabel?: string;
}) {
  const [state, formAction] = useFormState(action, INITIAL_FORM_STATE);
  const [omr, setOmr] = useState(() => usdToOmr(defaults.amount_usd ?? 0));
  const err = state.errors ?? {};

  return (
    <form
      action={formAction}
      onInput={(e) => setOmr(usdToOmr(Number(new FormData(e.currentTarget).get("amount_usd")) || 0))}
      className="mx-auto max-w-2xl"
    >
      <Card className="space-y-4 p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextInput name="invoice_number" label="Invoice #" required defaultValue={defaults.invoice_number} error={err.invoice_number} />
          <TextInput name="buyer" label="Buyer" required defaultValue={defaults.buyer} error={err.buyer} />
          <NumberInput
            name="amount_usd"
            label="Amount (USD)"
            required
            defaultValue={defaults.amount_usd}
            error={err.amount_usd}
            hint={`≈ ${formatOMR(omr)} at the fixed peg`}
          />
          <TextInput name="deal_id" label="Deal ID (optional)" defaultValue={defaults.deal_id} error={err.deal_id} />
          <TextInput name="issue_date" type="date" label="Issue date" required defaultValue={defaults.issue_date} error={err.issue_date} />
          <TextInput name="due_date" type="date" label="Due date" required defaultValue={defaults.due_date} error={err.due_date} />
          <TextInput name="paid_date" type="date" label="Paid date" defaultValue={defaults.paid_date} error={err.paid_date} />
          <SelectInput name="status" label="Status" required options={STATUSES} defaultValue={defaults.status ?? "draft"} error={err.status} />
          <TextInput name="payment_method" label="Payment method" defaultValue={defaults.payment_method} error={err.payment_method} />
        </div>
        <TextArea name="notes" label="Notes" defaultValue={defaults.notes} error={err.notes} />
        <FormError message={state.formError} />
        <FormActions cancelHref="/finance" submitLabel={submitLabel} />
      </Card>
    </form>
  );
}
