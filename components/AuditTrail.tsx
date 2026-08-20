import { Card, StatusBadge } from "@/components/ui";
import { DataTable, type Column } from "@/components/DataTable";
import { createClient } from "@/lib/supabase/server";
import { summarizeChange, type AuditLogRow } from "@/lib/audit";
import { formatDate, timeOfDay } from "@/lib/dates";

const columns: Column<AuditLogRow>[] = [
  {
    key: "created_at",
    header: "When",
    render: (r) => (
      <span className="whitespace-nowrap">
        {formatDate(r.created_at)} <span className="text-slate-400">{timeOfDay(r.created_at)}</span>
      </span>
    ),
  },
  { key: "action", header: "Action", render: (r) => <StatusBadge status={r.action} /> },
  {
    key: "user_id",
    header: "By",
    render: (r) =>
      r.user_id ? (
        <span title={r.user_id} className="font-mono text-xs">
          {r.user_id.slice(0, 8)}
        </span>
      ) : (
        "system"
      ),
  },
  { key: "summary", header: "Changed", render: (r) => summarizeChange(r) },
];

/**
 * Read-only history for one record, straight from audit_log.
 *
 * Runs on the caller's session client so the audit_log SELECT policy applies —
 * every signed-in user may read it, which is the point: an executive_viewer
 * opening a deal should be able to see who last changed it and what they
 * changed, without any write access at all.
 */
export default async function AuditTrail({
  entityType,
  entityId,
  limit = 20,
  title = "History",
}: {
  entityType: string;
  entityId: string;
  limit?: number;
  title?: string;
}) {
  const supabase = createClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("audit_log")
    .select("id, user_id, action, old_value, new_value, created_at")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .order("created_at", { ascending: false })
    .limit(limit);

  // A failed history read must not take the record down with it — the fields
  // above it are the point of the page.
  const rows = error ? [] : ((data ?? []) as AuditLogRow[]);

  if (rows.length === 0) {
    return (
      <Card className="overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-3">
          <h2 className="text-sm font-semibold text-slate-700">{title}</h2>
        </div>
        <p className="px-5 py-4 text-xs text-slate-400">
          {error
            ? "Couldn't load this record's history."
            : "No changes recorded for this record yet."}
        </p>
      </Card>
    );
  }

  return (
    <DataTable
      title={title}
      columns={columns}
      rows={rows}
      getRowKey={(r) => r.id}
      footer={rows.length === limit ? `Showing the ${limit} most recent changes.` : undefined}
    />
  );
}
