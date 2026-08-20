import Link from "next/link";
import { notFound } from "next/navigation";
import { Handshake } from "lucide-react";
import {
  BackLink,
  Card,
  DetailField,
  DetailSection,
  PageHeader,
  StatusBadge,
} from "@/components/ui";
import { DataTable, ErrorState, type Column } from "@/components/DataTable";
import { EditButton } from "@/components/EditButton";
import ArchiveButton from "@/components/ArchiveButton";
import { ArchivedNotice } from "@/components/ArchivedNotice";
import { DealAssumptions } from "@/components/DealAssumptions";
import { DealEconomicsPanel } from "@/components/DealEconomicsPanel";
import AuditTrail from "@/components/AuditTrail";
import { toggleArchive } from "@/app/archive/actions";
import { createClient } from "@/lib/supabase/server";
import { evaluateDeal } from "@/lib/deal-economics";
import { formatNumber, formatUSD } from "@/lib/currency";
import { formatDate, monthLabel } from "@/lib/dates";

/**
 * Read-only view of one deal.
 *
 * Deliberately ungated: every signed-in user may open it, RLS decides what the
 * query returns, and the Edit button is the only thing behind a role check. The
 * edit form next door still redirects non-writers — this page is what they get
 * instead of a bounce.
 */
export default async function DealDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  if (!supabase) {
    return (
      <div className="mx-auto max-w-5xl">
        <ErrorState message="Supabase isn't configured." />
      </div>
    );
  }

  const { data } = await supabase
    .from("deals")
    .select(
      "id, deal_id, name, deal_type, status, buyer, input_product, output_product, producer, disport, tonnes, buy_price_per_tonne, sell_price_per_tonne, shipping_per_tonne, trucking_per_tonne, payment_type, profit, archived_at, start_month, end_month, notes, created_at, updated_at",
    )
    .eq("id", params.id)
    .maybeSingle();

  if (!data) notFound();
  const deal = data as DealDetail;

  // Recomputed from the deal's own inputs with the same engine the save path
  // uses, so the figures always reflect the current DEAL_ASSUMPTIONS rather
  // than whatever was stored the last time somebody pressed Save.
  const econ = evaluateDeal(deal);
  const stored = deal.profit === null || deal.profit === undefined ? null : Number(deal.profit);
  const storedDrift = stored === null ? 0 : Math.abs(stored - econ.profit);

  const [confirmationsRes, invoicesRes] = await Promise.all([
    supabase
      .from("production_confirmations")
      .select("id, status, confirmed_by, confirmed_at, production_month, tonnage, issue_flag, issue_reason")
      .eq("deal_id", deal.id)
      .order("production_month", { ascending: false }),
    // invoices.deal_id holds the human deal reference ("WK-2026-001"), not the
    // UUID — it is a plain text column with no foreign key. Match on that.
    supabase
      .from("invoices")
      .select("id, invoice_number, amount_usd, issue_date, due_date, status")
      .eq("deal_id", deal.deal_id)
      .order("issue_date", { ascending: false }),
  ]);

  const confirmations = (confirmationsRes.data ?? []) as ConfirmationRow[];
  const invoices = (invoicesRes.data ?? []) as DealInvoiceRow[];

  return (
    <div className="mx-auto max-w-6xl">
      <BackLink href="/deals" label="Deals" />
      {deal.archived_at && <ArchivedNotice archivedAt={deal.archived_at} label="deal" />}
      <PageHeader
        title={deal.deal_id || deal.name}
        description={deal.deal_id ? deal.name : "Deal"}
        icon={Handshake}
        action={
          <div className="flex items-center gap-2">
            <EditButton domain="deals" href={`/deals/${deal.id}/edit`} />
            <ArchiveButton
              action={toggleArchive.bind(null, "deal", deal.id, !deal.archived_at)}
              domain="deals"
              archived={!!deal.archived_at}
              label="deal"
            />
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <DetailSection title="Deal details">
            <DetailField label="Type" value={<span className="capitalize">{deal.deal_type}</span>} />
            <DetailField label="Status" value={deal.status ? <StatusBadge status={deal.status} /> : null} />
            <DetailField label="Buyer" value={deal.buyer} />
            <DetailField label="Producer" value={deal.producer} />
            <DetailField label="Input product" value={deal.input_product} />
            <DetailField label="Output product" value={deal.output_product} />
            <DetailField label="Discharge port" value={deal.disport} />
            <DetailField
              label="Payment type"
              value={deal.payment_type}
              hint="Funding cost applies when prefunded"
            />
            <DetailField label="Start month" value={monthLabel(deal.start_month, true)} />
            <DetailField label="End month" value={monthLabel(deal.end_month, true)} />
          </DetailSection>

          <DetailSection title="Economics inputs" columns={3}>
            <DetailField label="Tonnes (B100)" value={formatNumber(deal.tonnes)} />
            <DetailField label="Buy price /t" value={formatUSD(deal.buy_price_per_tonne, { decimals: true })} />
            <DetailField label="Sell price /t" value={formatUSD(deal.sell_price_per_tonne, { decimals: true })} />
            <DetailField label="Shipping /t" value={formatUSD(deal.shipping_per_tonne, { decimals: true })} />
            <DetailField label="Trucking /t" value={formatUSD(deal.trucking_per_tonne, { decimals: true })} />
            <DetailField label="Glycerin (byproduct)" value={`${formatNumber(econ.glycerin_tonnes, 1)} t`} />
            <DetailField label="Notes" value={deal.notes} full />
          </DetailSection>

          {confirmations.length > 0 && (
            <DataTable
              title="Production confirmations"
              columns={confirmationColumns}
              rows={confirmations}
              getRowKey={(c) => c.id}
            />
          )}

          {invoices.length > 0 && (
            <DataTable
              title="Invoices"
              columns={invoiceColumns}
              rows={invoices}
              getRowKey={(i) => i.id}
            />
          )}

          <AuditTrail entityType="deal" entityId={deal.id} />

          <p className="text-xs text-slate-400">
            Created {formatDate(deal.created_at)} · last updated {formatDate(deal.updated_at)}
          </p>
        </div>

        <div className="space-y-4">
          <DealEconomicsPanel econ={econ} />
          {storedDrift > 1 && (
            <Card className="border-amber-100 bg-amber-50/60 px-5 py-4 text-[11px] text-amber-800">
              These figures are recomputed from the inputs above. The profit stored when this
              deal was last saved was {formatUSD(stored)}; saving it again brings the stored
              value back in line with the current assumptions.
            </Card>
          )}
          <DealAssumptions />
        </div>
      </div>
    </div>
  );
}

