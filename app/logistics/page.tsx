import { Truck } from "lucide-react";
import { PageHeader, StatCard, PlaceholderPanel } from "@/components/ui";

export default function LogisticsPage() {
  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Logistics"
        description="Shipments & deliveries"
        icon={Truck}
      />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="In transit" value="2" />
        <StatCard label="Planned" value="3" />
        <StatCard label="Delivered (mo)" value="4" />
        <StatCard label="Freight cost (mo)" value="$48k" />
      </div>
      <PlaceholderPanel
        title="Shipments"
        columns={["Ref", "Destination", "Vessel", "Departure", "ETA", "Tonnes", "Status"]}
      />
    </div>
  );
}
