import { Boxes, ArrowDownToLine, AlertTriangle } from "lucide-react";
import { PageHeader, StatCard, PlaceholderPanel, Card } from "@/components/ui";

export default function InventoryPage() {
  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Inventory"
        description="UCO stock, intake, and material reorder"
        icon={Boxes}
      />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="UCO stock" value="92" unit="t" hint="safety 20 t" />
        <StatCard label="B100 stock" value="75" unit="t" />
        <StatCard label="Methanol" value="6,400" unit="kg" />
        <StatCard label="Below safety" value="1" accent hint="item needs reorder" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <PlaceholderPanel
          title="UCO stock by month"
          columns={["Month", "Opening", "Purchased", "Consumed", "Closing"]}
        />
        <div className="space-y-6">
          <Card className="p-5">
            <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-slate-700">
              <ArrowDownToLine className="h-4 w-4 text-brand-700" /> UCO Intake
            </h2>
            <p className="text-xs text-slate-500">
              Receiving log for incoming feedstock — supplier, quantity, date, and ISCC
              sustainability declaration. Feeds UCO stock and the mass-balance trace.
            </p>
            <p className="mt-3 text-xs text-slate-400">No intake records yet.</p>
          </Card>
          <Card className="p-5">
            <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-slate-700">
              <AlertTriangle className="h-4 w-4 text-accent-500" /> Reorder suggestions
            </h2>
            <p className="text-xs text-slate-500">
              Auto-flagged when stock drops below its safety level, based on production
              plan and supplier lead times.
            </p>
            <p className="mt-3 text-xs text-slate-400">No reorder alerts yet.</p>
          </Card>
        </div>
      </div>
    </div>
  );
}
