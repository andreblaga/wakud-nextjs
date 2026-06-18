import { Suspense } from "react";
import { Handshake, Plus } from "lucide-react";
import { PageHeader, StatCard } from "@/components/ui";
import { RoleGate } from "@/components/RoleGate";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/DataTable";
import { createClient } from "@/lib/supabase/server";
import { formatPercent } from "@/lib/currency";
import DealsTable, { type DealRow } from "./DealsTable";

export default function DealsPage() {
  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Deals"
        description="Trade evaluation & deal pipeline"
        icon={Handshake}
        action={
          <RoleGate domain="deals">
            <button className="inline-flex items-center gap-1.5 rounded-lg bg-brand-700 px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-800">
              <Plus className="h-4 w-4" /> New deal
            </button>
          </RoleGate>
        }
      />
      <Suspense fallback={<TableSkeleton columns={9} />}>
        <DealsContent />
      </Suspense>
    </div>
  );
}

async function DealsContent() {
  const supabase = createClient();
  if (!supabase) return <ErrorState message="Supabase isn't configured." />;

  const { data, error } = await supabase
    .from("deals")
    .select("id, deal_id, name, deal_type, status, buyer, tonnes, profit, margin, profit_per_tonne")
    .order("created_at", { ascending: false });

  if (error) return <ErrorState message={error.message} />;

  const deals = (data ?? []) as DealRow[];
  const countBy = (s: string) => deals.filter((d) => d.status === s).length;
  const avgMargin = deals.length
    ? deals.reduce((sum, d) => sum + (Number(d.margin) || 0), 0) / deals.length
    : null;

  return (
    <>
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Draft" value={String(countBy("draft"))} />
        <StatCard label="Approved" value={String(countBy("approved"))} />
        <StatCard label="Confirmed" value={String(countBy("confirmed"))} />
        <StatCard label="Avg margin" value={formatPercent(avgMargin)} accent />
      </div>

      {deals.length > 0 ? (
        <DealsTable deals={deals} />
      ) : (
        <EmptyState
          title="No deals yet"
          message="Create a deal, or import existing ones via supabase/data-templates/deals.csv."
          icon={Handshake}
        />
      )}
    </>
  );
}
