import { Suspense } from "react";
import Link from "next/link";
import { Wallet, Plus, Pencil } from "lucide-react";
import { PageHeader, StatCard, StatusBadge } from "@/components/ui";
import { RoleGate } from "@/components/RoleGate";
import InvoicesExport from "./InvoicesExport";
import { DataTable, EmptyState, ErrorState, TableSkeleton, type Column } from "@/components/DataTable";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth";
import { canWrite } from "@/lib/permissions";
import { formatUSD, formatOMR, USD_TO_OMR } from "@/lib/currency";
import { formatDate, currentMonthStart } from "@/lib/dates";
import { showArchivedFrom, toggleArchivedHref } from "@/lib/archive";
import { ShowArchivedToggle } from "@/components/ShowArchivedToggle";

type PageProps = { searchParams: Record<string, string | string[] | undefined> };

export default function FinancePage({ searchParams }: PageProps) {
  const showArchived = showArchivedFrom(searchParams);
  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Finance"
        description="Invoices & finance exports"
        icon={Wallet}
        action={
          <RoleGate domain="finance">
            <Link href="/finance/invoices/new" className="inline-flex items-center gap-1.5 rounded-lg bg-brand-700 px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-800">
              <Plus className="h-4 w-4" /> New invoice
            </Link>
          </RoleGate>
        }
      />
      <Suspense key={String(showArchived)} fallback={<TableSkeleton columns={7} title="Invoices" />}>
        <FinanceContent
          showArchived={showArchived}
          toggleHref={toggleArchivedHref("/finance", searchParams)}
        />
      </Suspense>
    </div>
  );
}

type InvoiceRow = {
  id: string;
  invoice_number: string;
  buyer: string;
  amount_usd: number | null;
  amount_omr: number | null;
  issue_date: string;
  due_date: string;
  paid_date: string | null;
  status: string;
  archived_at: string | null;
};
type ExportRow = {
  id: string;
  month: string;
  export_type: string;
  exported_at: string | null;
  sent_to_finance: boolean | null;
  finance_acknowledged: boolean | null;
};

const PAID = new Set(["paid", "cancelled"]);

const invoiceColumns: Column<InvoiceRow>[] = [
  {
    key: "invoice_number",
    header: "Invoice",
    render: (i) => (
      <span className="flex items-center gap-2">
        <Link href={`/finance/invoices/${i.id}`} className="font-medium text-slate-900 hover:text-brand-700 hover:underline">
          {i.invoice_number}
        </Link>
        {i.archived_at && <StatusBadge status="archived" />}
      </span>
    ),
  },
  { key: "buyer", header: "Buyer" },
  { key: "amount_usd", header: "Amount (USD)", align: "right", render: (i) => formatUSD(i.amount_usd, { decimals: true }) },
  { key: "amount_omr", header: "Amount (OMR)", align: "right", render: (i) => formatOMR(i.amount_omr) },
  { key: "issue_date", header: "Issued", render: (i) => formatDate(i.issue_date) },
  { key: "due_date", header: "Due", render: (i) => formatDate(i.due_date) },
  { key: "status", header: "Status", render: (i) => <StatusBadge status={i.status} /> },
];

const exportColumns: Column<ExportRow>[] = [
  { key: "month", header: "Month", render: (e) => formatDate(e.month) },
  { key: "export_type", header: "Type" },
  { key: "exported_at", header: "Exported", render: (e) => formatDate(e.exported_at) },
  { key: "sent_to_finance", header: "Sent", render: (e) => (e.sent_to_finance ? "Yes" : "No") },
  { key: "finance_acknowledged", header: "Acknowledged", render: (e) => (e.finance_acknowledged ? "Yes" : "No") },
];

async function FinanceContent({
  showArchived,
  toggleHref,
}: {
  showArchived: boolean;
  toggleHref: string;
}) {
  const supabase = createClient();
  if (!supabase) return <ErrorState message="Supabase isn't configured." />;

  let invoicesRequest = supabase
    .from("invoices")
    .select("id, invoice_number, buyer, amount_usd, amount_omr, issue_date, due_date, paid_date, status, archived_at");
  if (!showArchived) invoicesRequest = invoicesRequest.is("archived_at", null);

  const [invoicesRes, exportsRes] = await Promise.all([
    invoicesRequest.order("issue_date", { ascending: false }),
    supabase
      .from("finance_exports")
      .select("id, month, export_type, exported_at, sent_to_finance, finance_acknowledged")
      .order("exported_at", { ascending: false })
      .limit(10),
  ]);

  const firstError = invoicesRes.error || exportsRes.error;
  if (firstError) return <ErrorState message={firstError.message} />;

  const invoices = (invoicesRes.data ?? []) as InvoiceRow[];
  const exports = (exportsRes.data ?? []) as ExportRow[];

  const user = await getSessionUser();
  const invoiceCols = canWrite(user?.role, "finance")
    ? [
        ...invoiceColumns,
        {
          key: "edit",
          header: "",
          align: "right",
          render: (i: InvoiceRow) => (
            <Link href={`/finance/invoices/${i.id}/edit`} className="inline-flex text-slate-400 hover:text-brand-700" aria-label="Edit">
              <Pencil className="h-4 w-4" />
            </Link>
          ),
        } satisfies Column<InvoiceRow>,
      ]
    : invoiceColumns;

  const month = currentMonthStart();
  const today = new Date().toISOString().slice(0, 10);

  // Money owed is money owed on live invoices. An archived invoice has been
  // taken out of the picture deliberately, so it never counts here — whether or
  // not the table below is currently showing it.
  const live = invoices.filter((i) => !i.archived_at);
  const outstanding = live
    .filter((i) => !PAID.has(i.status))
    .reduce((s, i) => s + (Number(i.amount_usd) || 0), 0);
  const paidThisMonth = live
    .filter((i) => i.status === "paid" && (i.paid_date ?? "") >= month)
    .reduce((s, i) => s + (Number(i.amount_usd) || 0), 0);
  const overdue = live
    .filter((i) => !PAID.has(i.status) && i.due_date < today)
    .reduce((s, i) => s + (Number(i.amount_usd) || 0), 0);

  return (
    <>
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Outstanding" value={formatUSD(outstanding)} hint="unpaid invoices" />
        <StatCard label="Paid (this month)" value={formatUSD(paidThisMonth)} />
        <StatCard label="Overdue" value={formatUSD(overdue)} accent />
        <StatCard label="USD → OMR" value={USD_TO_OMR.toFixed(3)} hint="fixed peg" />
      </div>

      {invoices.length > 0 ? (
        <>
          <div className="mb-3 flex items-center justify-end gap-2">
            <ShowArchivedToggle href={toggleHref} showArchived={showArchived} />
            <InvoicesExport invoices={invoices} />
          </div>
          <DataTable
            title="Invoices"
            columns={invoiceCols}
            rows={invoices}
            getRowKey={(i) => i.id}
            rowClassName={(i) => (i.archived_at ? "opacity-55" : "")}
          />
        </>
      ) : (
        <EmptyState title="No invoices yet" message="Invoices will appear here once raised." icon={Wallet} />
      )}

      {exports.length > 0 && (
        <div className="mt-6">
          <DataTable title="Finance exports" columns={exportColumns} rows={exports} getRowKey={(e) => e.id} />
        </div>
      )}
    </>
  );
}
