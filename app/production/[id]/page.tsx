import Link from "next/link";
import { notFound } from "next/navigation";
import { Factory } from "lucide-react";
import {
  BackLink,
  DetailField,
  DetailSection,
  PageHeader,
  StatusBadge,
} from "@/components/ui";
import { DataTable, ErrorState, type Column } from "@/components/DataTable";
import { EditButton } from "@/components/EditButton";
import AuditTrail from "@/components/AuditTrail";
import { createClient } from "@/lib/supabase/server";
import { formatNumber, formatPercent } from "@/lib/currency";
import { formatDate, monthLabel, nextMonthStart } from "@/lib/dates";
import { unitLabel } from "@/lib/units";

/**
 * Read-only view of one production month.
 *
 * Figures are shown in the unit they were recorded in (production_plan.unit):
 * rows derived from the Barka inventory workbook are in KL and nothing in the
 * app converts them, so labelling everything "t" here would be a lie.
 */
export default async function ProductionDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  if (!supabase) {
    return (
      <div className="mx-auto max-w-5xl">
        <ErrorState message="Supabase isn't configured." />
      </div>
    );
  }

  const { data } = await supabase
    .from("production_plan")
    .select(
      "id, month, target_output, actual_output, b100_output, glycerin_output, uco_consumed, wastage, unit, source, status, notes, updated_at",
    )
    .eq("id", params.id)
    .maybeSingle();

  if (!data) notFound();
  const plan = data as PlanDetail;
  const u = unitLabel(plan.unit);

  // target_output is NULL for months derived from the workbook — it records
  // actuals only. NULL is not zero, so there is simply no capacity figure.
  const target = plan.target_output === null ? null : Number(plan.target_output);
  const capacityUsed = target ? (Number(plan.actual_output) || 0) / target : null;

  // Confirmations carry a production_month that need not be the first of the
  // month, so bound the month rather than matching it exactly.
  const { data: confirmationData } = await supabase
    .from("production_confirmations")
    .select("id, deal_id, status, tonnage, confirmed_by, confirmed_at, issue_flag, issue_reason")
    .gte("production_month", plan.month)
    .lt("production_month", nextMonthStart(plan.month))
    .order("confirmed_at", { ascending: false });

  const confirmations = (confirmationData ?? []) as ConfirmationRow[];

  // Resolve each confirmation's deal in one extra query rather than a PostgREST
  // embed, so the row shows the deal reference people recognise instead of a UUID.
  const dealIds = Array.from(new Set(confirmations.map((c) => c.deal_id).filter(Boolean))) as string[];
  const { data: dealData } = dealIds.length
    ? await supabase.from("deals").select("id, deal_id, name").in("id", dealIds)
    : { data: [] };
  const dealsById = new Map(
    ((dealData ?? []) as { id: string; deal_id: string; name: string }[]).map((d) => [d.id, d]),
  );

  const confirmationColumns: Column<ConfirmationRow>[] = [
    {
      key: "deal_id",
      header: "Deal",
      render: (c) => {
        if (!c.deal_id) return null;
        const deal = dealsById.get(c.deal_id);
        return (
          <Link href={`/deals/${c.deal_id}`} className="font-medium text-brand-700 hover:underline">
            {deal?.deal_id || deal?.name || "View deal"}
          </Link>
        );
      },
    },
    ...confirmationBaseColumns,
  ];

  return (
    <div className="mx-auto max-w-5xl">
      <BackLink href="/production" label="Production" />
      <PageHeader
        title={monthLabel(plan.month, true)}
        description="Monthly target & output"
        icon={Factory}
        action={<EditButton domain="production" href={`/production/${plan.id}/edit`} />}
      />

      <div className="space-y-4">
        <DetailSection title="Output" columns={3}>
          <DetailField
            label={`Target output (${u})`}
            value={target === null ? null : formatNumber(target)}
            hint={target === null ? "No target set for this month" : undefined}
          />
          <DetailField label={`Actual output (${u})`} value={formatNumber(plan.actual_output)} />
          <DetailField label="Capacity used" value={formatPercent(capacityUsed)} />
          <DetailField label={`B100 output (${u})`} value={formatNumber(plan.b100_output)} />
          <DetailField label={`Glycerol output (${u})`} value={formatNumber(plan.glycerin_output)} />
          <DetailField label={`UCO consumed (${u})`} value={formatNumber(plan.uco_consumed)} />
          <DetailField label={`Wastage (${u})`} value={formatNumber(plan.wastage)} />
          <DetailField
            label="Status"
            value={plan.status ? <StatusBadge status={plan.status} /> : null}
          />
          <DetailField
            label="Source"
            value={plan.source === "sharepoint" ? "SharePoint sync" : "Entered in the app"}
            hint={plan.source === "sharepoint" ? "Derived from the Barka inventory workbook" : undefined}
          />
          <DetailField label="Notes" value={plan.notes} full />
        </DetailSection>

        {confirmations.length > 0 && (
          <DataTable
            title="Production confirmations this month"
            columns={confirmationColumns}
            rows={confirmations}
            getRowKey={(c) => c.id}
          />
        )}

        <AuditTrail entityType="production_plan" entityId={plan.id} />

        <p className="text-xs text-slate-400">Last updated {formatDate(plan.updated_at)}</p>
      </div>
    </div>
  );
}

type PlanDetail = {
  id: string;
  month: string;
  target_output: number | null;
  actual_output: number | null;
  b100_output: number | null;
  glycerin_output: number | null;
  uco_consumed: number | null;
  wastage: number | null;
  unit: string;
  source: string;
  status: string | null;
  notes: string | null;
  updated_at: string | null;
};

type ConfirmationRow = {
  id: string;
  deal_id: string | null;
  status: string | null;
  tonnage: number | null;
  confirmed_by: string | null;
  confirmed_at: string | null;
  issue_flag: string | null;
  issue_reason: string | null;
};

const confirmationBaseColumns: Column<ConfirmationRow>[] = [
  { key: "tonnage", header: "Tonnage (t)", align: "right", render: (c) => formatNumber(c.tonnage) },
  { key: "status", header: "Status", render: (c) => (c.status ? <StatusBadge status={c.status} /> : null) },
  { key: "confirmed_by", header: "Confirmed by" },
  { key: "confirmed_at", header: "Confirmed", render: (c) => formatDate(c.confirmed_at) },
  {
    key: "issue_flag",
    header: "Issue",
    render: (c) =>
      c.issue_flag ? (
        <span title={c.issue_reason ?? undefined} className="text-amber-700">
          {c.issue_flag}
        </span>
      ) : null,
  },
];
