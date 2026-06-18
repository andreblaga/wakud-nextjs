"use client";

import { useState } from "react";
// eslint-disable-next-line import/no-unresolved
import { useFormState } from "react-dom";
import { Info } from "lucide-react";
import { Card } from "@/components/ui";
import { TextInput, NumberInput, SelectInput, TextArea, FormError, FormActions } from "@/components/form";
import { INITIAL_FORM_STATE, type FormState } from "@/lib/form-state";
import { evaluateDeal, ASSUMPTION_NOTES, ASSUMPTIONS_UNCONFIRMED, type DealEconomics } from "@/lib/deal-economics";
import { formatUSD, formatPercent } from "@/lib/currency";

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

export type DealDefaults = Partial<{
  deal_id: string;
  name: string;
  deal_type: string;
  status: string;
  buyer: string;
  input_product: string;
  output_product: string;
  producer: string;
  disport: string;
  tonnes: number;
  buy_price_per_tonne: number;
  sell_price_per_tonne: number;
  shipping_per_tonne: number;
  trucking_per_tonne: number;
  payment_type: string;
  start_month: string;
  end_month: string;
  notes: string;
}>;

const DEAL_TYPES = [
  { value: "production", label: "Production" },
  { value: "arbitrage", label: "Arbitrage" },
];
const STATUSES = ["draft", "approved", "confirmed", "in_transit", "delivered", "paid"].map((s) => ({
  value: s,
  label: s.replace(/_/g, " "),
}));

/** "YYYY-MM-DD" or "YYYY-MM" → "YYYY-MM" for <input type="month">. */
const toMonth = (v?: string) => (v ? v.slice(0, 7) : undefined);

function previewFrom(form: HTMLFormElement): DealEconomics {
  const fd = new FormData(form);
  const n = (k: string) => Number(fd.get(k)) || 0;
  return evaluateDeal({
    tonnes: n("tonnes"),
    buy_price_per_tonne: n("buy_price_per_tonne"),
    sell_price_per_tonne: n("sell_price_per_tonne"),
    shipping_per_tonne: n("shipping_per_tonne"),
    trucking_per_tonne: n("trucking_per_tonne"),
    payment_type: String(fd.get("payment_type") ?? ""),
  });
}

