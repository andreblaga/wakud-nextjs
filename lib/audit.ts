import type { Database, Json } from "@/lib/supabase/types";
import type { ServerSupabaseClient } from "@/lib/supabase/server";

type Client = ServerSupabaseClient;
type AuditInsert = Database["public"]["Tables"]["audit_log"]["Insert"];

export type AuditAction = "create" | "update" | "delete";

/**
 * Shared server helper: record one row in audit_log for a write.
 *
 * Chosen over DB triggers so the acting user (auth.uid via the request's
 * Supabase client) and a clean before/after diff are captured at the
 * application layer where we already have them. Call from every server action
 * after a successful insert/update/delete.
 *
 * Non-fatal: a failed audit insert is logged but does not roll back the action
 * (the write already succeeded). Requires the audit_log INSERT policy from
 * supabase/phase3-audit-log-policy.sql.
 */
export async function logAudit(
  supabase: Client,
  params: {
    userId: string | null;
    action: AuditAction;
    entityType: string;
    entityId?: string | null;
    oldValue?: unknown;
    newValue?: unknown;
  },
): Promise<void> {
  const row: AuditInsert = {
    user_id: params.userId,
    action: params.action,
    entity_type: params.entityType,
    entity_id: params.entityId ?? null,
    old_value: (params.oldValue ?? null) as Json,
    new_value: (params.newValue ?? null) as Json,
  };
  // Cast at the boundary: supabase-js/ssr generic skew types .insert() param as
  // `never`; `row` above is still checked against the real Insert type.
  const { error } = await supabase.from("audit_log").insert(row as never);
  if (error) {
    // eslint-disable-next-line no-console
    console.error(`audit_log insert failed (${params.action} ${params.entityType}):`, error.message);
  }
}

// ----------------------------------------------------------------------------
// Reading the log back — shared by /change-log and the per-record history on
// each detail page.
// ----------------------------------------------------------------------------

/** One audit_log row as the read views select it. */
export type AuditLogRow = {
  id: string;
  user_id: string | null;
  action: string;
  entity_type?: string;
  entity_id?: string | null;
  old_value: unknown;
  new_value: unknown;
  created_at: string | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || a === undefined) return b === null || b === undefined;
  if (b === null || b === undefined) return false;
  if (typeof a === "boolean" || typeof b === "boolean") return false;
  if (typeof a === "object" || typeof b === "object") {
    return JSON.stringify(a) === JSON.stringify(b);
  }
  // DECIMAL columns come back as numbers on one side and can be numeric strings
  // on the other, so compare numerically before falling back to text — 5000 and
  // "5000" are not a change anybody wants to read about.
  const na = Number(a);
  const nb = Number(b);
  if (a !== "" && b !== "" && !Number.isNaN(na) && !Number.isNaN(nb)) return na === nb;
  return String(a) === String(b);
}

/**
 * Field names whose value actually changed between the two snapshots.
 *
 * Only fields carried by `newValue` are considered: logAudit stores the whole
 * existing row as `old_value` (a `SELECT *`, generated columns and all) but
 * only the update payload as `new_value`, so a key missing from the payload
 * was never touched rather than removed.
 */
export function changedFields(oldValue: unknown, newValue: unknown): string[] {
  const before = asRecord(oldValue);
  const after = asRecord(newValue);
  if (!after) return [];
  if (!before) return Object.keys(after);
  return Object.keys(after).filter((k) => !sameValue(before[k], after[k]));
}

/** One-line description of what an audit row did, for a table cell. */
export function summarizeChange(row: Pick<AuditLogRow, "old_value" | "new_value">): string {
  const before = asRecord(row.old_value);
  const after = asRecord(row.new_value);
  if (!before && after) return "created";
  if (before && !after) return "removed";
  if (!before && !after) return "—";

  const fields = changedFields(row.old_value, row.new_value);
  if (fields.length === 0) return "no field changed";
  if (fields.length <= 3) return fields.join(", ");
  return `${fields.slice(0, 3).join(", ")} +${fields.length - 3} more`;
}
