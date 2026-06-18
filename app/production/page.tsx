import { Factory } from "lucide-react";
import { PageHeader, StatCard, PlaceholderPanel } from "@/components/ui";

export default function ProductionPage() {
  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Production Status"
        description="B100 fuel & glycerol output"
        icon={Factory}
      />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="B100 output (mo)" value="135" unit="t" hint="target 135 t" />
        <StatCard label="Glycerol output (mo)" value="13" unit="t" />
        <StatCard label="UCO consumed" value="150" unit="t" />
        <StatCard label="Capacity used" value="100%" accent />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <PlaceholderPanel
          title="Production plan vs actual"
          columns={["Month", "Target", "Actual", "B100", "Glycerol", "Status"]}
        />
        <PlaceholderPanel
          title="Quality tests (latest batches)"
          columns={["Batch", "Date", "Flash point", "Water", "Result"]}
        />
      </div>
    </div>
  );
}
