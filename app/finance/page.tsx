import { Wallet, FileDown } from "lucide-react";
import { PageHeader, StatCard, PlaceholderPanel } from "@/components/ui";

export default function FinancePage() {
  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Finance"
        description="Invoices & finance exports"
        icon={Wallet}
        action={
          <button className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            <FileDown className="h-4 w-4" /> Export to Excel
          </button>
        }
      />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Outstanding" value="$420k" hint="3 invoices" />
        <StatCard label="Paid (mo)" value="$1.1M" />
        <StatCard label="Overdue" value="$0" accent />
        <StatCard label="USD → OMR" value="0.385" hint="fixed peg" />
      </div>
      <PlaceholderPanel
        title="Invoices"
        columns={["Invoice", "Buyer", "Amount (USD)", "Amount (OMR)", "Issued", "Due", "Status"]}
      />
    </div>
  );
}
