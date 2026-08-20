import { Card, DetailRow } from "@/components/ui";
import { formatUSD, formatPercent } from "@/lib/currency";
import type { DealEconomics } from "@/lib/deal-economics";

/**
 * The deal economics figures, laid out identically wherever they appear.
 *
 * Shared by the form's live preview and the read-only detail view so the two
 * cannot drift: both are handed the output of evaluateDeal() and neither does
 * arithmetic of its own.
 */
export function DealEconomicsPanel({
  econ,
  title = "Economics",
}: {
  econ: DealEconomics;
  title?: string;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">{title}</h2>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            econ.go ? "bg-brand-100 text-brand-800" : "bg-amber-100 text-amber-800"
          }`}
        >
          {econ.go ? "GO" : "REVIEW"}
        </span>
      </div>
      <dl className="mt-3 space-y-2 text-sm">
        <DetailRow label="Total cost" value={formatUSD(econ.total_cost)} />
        <DetailRow label="Total revenue" value={formatUSD(econ.total_revenue)} />
        <DetailRow label="Profit" value={formatUSD(econ.profit)} accent />
        <DetailRow label="Margin" value={formatPercent(econ.margin, { isFraction: false })} />
        <DetailRow label="Profit / tonne" value={formatUSD(econ.profit_per_tonne, { decimals: true })} />
        <DetailRow label="Pre-funding" value={formatUSD(econ.pre_funding_required)} />
        <DetailRow label="Funding cost" value={formatUSD(econ.funding_cost)} />
      </dl>
    </Card>
  );
}
