import { LayoutDashboard, AlertTriangle } from "lucide-react";
import { PageHeader, StatCard, Card } from "@/components/ui";
import ForecastChart from "@/components/ForecastChart";

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Dashboard"
        description="Facility overview — Barka, Oman"
        icon={LayoutDashboard}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Active deals" value="5" hint="3 confirmed" />
        <StatCard label="Committed volume" value="1,980" unit="t" hint="next 6 months" />
        <StatCard label="Forecast profit" value="$1.2M" accent hint="rolling 12 mo" />
        <StatCard label="Working capital" value="$2.4M" hint="required" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">Monthly profit forecast</h2>
            <span className="text-xs text-slate-400">Sample data — connect Supabase</span>
          </div>
          <ForecastChart />
        </Card>

        <Card className="p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Alerts</h2>
          <ul className="space-y-3">
            {[
              { t: "Synsol concentration high", d: "51% of committed volume with one buyer", s: "warning" },
              { t: "UCO stock below safety", d: "Projected shortfall in Sep", s: "warning" },
              { t: "ISCC cert renewal due", d: "Expires in 45 days", s: "info" },
            ].map((a) => (
              <li key={a.t} className="flex gap-2.5">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-accent-500" />
                <div>
                  <p className="text-sm font-medium text-slate-800">{a.t}</p>
                  <p className="text-xs text-slate-500">{a.d}</p>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <p className="mt-6 text-xs text-slate-400">
        First-pass scaffold. Figures shown are placeholders until the Supabase project is connected.
      </p>
    </div>
  );
}
