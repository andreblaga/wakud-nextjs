import { Suspense } from "react";
import { LayoutDashboard, AlertTriangle, Info, AlertOctagon } from "lucide-react";
import { PageHeader, StatCard, Card } from "@/components/ui";
import { ErrorState } from "@/components/DataTable";
import ForecastChart, { type ForecastPoint } from "@/components/ForecastChart";
import { createClient } from "@/lib/supabase/server";
import { formatUSD, formatNumber } from "@/lib/currency";
import { monthLabel, currentMonthStart } from "@/lib/dates";

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Dashboard"
        description="Facility overview — Barka, Oman"
        icon={LayoutDashboard}
      />
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent />
      </Suspense>
    </div>
  );
}

const ACTIVE_DEAL_STATUSES = ["approved", "confirmed", "in_transit"];

async function DashboardContent() {
  const supabase = createClient();
  if (!supabase) return <ErrorState message="Supabase isn't configured." />;

  const month = currentMonthStart();

  const [dealsRes, committedRes, forecastRes, alertsRes] = await Promise.all([
    supabase.from("deals").select("status").in("status", ACTIVE_DEAL_STATUSES),
    supabase.from("contract_volumes").select("planned_volume").gte("month", month),
    supabase
      .from("monthly_forecast")
      .select("month, production_profit, arb_profit, total_profit, working_capital_needed")
      .order("month", { ascending: true }),
    supabase
      .from("system_alerts")
      .select("id, title, description, severity, created_at")
      .eq("is_resolved", false)
      .order("created_at", { ascending: false })
      .limit(6),
  ]);

  const firstError =
    dealsRes.error || committedRes.error || forecastRes.error || alertsRes.error;
  if (firstError) return <ErrorState message={firstError.message} />;

  // The typed client + Promise.all collapses .data to `never`; re-type here.
  type ForecastRow = {
    month: string;
    production_profit: number | null;
    arb_profit: number | null;
    total_profit: number | null;
    working_capital_needed: number | null;
  };
  type AlertRow = {
    id: string;
    title: string;
    description: string;
    severity: string;
    created_at: string | null;
  };
  const committed = (committedRes.data ?? []) as { planned_volume: number | null }[];
  const forecast = (forecastRes.data ?? []) as ForecastRow[];
  const alerts = (alertsRes.data ?? []) as AlertRow[];

  const activeDeals = dealsRes.data?.length ?? 0;
  const committedVolume = committed.reduce((sum, r) => sum + (Number(r.planned_volume) || 0), 0);
  const forecastProfit = forecast.reduce((sum, r) => sum + (Number(r.total_profit) || 0), 0);
  const peakWorkingCapital = forecast.reduce(
    (max, r) => Math.max(max, Number(r.working_capital_needed) || 0),
    0,
  );

  const chartData: ForecastPoint[] = forecast.map((r) => ({
    month: monthLabel(r.month),
    production: Number(r.production_profit) || 0,
    arbitrage: Number(r.arb_profit) || 0,
  }));

  return (
    <>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Active deals" value={formatNumber(activeDeals)} hint="approved / confirmed / in transit" />
        <StatCard label="Committed volume" value={formatNumber(committedVolume)} unit="t" hint="from this month on" />
        <StatCard label="Forecast profit" value={formatUSD(forecastProfit)} accent hint="across forecast horizon" />
        <StatCard label="Working capital" value={formatUSD(peakWorkingCapital)} hint="peak requirement" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <h2 className="mb-2 text-sm font-semibold text-slate-700">Monthly profit forecast</h2>
          {chartData.length > 0 ? (
            <ForecastChart data={chartData} />
          ) : (
            <div className="flex h-72 items-center justify-center text-sm text-slate-400">
              No forecast data yet.
            </div>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Open alerts</h2>
          {alerts.length > 0 ? (
            <ul className="space-y-3">
              {alerts.map((a) => {
                const Icon =
                  a.severity === "critical"
                    ? AlertOctagon
                    : a.severity === "info"
                      ? Info
                      : AlertTriangle;
                const color =
                  a.severity === "critical"
                    ? "text-red-500"
                    : a.severity === "info"
                      ? "text-blue-500"
                      : "text-accent-500";
                return (
                  <li key={a.id} className="flex gap-2.5">
                    <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${color}`} />
                    <div>
                      <p className="text-sm font-medium text-slate-800">{a.title}</p>
                      <p className="text-xs text-slate-500">{a.description}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="py-6 text-center text-sm text-slate-400">No open alerts.</p>
          )}
        </Card>
      </div>
    </>
  );
}

function DashboardSkeleton() {
  return (
    <>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="p-5">
            <div className="h-2.5 w-20 rounded bg-slate-100" />
            <div className="mt-3 h-6 w-24 animate-pulse rounded bg-slate-100" />
          </Card>
        ))}
      </div>
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="h-80 p-5 lg:col-span-2">
          <div className="h-full w-full animate-pulse rounded bg-slate-50" />
        </Card>
        <Card className="h-80 p-5">
          <div className="h-full w-full animate-pulse rounded bg-slate-50" />
        </Card>
      </div>
    </>
  );
}
