import { Suspense } from "react";
import { Boxes, ArrowDownToLine, AlertTriangle } from "lucide-react";
import { PageHeader, StatCard, Card, StatusBadge } from "@/components/ui";
import { DataTable, EmptyState, ErrorState, TableSkeleton, type Column } from "@/components/DataTable";
import { createClient } from "@/lib/supabase/server";
import { formatNumber } from "@/lib/currency";
import { monthLabel, formatDate } from "@/lib/dates";

export default function InventoryPage() {
  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader title="Inventory" description="UCO stock, intake, and material reorder" icon={Boxes} />
      <Suspense fallback={<TableSkeleton columns={7} title="Stock by month" />}>
        <InventoryContent />
      </Suspense>
    </div>
  );
}

type StockRow = {
  id: string;
  product: string;
  month: string;
  opening_stock: number | null;
  produced: number | null;
  purchased: number | null;
  delivered: number | null;
  closing_stock: number | null;
  safety_stock_level: number | null;
  is_below_safety: boolean | null;
};
type OrderRow = {
  id: string;
  material: string;
  supplier: string | null;
  quantity_kg: number | null;
  lead_time_days: number | null;
  required_by: string;
  expected_delivery: string | null;
  status: string | null;
  auto_generated: boolean | null;
};

const stockColumns: Column<StockRow>[] = [
  { key: "product", header: "Product", render: (s) => <span className="font-medium text-slate-900">{s.product}</span> },
  { key: "month", header: "Month", render: (s) => monthLabel(s.month, true) },
  { key: "opening_stock", header: "Opening", align: "right", render: (s) => formatNumber(s.opening_stock) },
  { key: "produced", header: "Produced", align: "right", render: (s) => formatNumber(s.produced) },
  { key: "purchased", header: "Purchased", align: "right", render: (s) => formatNumber(s.purchased) },
  { key: "delivered", header: "Out", align: "right", render: (s) => formatNumber(s.delivered) },
  {
    key: "closing_stock",
    header: "Closing",
    align: "right",
    render: (s) => (
      <span className={s.is_below_safety ? "font-medium text-accent-600" : ""}>
        {formatNumber(s.closing_stock)}
        {s.is_below_safety && <AlertTriangle className="ml-1 inline h-3.5 w-3.5" />}
      </span>
    ),
  },
];

const orderColumns: Column<OrderRow>[] = [
  { key: "material", header: "Material", render: (o) => <span className="font-medium text-slate-900">{o.material}</span> },
  { key: "supplier", header: "Supplier" },
  { key: "quantity_kg", header: "Qty (kg)", align: "right", render: (o) => formatNumber(o.quantity_kg) },
  { key: "lead_time_days", header: "Lead (d)", align: "right", render: (o) => formatNumber(o.lead_time_days) },
  { key: "required_by", header: "Required by", render: (o) => formatDate(o.required_by) },
  {
    key: "status",
    header: "Status",
    render: (o) => (
      <span className="flex items-center gap-1.5">
        {o.status ? <StatusBadge status={o.status} /> : null}
        {o.auto_generated && <span className="text-[10px] uppercase tracking-wide text-accent-600">auto</span>}
      </span>
    ),
  },
];

async function InventoryContent() {
  const supabase = createClient();
  if (!supabase) return <ErrorState message="Supabase isn't configured." />;

  const [stockRes, ordersRes] = await Promise.all([
    supabase
      .from("stock_levels")
      .select("id, product, month, opening_stock, produced, purchased, delivered, closing_stock, safety_stock_level, is_below_safety")
      .order("month", { ascending: false }),
    supabase
      .from("raw_material_orders")
      .select("id, material, supplier, quantity_kg, lead_time_days, required_by, expected_delivery, status, auto_generated")
      .order("required_by", { ascending: true }),
  ]);

  const firstError = stockRes.error || ordersRes.error;
  if (firstError) return <ErrorState message={firstError.message} />;

  const stock = (stockRes.data ?? []) as StockRow[];
  const orders = (ordersRes.data ?? []) as OrderRow[];

  // Latest closing per product for the KPI cards.
  const latestByProduct = new Map<string, StockRow>();
  for (const s of stock) {
    if (!latestByProduct.has(s.product)) latestByProduct.set(s.product, s); // stock is month-desc
  }
  const ucoStock = latestByProduct.get("UCO")?.closing_stock ?? null;
  const b100Stock = latestByProduct.get("B100")?.closing_stock ?? null;
  const belowSafety = Array.from(latestByProduct.values()).filter((s) => s.is_below_safety);
  const openOrders = orders.filter((o) => o.status !== "delivered" && o.status !== "cancelled").length;

  return (
    <>
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="UCO stock (latest)" value={formatNumber(ucoStock)} unit="t" />
        <StatCard label="B100 stock (latest)" value={formatNumber(b100Stock)} unit="t" />
        <StatCard label="Open material orders" value={formatNumber(openOrders)} />
        <StatCard label="Below safety" value={formatNumber(belowSafety.length)} accent hint="products need reorder" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {stock.length > 0 ? (
          <DataTable title="Stock by month" columns={stockColumns} rows={stock} getRowKey={(s) => s.id} />
        ) : (
          <EmptyState title="No stock records yet" message="Monthly stock levels (UCO, B100, …) will show here." icon={Boxes} />
        )}

        <div className="space-y-6">
          <Card className="p-5">
            <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-slate-700">
              <ArrowDownToLine className="h-4 w-4 text-brand-700" /> UCO Intake
            </h2>
            <p className="text-xs text-slate-500">
              Receiving log for incoming feedstock — supplier, quantity, date, and ISCC
              sustainability declaration. Dedicated intake records arrive in Phase 4; today
              feedstock procurement is tracked in material orders below.
            </p>
          </Card>

          <Card className="p-5">
            <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
              <AlertTriangle className="h-4 w-4 text-accent-500" /> Reorder suggestions
            </h2>
            {belowSafety.length > 0 ? (
              <ul className="space-y-2 text-sm">
                {belowSafety.map((s) => (
                  <li key={s.id} className="flex items-center justify-between">
                    <span className="text-slate-700">{s.product}</span>
                    <span className="text-xs text-accent-600">
                      {formatNumber(s.closing_stock)} t · safety {formatNumber(s.safety_stock_level)} t
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-slate-400">No products below their safety level.</p>
            )}
          </Card>
        </div>
      </div>

      {orders.length > 0 && (
        <div className="mt-6">
          <DataTable title="Raw material orders" columns={orderColumns} rows={orders} getRowKey={(o) => o.id} />
        </div>
      )}
    </>
  );
}
