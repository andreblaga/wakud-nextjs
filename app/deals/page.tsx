import { Suspense } from "react";
import Link from "next/link";
import { Handshake, Plus } from "lucide-react";
import { PageHeader, StatCard } from "@/components/ui";
import { RoleGate } from "@/components/RoleGate";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/DataTable";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth";
import { canWrite } from "@/lib/permissions";
import { formatPercent } from "@/lib/currency";
import { showArchivedFrom, toggleArchivedHref } from "@/lib/archive";
import DealsTable, { type DealRow } from "./DealsTable";

type PageProps = { searchParams: Record<string, string | string[] | undefined> };

export default function DealsPage({ searchParams }: PageProps) {
  const showArchived = showArchivedFrom(searchParams);
  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Deals"
        description="Trade evaluation & deal pipeline"
        icon={Handshake}
        action={
          <RoleGate domain="deals">
            <Link
              href="/deals/new"
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-700 px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-800"
            >
              <Plus className="h-4 w-4" /> New deal
            </Link>
          </RoleGate>
        }
      />
      <Suspense key={String(showArchived)} fallback={<TableSkeleton columns={9} />}>
        <DealsContent
          showArchived={showArchived}
          toggleHref={toggleArchivedHref("/deals", searchParams)}
        />
      </Suspense>
    </div>
  );
}

async function DealsContent({
  showArchived,
  toggleHref,
}: {
  showArchived: boolean;
  toggleHref: string;
}) {
  const supabase = createClient();
  if (!supabase) return <ErrorState message="Supabase isn't configured." />;

  let request = supabase
    .from("deals")
    .select("id, deal_id, name, deal_type, status, buyer, tonnes, profit, margin, profit_per_tonne, archived_at");
  // Archived deals are out of the way by default; the toggle brings them back.
  if (!showArchived) request = request.is("archived_at", null);

  const { data, error } = await request.order("created_at", { ascending: false });

  if (error) return <ErrorState message={error.message} />;

  const user = await getSessionUser();
  const canEdit = canWrite(user?.role, "deals");
  const deals = (data ?? []) as DealRow[];
  // Headline figures describe the live pipeline, whether or not archived deals
  // are on screen — an archived deal is one you have decided not to count.
  const live = deals.filter((d) => !d.archived_at);
  const countBy = (s: string) => live.filter((d) => d.status === s).length;
  const avgMargin = live.length
    ? live.reduce((sum, d) => sum + (Number(d.margin) || 0), 0) / live.length
    : null;

  return (
    <>
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Draft" value={String(countBy("draft"))} />
        <StatCard label="Approved" value={String(countBy("approved"))} />
        <StatCard label="Confirmed" value={String(countBy("confirmed"))} />
        <StatCard label="Avg margin" value={formatPercent(avgMargin, { isFraction: false })} accent />
      </div>

      {deals.length > 0 ? (
        <DealsTable deals={deals} canEdit={canEdit} showArchived={showArchived} toggleArchivedHref={toggleHref} />
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
