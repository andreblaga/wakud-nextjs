import { ShieldCheck, GitBranch } from "lucide-react";
import { PageHeader, StatCard, PlaceholderPanel, Card } from "@/components/ui";

export default function ISCCPage() {
  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="ISCC Compliance"
        description="Certificates & feed/product mass balance"
        icon={ShieldCheck}
      />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Active certificates" value="3" />
        <StatCard label="Next renewal" value="45" unit="days" accent />
        <StatCard label="Avg GHG saving" value="83%" />
        <StatCard label="Open audit items" value="0" />
      </div>

      <Card className="mb-6 p-5">
        <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-slate-700">
          <GitBranch className="h-4 w-4 text-brand-700" /> Mass balance / chain of custody
        </h2>
        <p className="text-xs text-slate-500">
          Traceability of sustainability characteristics from UCO intake → production
          batch → B100 / glycerol output. This is the core ISCC accountability view —
          to be wired to UCO intake and production batch records.
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

      <PlaceholderPanel
        title="Certificates"
        columns={["Entity", "Certificate #", "Scope", "Issued", "Expiry", "GHG saving", "Status"]}
      />
    </div>
  );
}
