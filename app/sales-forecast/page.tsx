import { Suspense } from "react";
import { TrendingUp } from "lucide-react";
import { PageHeader, StatCard } from "@/components/ui";
import { DataTable, EmptyState, ErrorState, TableSkeleton, type Column } from "@/components/DataTable";
import { createClient } from "@/lib/supabase/server";
import { formatUSD, formatNumber } from "@/lib/currency";
import { monthLabel, currentMonthStart } from "@/lib/dates";

export default function SalesForecastPage() {
  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Sales Forecast"
        description="Committed contract volumes & 12-month projections"
        icon={TrendingUp}
      />
      <Suspense fallback={<TableSkeleton columns={7} title="Monthly forecast" />}>
        <ForecastContent />
      </Suspense>
    </div>
  );
}

type ForecastRow = {
  month: string;
  total_committed: number | null;
  avg_contract_price: number | null;
  barka_output: number | null;
  gap: number | null;
  arb_required: number | null;
  production_revenue: number | null;
  arb_revenue: number | null;
  total_profit: number | null;
  working_capital_needed: number | null;
};

const columns: Column<ForecastRow>[] = [
  { key: "month", header: "Month", render: (r) => <span className="font-medium text-slate-900">{monthLabel(r.month, true)}</span> },
  { key: "total_committed", header: "Committed (t)", align: "right", render: (r) => formatNumber(r.total_committed) },
  { key: "barka_output", header: "Barka output (t)", align: "right", render: (r) => formatNumber(r.barka_output) },
  { key: "gap", header: "Gap (t)", align: "right", render: (r) => formatNumber(r.gap) },
  { key: "arb_required", header: "Arb required (t)", align: "right", render: (r) => formatNumber(r.arb_required) },
  { key: "total_profit", header: "Total profit", align: "right", render: (r) => formatUSD(r.total_profit) },
  { key: "working_capital_needed", header: "Working capital", align: "right", render: (r) => formatUSD(r.working_capital_needed) },
];

async function ForecastContent() {
  const supabase = createClient();
  if (!supabase) return <ErrorState message="Supabase isn't configured." />;

  const month = currentMonthStart();
  const [forecastRes, contractsRes, committedRes] = await Promise.all([
    supabase
      .from("monthly_forecast")
      .select("month, total_committed, avg_contract_price, barka_output, gap, arb_required, production_revenue, arb_revenue, total_profit, working_capital_needed")
      .order("month", { ascending: true }),
    supabase.from("contracts").select("price_per_tonne").eq("is_active", true),
    supabase.from("contract_volumes").select("planned_volume").gte("month", month),
  ]);

  const firstError = forecastRes.error || contractsRes.error || committedRes.error;
  if (firstError) return <ErrorState message={firstError.message} />;

  const forecast = (forecastRes.data ?? []) as ForecastRow[];
  const contracts = (contractsRes.data ?? []) as { price_per_tonne: number | null }[];
  const committed = (committedRes.data ?? []) as { planned_volume: number | null }[];

  const committedVolume = committed.reduce((s, r) => s + (Number(r.planned_volume) || 0), 0);
  const avgPrice = contracts.length
    ? contracts.reduce((s, c) => s + (Number(c.price_per_tonne) || 0), 0) / contracts.length
    : null;
  const arbRequired = forecast.reduce((s, r) => s + (Number(r.arb_required) || 0), 0);
  const projectedRevenue = forecast.reduce(
    (s, r) => s + (Number(r.production_revenue) || 0) + (Number(r.arb_revenue) || 0),
    0,
  );

  return (
    <>
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Committed (from this month)" value={formatNumber(committedVolume)} unit="t" />
        <StatCard label="Avg contract price" value={formatUSD(avgPrice)} unit="/t" />
        <StatCard label="Arbitrage required" value={formatNumber(arbRequired)} unit="t" />
        <StatCard label="Projected revenue" value={formatUSD(projectedRevenue)} accent />
      </div>

      {forecast.length > 0 ? (
        <DataTable title="Monthly forecast" columns={columns} rows={forecast} getRowKey={(r) => r.month} />
      ) : (
        <EmptyState
          title="No forecast yet"
          message="The monthly_forecast table is empty. It will populate as contracts and the forecast model are loaded."
          icon={TrendingUp}
        />
      )}
    </>
  );
}
