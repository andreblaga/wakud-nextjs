import { Suspense } from "react";
import { Truck } from "lucide-react";
import { PageHeader, StatCard, StatusBadge } from "@/components/ui";
import { DataTable, EmptyState, ErrorState, TableSkeleton, type Column } from "@/components/DataTable";
import { createClient } from "@/lib/supabase/server";
import { formatUSD, formatNumber } from "@/lib/currency";
import { formatDate, currentMonthStart } from "@/lib/dates";

export default function LogisticsPage() {
  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader title="Logistics" description="Shipments & deliveries" icon={Truck} />
      <Suspense fallback={<TableSkeleton columns={7} title="Shipments" />}>
        <LogisticsContent />
      </Suspense>
    </div>
  );
}

type ShipmentRow = {
  id: string;
  shipment_ref: string;
  destination: string | null;
  vessel_name: string | null;
  departure_date: string | null;
  eta_date: string | null;
  tonnes_loaded: number | null;
  freight_cost_usd: number | null;
  status: string;
};

const columns: Column<ShipmentRow>[] = [
  { key: "shipment_ref", header: "Ref", render: (s) => <span className="font-medium text-slate-900">{s.shipment_ref}</span> },
  { key: "destination", header: "Destination" },
  { key: "vessel_name", header: "Vessel" },
  { key: "departure_date", header: "Departure", render: (s) => formatDate(s.departure_date) },
  { key: "eta_date", header: "ETA", render: (s) => formatDate(s.eta_date) },
  { key: "tonnes_loaded", header: "Tonnes", align: "right", render: (s) => formatNumber(s.tonnes_loaded) },
  { key: "status", header: "Status", render: (s) => <StatusBadge status={s.status} /> },
];

async function LogisticsContent() {
  const supabase = createClient();
  if (!supabase) return <ErrorState message="Supabase isn't configured." />;

  const { data, error } = await supabase
    .from("shipments")
    .select("id, shipment_ref, destination, vessel_name, departure_date, eta_date, tonnes_loaded, freight_cost_usd, status")
    .order("departure_date", { ascending: false, nullsFirst: false });

  if (error) return <ErrorState message={error.message} />;
  const shipments = (data ?? []) as ShipmentRow[];

  const month = currentMonthStart();
  const inTransit = shipments.filter((s) => s.status === "in_transit").length;
  const planned = shipments.filter((s) => s.status === "planned").length;
  const deliveredThisMonth = shipments.filter(
    (s) => s.status === "delivered" && (s.eta_date ?? "") >= month,
  ).length;
  const freightThisMonth = shipments
    .filter((s) => (s.departure_date ?? "") >= month)
    .reduce((sum, s) => sum + (Number(s.freight_cost_usd) || 0), 0);

  return (
    <>
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="In transit" value={formatNumber(inTransit)} />
        <StatCard label="Planned" value={formatNumber(planned)} />
        <StatCard label="Delivered (this month)" value={formatNumber(deliveredThisMonth)} />
        <StatCard label="Freight cost (this month)" value={formatUSD(freightThisMonth)} />
      </div>

      {shipments.length > 0 ? (
        <DataTable title="Shipments" columns={columns} rows={shipments} getRowKey={(s) => s.id} />
      ) : (
        <EmptyState title="No shipments yet" message="Shipments will appear here as they're scheduled." icon={Truck} />
      )}
    </>
  );
}
