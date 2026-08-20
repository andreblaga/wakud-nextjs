import Link from "next/link";
import { notFound } from "next/navigation";
import { Wallet } from "lucide-react";
import {
  BackLink,
  DetailField,
  DetailSection,
  PageHeader,
  StatusBadge,
} from "@/components/ui";
import { ErrorState } from "@/components/DataTable";
import { EditButton } from "@/components/EditButton";
import ArchiveButton from "@/components/ArchiveButton";
import { ArchivedNotice } from "@/components/ArchivedNotice";
import AuditTrail from "@/components/AuditTrail";
import { toggleArchive } from "@/app/archive/actions";
import { createClient } from "@/lib/supabase/server";
import { formatOMR, formatUSD, USD_TO_OMR } from "@/lib/currency";
import { formatDate } from "@/lib/dates";

const SETTLED = new Set(["paid", "cancelled"]);

/**
 * Read-only view of one invoice.
 *
 * amount_omr is a generated column (amount_usd × the fixed peg) — read, never
 * recomputed here, so the page and the database can never disagree.
 */
export default async function InvoiceDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  if (!supabase) {
    return (
      <div className="mx-auto max-w-4xl">
        <ErrorState message="Supabase isn't configured." />
      </div>
    );
  }

  const { data } = await supabase
    .from("invoices")
    .select(
      "id, invoice_number, deal_id, buyer, amount_usd, amount_omr, issue_date, due_date, paid_date, status, payment_method, notes, archived_at, created_at",
    )
    .eq("id", params.id)
    .maybeSingle();

  if (!data) notFound();
  const invoice = data as InvoiceDetail;

  // invoices.deal_id is the human deal reference as text, with no foreign key,
  // so it may name a deal that does not exist in the app. Look it up to decide
  // whether the reference can be a link.
  const { data: dealData } = invoice.deal_id
    ? await supabase.from("deals").select("id, name").eq("deal_id", invoice.deal_id).maybeSingle()
    : { data: null };
  const deal = dealData as { id: string; name: string } | null;

  const today = new Date().toISOString().slice(0, 10);
  const overdue = !SETTLED.has(invoice.status) && invoice.due_date < today;

  return (
    <div className="mx-auto max-w-4xl">
      <BackLink href="/finance" label="Finance" />
      {invoice.archived_at && <ArchivedNotice archivedAt={invoice.archived_at} label="invoice" />}
      <PageHeader
        title={invoice.invoice_number}
        description={invoice.buyer}
        icon={Wallet}
        action={
          <div className="flex items-center gap-2">
            <EditButton domain="finance" href={`/finance/invoices/${invoice.id}/edit`} />
            <ArchiveButton
              action={toggleArchive.bind(null, "invoice", invoice.id, !invoice.archived_at)}
              domain="finance"
              archived={!!invoice.archived_at}
              label="invoice"
            />
          </div>
        }
      />

      <div className="space-y-4">
        <DetailSection title="Invoice">
          <DetailField label="Buyer" value={invoice.buyer} />
          <DetailField
            label="Deal"
            value={
              deal ? (
                <Link href={`/deals/${deal.id}`} className="font-medium text-brand-700 hover:underline">
                  {invoice.deal_id} — {deal.name}
                </Link>
              ) : (
                invoice.deal_id
              )
            }
            hint={invoice.deal_id && !deal ? "No deal in the app carries this reference" : undefined}
          />
          <DetailField label="Amount (USD)" value={formatUSD(invoice.amount_usd, { decimals: true })} />
          <DetailField
            label="Amount (OMR)"
            value={formatOMR(invoice.amount_omr)}
            hint={`Fixed peg, ${USD_TO_OMR.toFixed(3)}`}
          />
          <DetailField
            label="Status"
            value={<StatusBadge status={invoice.status} />}
          />
          <DetailField label="Payment method" value={invoice.payment_method} />
          <DetailField label="Issued" value={formatDate(invoice.issue_date)} />
          <DetailField
            label="Due"
            value={
              overdue ? (
                <span className="font-medium text-red-700">{formatDate(invoice.due_date)}</span>
              ) : (
                formatDate(invoice.due_date)
              )
            }
            hint={overdue ? "Overdue and unpaid" : undefined}
          />
          <DetailField label="Paid" value={formatDate(invoice.paid_date)} />
          <DetailField label="Notes" value={invoice.notes} full />
        </DetailSection>

        <AuditTrail entityType="invoice" entityId={invoice.id} />

        <p className="text-xs text-slate-400">Created {formatDate(invoice.created_at)}</p>
      </div>
    </div>
  );
}

type InvoiceDetail = {
  id: string;
  invoice_number: string;
  deal_id: string | null;
  buyer: string;
  amount_usd: number | null;
  amount_omr: number | null;
  issue_date: string;
  due_date: string;
  paid_date: string | null;
  status: string;
  payment_method: string | null;
  archived_at: string | null;
  notes: string | null;
  created_at: string | null;
};
