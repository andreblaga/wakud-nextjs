import { TrendingUp } from "lucide-react";
import { PageHeader, StatCard, PlaceholderPanel } from "@/components/ui";

export default function SalesForecastPage() {
  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Sales Forecast"
        description="Committed contract volumes & 12-month projections"
        icon={TrendingUp}
      />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Committed (6 mo)" value="1,980" unit="t" />
        <StatCard label="Avg contract price" value="$1,490" unit="/t" />
        <StatCard label="Arbitrage required" value="525" unit="t" />
        <StatCard label="Projected revenue" value="$3.1M" accent />
      </div>
      <PlaceholderPanel
        title="Monthly forecast"
        columns={["Month", "Committed", "Barka output", "Gap", "Arb required", "Total profit", "Working capital"]}
      />
    </div>
  );
}
