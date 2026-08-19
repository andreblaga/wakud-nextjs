"use client";

// eslint-disable-next-line import/no-unresolved
import { useFormState } from "react-dom";
import { Card } from "@/components/ui";
import { TextInput, NumberInput, SelectInput, FormError, FormActions } from "@/components/form";
import { STOCK_UNIT_OPTIONS, DEFAULT_STOCK_UNIT } from "@/lib/units";
import { INITIAL_FORM_STATE, type FormState } from "@/lib/form-state";

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

export type StockDefaults = Partial<{
  product: string;
  month: string;
  opening_stock: number;
  produced: number;
  purchased: number;
  delivered: number;
  safety_stock_level: number;
  unit: string;
}>;

const toMonth = (v?: string) => (v ? v.slice(0, 7) : undefined);

export default function StockForm({
  action,
  defaults = {},
  submitLabel,
}: {
  action: Action;
  defaults?: StockDefaults;
  submitLabel?: string;
}) {
  const [state, formAction] = useFormState(action, INITIAL_FORM_STATE);
  const err = state.errors ?? {};

  return (
    <form action={formAction} className="mx-auto max-w-2xl">
      <Card className="space-y-4 p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextInput name="product" label="Product" required defaultValue={defaults.product} placeholder="UCO / B100" error={err.product} />
          <TextInput name="month" type="month" label="Month" required defaultValue={toMonth(defaults.month)} error={err.month} />
          <SelectInput
            name="unit"
            label="Unit"
            required
            options={STOCK_UNIT_OPTIONS}
            defaultValue={defaults.unit ?? DEFAULT_STOCK_UNIT}
            hint="Applies to every figure below"
            error={err.unit}
          />
          <NumberInput name="opening_stock" label="Opening" required defaultValue={defaults.opening_stock} error={err.opening_stock} />
          <NumberInput name="produced" label="Produced" defaultValue={defaults.produced} error={err.produced} />
          <NumberInput name="purchased" label="Purchased" defaultValue={defaults.purchased} error={err.purchased} />
          <NumberInput name="delivered" label="Out / delivered" defaultValue={defaults.delivered} error={err.delivered} />
          <NumberInput name="safety_stock_level" label="Safety level" defaultValue={defaults.safety_stock_level} hint="Default 20" error={err.safety_stock_level} />
        </div>
        <p className="text-[11px] text-slate-400">
          Closing stock and the below-safety flag are computed on save
          (opening + produced + purchased − out).
        </p>
        <FormError message={state.formError} />
        <FormActions cancelHref="/inventory" submitLabel={submitLabel} />
      </Card>
    </form>
  );
}
