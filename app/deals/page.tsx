import { Handshake, Plus } from "lucide-react";
import { PageHeader, StatCard, PlaceholderPanel } from "@/components/ui";

export default function DealsPage() {
  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Deals"
        description="Trade evaluation & deal pipeline"
        icon={Handshake}
        action={
          <button className="inline-flex items-center gap-1.5 rounded-lg bg-brand-700 px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-800">
            <Plus className="h-4 w-4" /> New deal
          </button>
        }
      />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Draft" value="1" />
        <StatCard label="Approved" value="1" />
        <StatCard label="Confirmed" value="3" />
        <StatCard label="Avg margin" value="29%" accent />
      </div>
      <PlaceholderPanel
        title="Pipeline"
        columns={["Deal ID", "Name", "Type", "Buyer", "Tonnes", "Profit/t", "Margin", "Status"]}
      />
    </div>
  );
}
