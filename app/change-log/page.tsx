import { Suspense } from "react";
import { History } from "lucide-react";
import { PageHeader, StatusBadge } from "@/components/ui";
import { DataTable, EmptyState, ErrorState, TableSkeleton, type Column } from "@/components/DataTable";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/dates";

export default function ChangeLogPage() {
  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Change Log"
        description="Audit trail of every action — completed, added, or removed"
        icon={History}
      />
      <Suspense fallback={<TableSkeleton columns={5} title="Activity" />}>
        <ChangeLogContent />
      </Suspense>
      <p className="mt-4 text-xs text-slate-400">
        Backed by the audit_log table. Automatic population on create / update / delete is
        wired in Phase 3.
      </p>
    </div>
  );
}

type AuditRow = {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  old_value: unknown;
  new_value: unknown;
  created_at: string | null;
};

function timeOf(iso: string | null): string {
  if (!iso) return "";
  const t = iso.split("T")[1];
  return t ? t.slice(0, 5) : "";
}

function changeSummary(row: AuditRow): string {
  const hasOld = row.old_value && typeof row.old_value === "object";
  const hasNew = row.new_value && typeof row.new_value === "object";
  if (!hasOld && hasNew) return "created";
  if (hasOld && !hasNew) return "removed";
  if (hasOld && hasNew) {
    const keys = new Set([
      ...Object.keys(row.old_value as object),
      ...Object.keys(row.new_value as object),
    ]);
    return `${keys.size} field${keys.size === 1 ? "" : "s"} changed`;
  }
  return "—";
}

const columns: Column<AuditRow>[] = [
  {
    key: "created_at",
    header: "When",
    render: (r) => (
      <span className="whitespace-nowrap">
        {formatDate(r.created_at)} <span className="text-slate-400">{timeOf(r.created_at)}</span>
      </span>
    ),
  },
  { key: "user_id", header: "User", render: (r) => (r.user_id ? r.user_id.slice(0, 8) : "system") },
  { key: "action", header: "Action", render: (r) => <StatusBadge status={r.action} /> },
  {
    key: "entity_type",
    header: "Entity",
    render: (r) => (
      <span>
        <span className="font-medium text-slate-900">{r.entity_type}</span>
        {r.entity_id && <span className="ml-1 text-slate-400">#{r.entity_id.slice(0, 8)}</span>}
      </span>
    ),
  },
  { key: "summary", header: "Changes", render: (r) => changeSummary(r) },
];

async function ChangeLogContent() {
  const supabase = createClient();
  if (!supabase) return <ErrorState message="Supabase isn't configured." />;

  const { data, error } = await supabase
    .from("audit_log")
    .select("id, user_id, action, entity_type, entity_id, old_value, new_value, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) return <ErrorState message={error.message} />;
  const rows = (data ?? []) as AuditRow[];

  if (rows.length === 0) {
    return (
      <EmptyState
        title="No activity yet"
        message="Once write flows are live (Phase 3), every create / update / delete will be recorded here."
        icon={History}
      />
    );
  }

  return <DataTable title="Activity" columns={columns} rows={rows} getRowKey={(r) => r.id} />;
}
