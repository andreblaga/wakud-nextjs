import { Suspense } from "react";
import { ShieldCheck, GitBranch } from "lucide-react";
import { PageHeader, StatCard, Card, StatusBadge } from "@/components/ui";
import { DataTable, EmptyState, ErrorState, TableSkeleton, type Column } from "@/components/DataTable";
import { createClient } from "@/lib/supabase/server";
import { formatPercent, formatNumber } from "@/lib/currency";
import { formatDate } from "@/lib/dates";

export default function ISCCPage() {
  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader title="ISCC Compliance" description="Certificates & feed/product mass balance" icon={ShieldCheck} />
      <Suspense fallback={<TableSkeleton columns={7} title="Certificates" />}>
        <ISCCContent />
      </Suspense>
    </div>
  );
}

type CertRow = {
  id: string;
  entity_name: string;
  certificate_number: string | null;
  scope: string | null;
  issue_date: string | null;
  expiry_date: string | null;
  ghg_savings_percent: number | null;
  status: string | null;
};

const columns: Column<CertRow>[] = [
  { key: "entity_name", header: "Entity", render: (c) => <span className="font-medium text-slate-900">{c.entity_name}</span> },
  { key: "certificate_number", header: "Certificate #" },
  { key: "scope", header: "Scope" },
  { key: "issue_date", header: "Issued", render: (c) => formatDate(c.issue_date) },
  { key: "expiry_date", header: "Expiry", render: (c) => formatDate(c.expiry_date) },
  { key: "ghg_savings_percent", header: "GHG saving", align: "right", render: (c) => formatPercent(c.ghg_savings_percent, { isFraction: false }) },
  { key: "status", header: "Status", render: (c) => (c.status ? <StatusBadge status={c.status} /> : null) },
];

async function ISCCContent() {
  const supabase = createClient();
  if (!supabase) return <ErrorState message="Supabase isn't configured." />;

  const { data, error } = await supabase
    .from("iscc_certificates")
    .select("id, entity_name, certificate_number, scope, issue_date, expiry_date, ghg_savings_percent, status")
    .order("expiry_date", { ascending: true, nullsFirst: false });

  if (error) return <ErrorState message={error.message} />;
  const certs = (data ?? []) as CertRow[];

  const today = new Date().toISOString().slice(0, 10);
  const active = certs.filter((c) => c.status === "active");
  const nextExpiry = active
    .map((c) => c.expiry_date)
    .filter((d): d is string => !!d && d >= today)
    .sort()[0];
  const daysToRenewal = nextExpiry
    ? Math.round((new Date(nextExpiry).getTime() - new Date(today).getTime()) / 86_400_000)
    : null;
  const ghgValues = certs.map((c) => Number(c.ghg_savings_percent)).filter((n) => !Number.isNaN(n));
  const avgGhg = ghgValues.length ? ghgValues.reduce((s, n) => s + n, 0) / ghgValues.length : null;

  return (
    <>
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Active certificates" value={formatNumber(active.length)} />
        <StatCard label="Next renewal" value={daysToRenewal === null ? "—" : String(daysToRenewal)} unit={daysToRenewal === null ? undefined : "days"} accent />
        <StatCard label="Avg GHG saving" value={formatPercent(avgGhg, { isFraction: false })} />
        <StatCard label="Certificates" value={formatNumber(certs.length)} />
      </div>

      <Card className="mb-6 p-5">
        <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-slate-700">
          <GitBranch className="h-4 w-4 text-brand-700" /> Mass balance / chain of custody
        </h2>
        <p className="text-xs text-slate-500">
          Traceability of sustainability characteristics from UCO intake → production batch →
          B100 / glycerol output. The full mass-balance trace is wired in Phase 4 once UCO
          intake and production-batch records land.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
          {["UCO Intake", "→", "Production Batch", "→", "B100 / Glycerol", "→", "Shipment"].map((n, i) => (
            <span
              key={i}
              className={
                n === "→"
                  ? "text-slate-300"
                  : "rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 font-medium text-slate-600"
              }
            >
              {n}
            </span>
          ))}
        </div>
      </Card>

      {certs.length > 0 ? (
        <DataTable title="Certificates" columns={columns} rows={certs} getRowKey={(c) => c.id} />
      ) : (
        <EmptyState title="No certificates yet" message="ISCC certificates will appear here once recorded." icon={ShieldCheck} />
      )}
    </>
  );
}
