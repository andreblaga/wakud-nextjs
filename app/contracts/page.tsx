import { Suspense } from "react";
import Link from "next/link";
import { FileText, Plus } from "lucide-react";
import { PageHeader, StatCard } from "@/components/ui";
import { RoleGate } from "@/components/RoleGate";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/DataTable";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth";
import { canWrite } from "@/lib/permissions";
import { formatNumber, formatUSD } from "@/lib/currency";
import { currentMonthStart } from "@/lib/dates";
import { showArchivedFrom, toggleArchivedHref } from "@/lib/archive";
import ContractsTable, { type ContractRow } from "./ContractsTable";

type PageProps = { searchParams: Record<string, string | string[] | undefined> };

/**
 * Contracts index.
 *
 * Contracts used to render only inside /sales-forecast, which takes no query —
 * so global search had nowhere to send "see all contracts". This is that
 * target, and the way in to each contract's read-only detail page.
 */
export default function ContractsPage({ searchParams }: PageProps) {
  const showArchived = showArchivedFrom(searchParams);
  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Contracts"
        description="Buyer agreements, pricing & committed volume"
        icon={FileText}
        action={
          <RoleGate domain="contracts">
            <Link
              href="/contracts/new"
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-700 px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-800"
            >
              <Plus className="h-4 w-4" /> New contract
            </Link>
          </RoleGate>
        }
      />
      <Suspense key={String(showArchived)} fallback={<TableSkeleton columns={8} />}>
        <ContractsContent
          showArchived={showArchived}
          toggleHref={toggleArchivedHref("/contracts", searchParams)}
        />
      </Suspense>
    </div>
  );
}

async function ContractsContent({
  showArchived,
  toggleHref,
}: {
  showArchived: boolean;
  toggleHref: string;
}) {
  const supabase = createClient();
  if (!supabase) return <ErrorState message="Supabase isn't configured." />;

  const month = currentMonthStart();
  let contractsRequest = supabase
    .from("contracts")
    .select("id, name, buyer, price_per_tonne, is_active, status, start_date, end_date, renewal_date, archived_at");
  if (!showArchived) contractsRequest = contractsRequest.is("archived_at", null);

  const [contractsRes, committedRes] = await Promise.all([
    contractsRequest.order("name", { ascending: true }),
    supabase.from("contract_volumes").select("planned_volume").gte("month", month),
  ]);

  if (contractsRes.error) return <ErrorState message={contractsRes.error.message} />;

  const user = await getSessionUser();
  const canEdit = canWrite(user?.role, "contracts");
  const contracts = (contractsRes.data ?? []) as ContractRow[];
  const committed = (committedRes.data ?? []) as { planned_volume: number | null }[];

  // An archived contract is not an active commitment, however the list is filtered.
  const active = contracts.filter((c) => c.is_active && !c.archived_at);
  const avgPrice = active.length
    ? active.reduce((s, c) => s + (Number(c.price_per_tonne) || 0), 0) / active.length
    : null;
  const committedVolume = committed.reduce((s, r) => s + (Number(r.planned_volume) || 0), 0);

  return (
    <>
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Contracts" value={String(contracts.filter((c) => !c.archived_at).length)} />
        <StatCard label="Active" value={String(active.length)} />
        <StatCard label="Avg price (active)" value={formatUSD(avgPrice)} unit="/t" />
        <StatCard
          label="Committed volume"
          value={formatNumber(committedVolume)}
          unit="t"
          hint="from this month on"
          accent
        />
      </div>

      {contracts.length > 0 ? (
        <ContractsTable
          contracts={contracts}
          canEdit={canEdit}
          showArchived={showArchived}
          toggleArchivedHref={toggleHref}
        />
      ) : (
        <EmptyState
          title="No contracts yet"
          message="Buyer agreements will appear here once they are recorded."
          icon={FileText}
        />
      )}
    </>
  );
}