type DealDetail = {
  id: string;
  deal_id: string;
  name: string;
  deal_type: string;
  status: string | null;
  buyer: string;
  input_product: string | null;
  output_product: string | null;
  producer: string | null;
  disport: string | null;
  tonnes: number;
  buy_price_per_tonne: number;
  sell_price_per_tonne: number;
  shipping_per_tonne: number | null;
  trucking_per_tonne: number | null;
  payment_type: string | null;
  profit: number | null;
  archived_at: string | null;
  start_month: string | null;
  end_month: string | null;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type ConfirmationRow = {
  id: string;
  status: string | null;
  confirmed_by: string | null;
  confirmed_at: string | null;
  production_month: string | null;
  tonnage: number | null;
  issue_flag: string | null;
  issue_reason: string | null;
};

type DealInvoiceRow = {
  id: string;
  invoice_number: string;
  amount_usd: number | null;
  issue_date: string;
  due_date: string;
  status: string;
};

const confirmationColumns: Column<ConfirmationRow>[] = [
  {
    key: "production_month",
    header: "Month",
    render: (c) => (
      <span className="font-medium text-slate-900">{monthLabel(c.production_month, true)}</span>
    ),
  },
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

const invoiceColumns: Column<DealInvoiceRow>[] = [
  {
    key: "invoice_number",
    header: "Invoice",
    render: (i) => (
      <Link href={`/finance/invoices/${i.id}`} className="font-medium text-brand-700 hover:underline">
        {i.invoice_number}
      </Link>
    ),
  },
  {
    key: "amount_usd",
    header: "Amount (USD)",
    align: "right",
    render: (i) => formatUSD(i.amount_usd, { decimals: true }),
  },
  { key: "issue_date", header: "Issued", render: (i) => formatDate(i.issue_date) },
  { key: "due_date", header: "Due", render: (i) => formatDate(i.due_date) },
  { key: "status", header: "Status", render: (i) => <StatusBadge status={i.status} /> },
];
