import { notFound } from "next/navigation";
import { FileText } from "lucide-react";
import {
  BackLink,
  DetailField,
  DetailSection,
  PageHeader,
  StatusBadge,
} from "@/components/ui";
import { DataTable, ErrorState, type Column } from "@/components/DataTable";
import { EditButton } from "@/components/EditButton";
import ArchiveButton from "@/components/ArchiveButton";
import { ArchivedNotice } from "@/components/ArchivedNotice";
import AuditTrail from "@/components/AuditTrail";
import { toggleArchive } from "@/app/archive/actions";
import { createClient } from "@/lib/supabase/server";
import { formatNumber, formatUSD } from "@/lib/currency";
import { formatDate, monthLabel } from "@/lib/dates";

/**
 * Read-only view of one contract, with its monthly volumes.
 *
 * Contracts are admin/gm-only at the database (see supabase/roles-rls.sql), so
 * for most of the company this page is the *only* way to see a contract's
 * terms — the edit form redirects everyone else.
 */
export default async function ContractDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  if (!supabase) {
    return (
      <div className="mx-auto max-w-5xl">
        <ErrorState message="Supabase isn't configured." />
      </div>
    );
  }

  const { data } = await supabase
    .from("contracts")
    .select(
      "id, name, buyer, price_per_tonne, is_active, status, start_date, end_date, renewal_date, payment_terms, incoterm, auto_renew, termination_notice_days, archived_at, created_at",
    )
    .eq("id", params.id)
    .maybeSingle();

  if (!data) notFound();
  const contract = data as ContractDetail;

  const { data: volumeData } = await supabase
    .from("contract_volumes")
    .select("id, month, planned_volume, actual_volume, status, invoice_number, invoice_status, payment_date")
    .eq("contract_id", contract.id)
    .order("month", { ascending: true });

  const volumes = (volumeData ?? []) as VolumeRow[];
  const sum = (pick: (v: VolumeRow) => number | null) =>
    volumes.reduce((total, v) => total + (Number(pick(v)) || 0), 0);
  const plannedTotal = sum((v) => v.planned_volume);
  const actualTotal = sum((v) => v.actual_volume);

  return (
    <div className="mx-auto max-w-5xl">
      <BackLink href="/contracts" label="Contracts" />
      {contract.archived_at && <ArchivedNotice archivedAt={contract.archived_at} label="contract" />}
      <PageHeader
        title={contract.name}
        description={contract.buyer}
        icon={FileText}
        action={
          <div className="flex items-center gap-2">
            <EditButton domain="contracts" href={`/contracts/${contract.id}/edit`} />
            <ArchiveButton
              action={toggleArchive.bind(null, "contract", contract.id, !contract.archived_at)}
              domain="contracts"
              archived={!!contract.archived_at}
              label="contract"
            />
          </div>
        }
      />

      <div className="space-y-4">
        <DetailSection title="Terms">
          <DetailField label="Buyer" value={contract.buyer} />
          <DetailField label="Price /t" value={formatUSD(contract.price_per_tonne, { decimals: true })} />
          <DetailField
            label="Status"
            value={contract.status ? <StatusBadge status={contract.status} /> : null}
          />
          <DetailField label="Active" value={contract.is_active ? "Yes" : "No"} />
          <DetailField label="Start date" value={formatDate(contract.start_date)} />
          <DetailField label="End date" value={formatDate(contract.end_date)} />
          <DetailField label="Renewal date" value={formatDate(contract.renewal_date)} />
          <DetailField label="Auto-renew" value={contract.auto_renew ? "Yes" : "No"} />
          <DetailField label="Payment terms" value={contract.payment_terms} />
          <DetailField label="Incoterm" value={contract.incoterm} />
          <DetailField
            label="Termination notice"
            value={
              contract.termination_notice_days === null
                ? null
                : `${contract.termination_notice_days} days`
            }
          />
        </DetailSection>

        {volumes.length > 0 ? (
          <DataTable
            title="Monthly volumes"
            columns={volumeColumns}
            rows={volumes}
            getRowKey={(v) => v.id}
            footer={`${volumes.length} month${volumes.length === 1 ? "" : "s"} · ${formatNumber(
              plannedTotal,
            )} t planned · ${formatNumber(actualTotal)} t actual · ${formatUSD(
              plannedTotal * (Number(contract.price_per_tonne) || 0),
            )} planned value`}
          />
        ) : (
          <DetailSection title="Monthly volumes">
            <DetailField
              label="Volumes"
              value="No monthly volumes recorded against this contract."
              full
            />
          </DetailSection>
        )}

        <AuditTrail entityType="contract" entityId={contract.id} />

        <p className="text-xs text-slate-400">Created {formatDate(contract.created_at)}</p>
      </div>
    </div>
  );
}

type ContractDetail = {
  id: string;
  name: string;
  buyer: string;
  price_per_tonne: number;
  is_active: boolean | null;
  status: string | null;
  start_date: string | null;
  end_date: string | null;
  renewal_date: string | null;
  payment_terms: string | null;
  incoterm: string | null;
  auto_renew: boolean | null;
  termination_notice_days: number | null;
  archived_at: string | null;
  created_at: string | null;
};

type VolumeRow = {
  id: string;
  month: string;
  planned_volume: number | null;
  actual_volume: number | null;
  status: string | null;
  invoice_number: string | null;
  invoice_status: string | null;
  payment_date: string | null;
};

const volumeColumns: Column<VolumeRow>[] = [
  {
    key: "month",
    header: "Month",
    render: (v) => <span className="font-medium text-slate-900">{monthLabel(v.month, true)}</span>,
  },
  { key: "planned_volume", header: "Planned (t)", align: "right", render: (v) => formatNumber(v.planned_volume) },
  { key: "actual_volume", header: "Actual (t)", align: "right", render: (v) => formatNumber(v.actual_volume) },
  { key: "status", header: "Status", render: (v) => (v.status ? <StatusBadge status={v.status} /> : null) },
  { key: "invoice_number", header: "Invoice" },
  {
    key: "invoice_status",
    header: "Invoiced",
    render: (v) => (v.invoice_status ? <StatusBadge status={v.invoice_status} /> : null),
  },
  { key: "payment_date", header: "Paid", render: (v) => formatDate(v.payment_date) },
];