export default function DealForm({
  action,
  defaults = {},
  submitLabel,
}: {
  action: Action;
  defaults?: DealDefaults;
  submitLabel?: string;
}) {
  const [state, formAction] = useFormState(action, INITIAL_FORM_STATE);
  const [econ, setEcon] = useState<DealEconomics>(() =>
    evaluateDeal({
      tonnes: defaults.tonnes ?? 0,
      buy_price_per_tonne: defaults.buy_price_per_tonne ?? 0,
      sell_price_per_tonne: defaults.sell_price_per_tonne ?? 0,
      shipping_per_tonne: defaults.shipping_per_tonne ?? 0,
      trucking_per_tonne: defaults.trucking_per_tonne ?? 0,
      payment_type: defaults.payment_type ?? "",
    }),
  );
  const err = state.errors ?? {};

  return (
    <form
      action={formAction}
      onInput={(e) => setEcon(previewFrom(e.currentTarget))}
      className="grid grid-cols-1 gap-6 lg:grid-cols-3"
    >
      <div className="space-y-4 lg:col-span-2">
        <Card className="space-y-4 p-5">
          <h2 className="text-sm font-semibold text-slate-700">Deal details</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextInput name="deal_id" label="Deal ID" required defaultValue={defaults.deal_id} error={err.deal_id} placeholder="WK-2026-001" />
            <TextInput name="name" label="Name" required defaultValue={defaults.name} error={err.name} />
            <SelectInput name="deal_type" label="Type" required options={DEAL_TYPES} defaultValue={defaults.deal_type ?? "production"} error={err.deal_type} />
            <SelectInput name="status" label="Status" required options={STATUSES} defaultValue={defaults.status ?? "draft"} error={err.status} />
            <TextInput name="buyer" label="Buyer" required defaultValue={defaults.buyer} error={err.buyer} />
            <TextInput name="producer" label="Producer" defaultValue={defaults.producer} error={err.producer} />
            <TextInput name="input_product" label="Input product" defaultValue={defaults.input_product} error={err.input_product} />
            <TextInput name="output_product" label="Output product" defaultValue={defaults.output_product} error={err.output_product} />
            <TextInput name="disport" label="Discharge port" defaultValue={defaults.disport} error={err.disport} />
            <TextInput name="payment_type" label="Payment type" defaultValue={defaults.payment_type} hint='Funding cost applies when "prefunded"' error={err.payment_type} />
            <TextInput name="start_month" type="month" label="Start month" defaultValue={toMonth(defaults.start_month)} error={err.start_month} />
            <TextInput name="end_month" type="month" label="End month" defaultValue={toMonth(defaults.end_month)} error={err.end_month} />
          </div>
        </Card>

        <Card className="space-y-4 p-5">
          <h2 className="text-sm font-semibold text-slate-700">Economics inputs</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <NumberInput name="tonnes" label="Tonnes (B100)" required defaultValue={defaults.tonnes} error={err.tonnes} />
            <NumberInput name="buy_price_per_tonne" label="Buy price /t" required defaultValue={defaults.buy_price_per_tonne} error={err.buy_price_per_tonne} />
            <NumberInput name="sell_price_per_tonne" label="Sell price /t" required defaultValue={defaults.sell_price_per_tonne} error={err.sell_price_per_tonne} />
            <NumberInput name="shipping_per_tonne" label="Shipping /t" defaultValue={defaults.shipping_per_tonne} error={err.shipping_per_tonne} />
            <NumberInput name="trucking_per_tonne" label="Trucking /t" defaultValue={defaults.trucking_per_tonne} error={err.trucking_per_tonne} />
          </div>
          <TextArea name="notes" label="Notes" defaultValue={defaults.notes} error={err.notes} />
        </Card>

        <FormError message={state.formError} />
        <FormActions cancelHref="/deals" submitLabel={submitLabel} />
      </div>

      {/* Live economics preview — recomputed client-side; the server recomputes on save. */}
      <div className="space-y-4">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">Economics preview</h2>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                econ.go ? "bg-brand-100 text-brand-800" : "bg-amber-100 text-amber-800"
              }`}
            >
              {econ.go ? "GO" : "REVIEW"}
            </span>
          </div>
          <dl className="mt-3 space-y-2 text-sm">
            <Row label="Total cost" value={formatUSD(econ.total_cost)} />
            <Row label="Total revenue" value={formatUSD(econ.total_revenue)} />
            <Row label="Profit" value={formatUSD(econ.profit)} accent />
            <Row label="Margin" value={formatPercent(econ.margin, { isFraction: false })} />
            <Row label="Profit / tonne" value={formatUSD(econ.profit_per_tonne, { decimals: true })} />
            <Row label="Pre-funding" value={formatUSD(econ.pre_funding_required)} />
            <Row label="Funding cost" value={formatUSD(econ.funding_cost)} />
          </dl>
        </Card>

        <Card className="p-5">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
            <Info className="h-4 w-4 text-slate-400" /> Assumptions
            {ASSUMPTIONS_UNCONFIRMED && (
              <span className="ml-auto rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium uppercase text-amber-800">
                provisional
              </span>
            )}
          </h2>
          <p className="mt-1 text-[11px] text-slate-500">
            Figures use these defaults until finance confirms them.
          </p>
          <ul className="mt-2 space-y-1 text-[11px] text-slate-500">
            {ASSUMPTION_NOTES.map((a) => (
              <li key={a.label} className="flex justify-between gap-2">
                <span>{a.label}</span>
                <span className="text-slate-700">{a.display}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </form>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-slate-500">{label}</dt>
      <dd className={`tabular-nums ${accent ? "font-semibold text-accent-600" : "text-slate-800"}`}>{value}</dd>
    </div>
  );
}
