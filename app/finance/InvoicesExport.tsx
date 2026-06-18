"use client";

import ExportExcelButton from "@/components/ExportExcelButton";
import type { ExportColumn } from "@/lib/export-excel";

export type InvoiceExportRow = {
  invoice_number: string;
  buyer: string;
  amount_usd: number | null;
  amount_omr: number | null;
  issue_date: string;
  due_date: string;
  paid_date: string | null;
  status: string;
};

const columns: ExportColumn<InvoiceExportRow>[] = [
  { header: "Invoice", value: (i) => i.invoice_number },
  { header: "Buyer", value: (i) => i.buyer },
  { header: "Amount (USD)", value: (i) => i.amount_usd ?? null },
  { header: "Amount (OMR)", value: (i) => i.amount_omr ?? null },
  { header: "Issued", value: (i) => i.issue_date },
  { header: "Due", value: (i) => i.due_date },
  { header: "Paid", value: (i) => i.paid_date ?? null },
  { header: "Status", value: (i) => i.status },
];

export default function InvoicesExport({ invoices }: { invoices: InvoiceExportRow[] }) {
  return <ExportExcelButton filename="wakud-invoices" sheetName="Invoices" columns={columns} rows={invoices} />;
}
