import { Suspense } from "react";
import Link from "next/link";
import { LayoutDashboard } from "lucide-react";
import { PageHeader, StatCard, Card } from "@/components/ui";
import { ErrorState } from "@/components/DataTable";
import ForecastChart, { type ForecastPoint } from "@/components/ForecastChart";
import { createClient } from "@/lib/supabase/server";
import { getNotifications } from "@/lib/notifications";
import { getSessionUser } from "@/lib/auth";
import { NOTIFICATION_ICON, SEVERITY_COLOR, TYPE_LABEL } from "@/components/notification-ui";
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
  const viewer = await getSessionUser();

  const [dealsRes, committedRes, forecastRes, notifications] = await Promise.all([
    supabase.from("deals").select("status").in("status", ACTIVE_DEAL_STATUSES),
    supabase.from("contract_volumes").select("planned_volume").gte("month", month),
    supabase
      .from("monthly_forecast")
      .select("month, production_profit, arb_profit, total_profit, working_capital_needed")
      .order("month", { ascending: true }),
    // Same source as the TopBar bell + /alerts, so the dashboard never diverges.
    getNotifications(supabase, 6, viewer),
  ]);

  const firstError = dealsRes.error || committedRes.error || forecastRes.error;
  if (firstError) return <ErrorState message={firstError.message} />;

  // The typed client + Promise.all collapses .data to `never`; re-type here.
  type ForecastRow = {
    month: string;
    production_profit: number | null;
    arb_profit: number | null;
    total_profit: number | null;
    working_capital_needed: number | null;
  };
  const committed = (committedRes.data ?? []) as { planned_volume: number | null }[];
  const forecast = (forecastRes.data ?? []) as ForecastRow[];

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
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">Notifications</h2>
            <Link href="/alerts" className="text-xs font-medium text-brand-700 hover:underline">
              View all
            </Link>
          </div>
          {notifications.length > 0 ? (
            <ul className="space-y-3">
              {notifications.map((n) => {
                const Icon = NOTIFICATION_ICON[n.type];
                return (
                  <li key={`${n.type}-${n.id}`}>
                    <Link href={n.href} className="-mx-2 flex gap-2.5 rounded-lg px-2 py-1 hover:bg-slate-50">
                      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${SEVERITY_COLOR[n.severity]}`} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-800">{n.title}</p>
                        <p className="truncate text-xs text-slate-500">{n.detail}</p>
                      </div>
                      <span className="ml-auto shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
                        {TYPE_LABEL[n.type]}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="py-6 text-center text-sm text-slate-400">You&apos;re all caught up.</p>
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
