import { Suspense } from "react";
import Link from "next/link";
import { TrendingUp, Plus, Pencil } from "lucide-react";
import { PageHeader, StatCard, StatusBadge } from "@/components/ui";
import { RoleGate } from "@/components/RoleGate";
import { DataTable, EmptyState, ErrorState, TableSkeleton, type Column } from "@/components/DataTable";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth";
import { canWrite } from "@/lib/permissions";
import { formatUSD, formatNumber } from "@/lib/currency";
import { monthLabel, formatDate, currentMonthStart } from "@/lib/dates";

export default function SalesForecastPage() {
  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Sales Forecast"
        description="Committed contract volumes & 12-month projections"
        icon={TrendingUp}
        action={
          <RoleGate domain="contracts">
            <Link href="/contracts/new" className="inline-flex items-center gap-1.5 rounded-lg bg-brand-700 px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-800">
              <Plus className="h-4 w-4" /> New contract
            </Link>
          </RoleGate>
        }
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

type ContractRow = {
  id: string;
  name: string;
  buyer: string;
  price_per_tonne: number | null;
  is_active: boolean | null;
  status: string | null;
  start_date: string | null;
  end_date: string | null;
};

const contractColumns: Column<ContractRow>[] = [
  {
    key: "name",
    header: "Contract",
    render: (c) => (
      <Link href={`/contracts/${c.id}`} className="font-medium text-slate-900 hover:text-brand-700 hover:underline">
        {c.name}
      </Link>
    ),
  },
  { key: "buyer", header: "Buyer" },
  { key: "price_per_tonne", header: "Price /t", align: "right", render: (c) => formatUSD(c.price_per_tonne) },
  { key: "start_date", header: "Start", render: (c) => formatDate(c.start_date) },
  { key: "end_date", header: "End", render: (c) => formatDate(c.end_date) },
  { key: "status", header: "Status", render: (c) => (c.status ? <StatusBadge status={c.status} /> : null) },
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
    // Archived contracts are excluded outright here: the forecast is about what
    // is committed, and /contracts is where you go to see the retired ones.
    supabase
      .from("contracts")
      .select("id, name, buyer, price_per_tonne, is_active, status, start_date, end_date")
      .is("archived_at", null)
      .order("name", { ascending: true }),
    supabase.from("contract_volumes").select("planned_volume").gte("month", month),
  ]);

  const firstError = forecastRes.error || contractsRes.error || committedRes.error;
  if (firstError) return <ErrorState message={firstError.message} />;

  const forecast = (forecastRes.data ?? []) as ForecastRow[];
  const contracts = (contractsRes.data ?? []) as ContractRow[];
  const committed = (committedRes.data ?? []) as { planned_volume: number | null }[];

  const activeContracts = contracts.filter((c) => c.is_active);
  const committedVolume = committed.reduce((s, r) => s + (Number(r.planned_volume) || 0), 0);
  const avgPrice = activeContracts.length
    ? activeContracts.reduce((s, c) => s + (Number(c.price_per_tonne) || 0), 0) / activeContracts.length
    : null;
  const arbRequired = forecast.reduce((s, r) => s + (Number(r.arb_required) || 0), 0);
  const projectedRevenue = forecast.reduce(
    (s, r) => s + (Number(r.production_revenue) || 0) + (Number(r.arb_revenue) || 0),
    0,
  );

  const user = await getSessionUser();
  const contractCols: Column<ContractRow>[] = canWrite(user?.role, "contracts")
    ? [...contractColumns, {
        key: "edit", header: "", align: "right",
        render: (c: ContractRow) => (
          <Link href={`/contracts/${c.id}/edit`} className="inline-flex text-slate-400 hover:text-brand-700" aria-label="Edit"><Pencil className="h-4 w-4" /></Link>
        ),
      }]
    : contractColumns;

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

      {contracts.length > 0 && (
        <div className="mt-6">
          <DataTable
            title="Contracts"
            columns={contractCols}
            rows={contracts}
            getRowKey={(c) => c.id}
            footer={
              <Link href="/contracts" className="font-medium text-brand-700 hover:underline">
                See all contracts
              </Link>
            }
          />
        </div>
      )}
    </>
  );
}
