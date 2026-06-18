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
