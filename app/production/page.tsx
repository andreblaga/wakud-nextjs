import { Suspense } from "react";
import Link from "next/link";
import { Factory, Plus, Pencil } from "lucide-react";
import { PageHeader, StatCard, StatusBadge } from "@/components/ui";
import { RoleGate } from "@/components/RoleGate";
import { DataTable, EmptyState, ErrorState, TableSkeleton, type Column } from "@/components/DataTable";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth";
import { canWrite } from "@/lib/permissions";
import { formatNumber, formatPercent } from "@/lib/currency";
import { monthLabel, formatDate } from "@/lib/dates";

export default function ProductionPage() {
  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Production Status"
        description="B100 fuel & glycerol output"
        icon={Factory}
        action={
          <RoleGate domain="production">
            <Link href="/production/new" className="inline-flex items-center gap-1.5 rounded-lg bg-brand-700 px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-800">
              <Plus className="h-4 w-4" /> New month
            </Link>
          </RoleGate>
        }
      />
      <Suspense fallback={<TableSkeleton columns={6} title="Production plan vs actual" />}>
        <ProductionContent />
      </Suspense>
    </div>
  );
}

type PlanRow = {
  id: string;
  month: string;
  target_output: number | null;
  actual_output: number | null;
  b100_output: number | null;
  glycerin_output: number | null;
  uco_consumed: number | null;
  status: string | null;
};
type QualityRow = {
  id: string;
  production_batch_id: string | null;
  test_date: string;
  flash_point: number | null;
  water_content: number | null;
  overall_result: string | null;
};

const planColumns: Column<PlanRow>[] = [
  {
    key: "month",
    header: "Month",
    render: (r) => (
      <Link href={`/production/${r.id}`} className="font-medium text-slate-900 hover:text-brand-700 hover:underline">
        {monthLabel(r.month, true)}
      </Link>
    ),
  },
  { key: "target_output", header: "Target (t)", align: "right", render: (r) => formatNumber(r.target_output) },
  { key: "actual_output", header: "Actual (t)", align: "right", render: (r) => formatNumber(r.actual_output) },
  { key: "b100_output", header: "B100 (t)", align: "right", render: (r) => formatNumber(r.b100_output) },
  { key: "glycerin_output", header: "Glycerol (t)", align: "right", render: (r) => formatNumber(r.glycerin_output) },
  { key: "status", header: "Status", render: (r) => (r.status ? <StatusBadge status={r.status} /> : null) },
];

const qualityColumns: Column<QualityRow>[] = [
  { key: "production_batch_id", header: "Batch", render: (q) => <span className="font-medium text-slate-900">{q.production_batch_id}</span> },
  { key: "test_date", header: "Date", render: (q) => formatDate(q.test_date) },
  { key: "flash_point", header: "Flash pt", align: "right", render: (q) => formatNumber(q.flash_point, 1) },
  { key: "water_content", header: "Water", align: "right", render: (q) => formatNumber(q.water_content, 1) },
  {
    key: "overall_result",
    header: "Result",
    render: (q) => (q.overall_result ? <StatusBadge status={q.overall_result} /> : null),
  },
];

async function ProductionContent() {
  const supabase = createClient();
  if (!supabase) return <ErrorState message="Supabase isn't configured." />;

  const [planRes, qualityRes] = await Promise.all([
    supabase
      .from("production_plan")
      .select("id, month, target_output, actual_output, b100_output, glycerin_output, uco_consumed, status")
      .order("month", { ascending: false }),
    supabase
      .from("quality_tests")
      .select("id, production_batch_id, test_date, flash_point, water_content, overall_result")
      .order("test_date", { ascending: false })
      .limit(10),
  ]);

  const firstError = planRes.error || qualityRes.error;
  if (firstError) return <ErrorState message={firstError.message} />;

  const plan = (planRes.data ?? []) as PlanRow[];
  const quality = (qualityRes.data ?? []) as QualityRow[];

  const user = await getSessionUser();
  const planCols = canWrite(user?.role, "production")
    ? [
        ...planColumns,
        {
          key: "edit",
          header: "",
          align: "right",
          render: (r: PlanRow) => (
            <Link href={`/production/${r.id}/edit`} className="inline-flex text-slate-400 hover:text-brand-700" aria-label="Edit">
              <Pencil className="h-4 w-4" />
            </Link>
          ),
        } satisfies Column<PlanRow>,
      ]
    : planColumns;

  // Latest month (rows are sorted desc) for the KPI cards.
  const latest = plan[0];
  const capacityUsed =
    latest && latest.target_output
      ? (Number(latest.actual_output) || 0) / Number(latest.target_output)
      : null;

  return (
    <>
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="B100 output (latest)" value={formatNumber(latest?.b100_output)} unit="t" />
        <StatCard label="Glycerol output (latest)" value={formatNumber(latest?.glycerin_output)} unit="t" />
        <StatCard label="UCO consumed (latest)" value={formatNumber(latest?.uco_consumed)} unit="t" />
        <StatCard label="Capacity used (latest)" value={formatPercent(capacityUsed)} accent />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {plan.length > 0 ? (
          <DataTable title="Production plan vs actual" columns={planCols} rows={plan} getRowKey={(r) => r.id} />
        ) : (
          <EmptyState title="No production plan yet" message="Monthly targets and actuals will show here." icon={Factory} />
        )}
        {quality.length > 0 ? (
          <DataTable title="Quality tests (latest batches)" columns={qualityColumns} rows={quality} getRowKey={(q) => q.id} />
        ) : (
          <EmptyState title="No quality tests yet" message="Biodiesel QC results will show here." icon={Factory} />
        )}
      </div>
    </>
  );
}
