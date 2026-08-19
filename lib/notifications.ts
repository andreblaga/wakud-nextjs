import type { ServerSupabaseClient } from "@/lib/supabase/server";
import { detectReorderFlags } from "@/lib/reorder";
import { formatDate } from "@/lib/dates";

export type NotificationType = "order" | "stock" | "deal" | "alert";
export type NotificationSeverity = "critical" | "warning" | "info";

export type Notification = {
  id: string;
  type: NotificationType;
  title: string;
  detail: string;
  href: string;
  date: string | null;
  severity: NotificationSeverity;
};

const SEVERITY_RANK: Record<NotificationSeverity, number> = { critical: 0, warning: 1, info: 2 };
const DAY = 86_400_000;

/**
 * Gather live "what needs attention" items from current data — never relies on a
 * cron or a pre-populated table, so it can't go stale:
 *   - upcoming/overdue raw-material orders (next 14 days)
 *   - low stock (reuses detectReorderFlags from lib/reorder.ts)
 *   - stock whose unit differs from its safety level, which blocks that check
 *   - deals created in the last 7 days
 *   - any unresolved system_alerts (explicitly raised)
 * De-duped (a live low-stock item supersedes its raised reorder alert), sorted
 * by severity then urgency, capped at `limit`.
 *
 * Single source of truth for the TopBar bell, the dashboard card, and /alerts.
 */
export async function getNotifications(
  supabase: ServerSupabaseClient,
  limit = 20,
): Promise<Notification[]> {
  const now = Date.now();
  const today = new Date(now).toISOString().slice(0, 10);
  const in14 = new Date(now + 14 * DAY).toISOString().slice(0, 10);
  const since7 = new Date(now - 7 * DAY).toISOString();

  const [{ flags, mismatches }, ordersRes, dealsRes, alertsRes] = await Promise.all([
    detectReorderFlags(supabase),
    supabase
      .from("raw_material_orders")
      .select("id, material, supplier, status, required_by, expected_delivery")
      .in("status", ["pending", "ordered"]),
    supabase
      .from("deals")
      .select("id, deal_id, name, buyer, created_at")
      .gte("created_at", since7)
      .order("created_at", { ascending: false }),
    supabase
      .from("system_alerts")
      .select("id, alert_type, title, description, severity, category, related_entity_id, created_at")
      .eq("is_resolved", false)
      .order("created_at", { ascending: false }),
  ]);

  const orders = (ordersRes.data ?? []) as {
    id: string; material: string; supplier: string | null; status: string | null;
    required_by: string | null; expected_delivery: string | null;
  }[];
  const deals = (dealsRes.data ?? []) as {
    id: string; deal_id: string; name: string; buyer: string; created_at: string | null;
  }[];
  const alerts = (alertsRes.data ?? []) as {
    id: string; alert_type: string; title: string; description: string; severity: string;
    category: string | null; related_entity_id: string | null; created_at: string | null;
  }[];

  // urgencyScore: lower = more urgent (overdue/soonest/most-recent first).
  const items: (Notification & { dedupeKey: string; urgencyScore: number })[] = [];
  const seen = new Set<string>();
  const push = (n: Notification & { dedupeKey: string; urgencyScore: number }) => {
    if (seen.has(n.dedupeKey)) return;
    seen.add(n.dedupeKey);
    items.push(n);
  };

  // 1. Upcoming / overdue orders (relevant date = required_by, else expected_delivery)
  for (const o of orders) {
    const due = o.required_by ?? o.expected_delivery;
    if (!due || due > in14) continue;
    const overdue = due < today;
    push({
      id: o.id,
      type: "order",
      severity: overdue ? "critical" : "warning",
      title: `${o.material} order ${overdue ? "overdue" : "due soon"}`,
      detail: `${o.supplier || "supplier TBD"} · ${o.status} · ${overdue ? "was due" : "due"} ${formatDate(due)}`,
      href: "/inventory",
      date: due,
      dedupeKey: `order:${o.id}`,
      urgencyScore: (new Date(due).getTime() - now) / DAY,
    });
  }

  // 2. Low stock (reuse reorder detection) — takes priority over a raised reorder alert
  for (const f of flags) {
    push({
      id: `stock-${f.product}`,
      type: "stock",
      severity: f.critical ? "critical" : "warning",
      title: `Low stock: ${f.product}`,
      detail: `${f.product} ${f.basis}${f.leadDays !== undefined ? ` · lead ~${f.leadDays}d` : ""}`,
      href: "/inventory",
      date: null,
      dedupeKey: `stock:${f.product}`,
      urgencyScore: 0,
    });
  }

  // 2b. Stock whose unit differs from its safety level — no low-stock judgement
  // was possible, so say that rather than staying silent about the product.
  for (const m of mismatches) {
    push({
      id: `stock-units-${m.product}`,
      type: "stock",
      severity: "warning",
      title: `Units differ: ${m.product}`,
      detail: `${m.product} ${m.basis} — no below-safety check ran`,
      href: "/inventory",
      date: null,
      dedupeKey: `stock:${m.product}`,
      urgencyScore: 0,
    });
  }

  // 3. New deals (last 7 days)
  for (const d of deals) {
    const ageDays = d.created_at ? (now - new Date(d.created_at).getTime()) / DAY : 7;
    push({
      id: d.id,
      type: "deal",
      severity: "info",
      title: `New deal: ${d.deal_id}`,
      detail: `${d.name} · ${d.buyer}`,
      href: "/deals",
      date: d.created_at,
      dedupeKey: `deal:${d.id}`,
      urgencyScore: ageDays,
    });
  }

  // 4. Explicitly raised, unresolved alerts
  for (const a of alerts) {
    const severity: NotificationSeverity =
      a.severity === "critical" ? "critical" : a.severity === "info" ? "info" : "warning";
    // A reorder or unit_mismatch alert for a product collides with the live
    // low-stock / units-differ item above; the live one wins.
    const dedupeKey =
      (a.alert_type === "reorder" || a.alert_type === "unit_mismatch") && a.related_entity_id
        ? `stock:${a.related_entity_id}`
        : `alert:${a.id}`;
    const ageDays = a.created_at ? (now - new Date(a.created_at).getTime()) / DAY : 0;
    push({
      id: a.id,
      type: "alert",
      severity,
      title: a.title,
      detail: a.description,
      href: a.category === "inventory" ? "/inventory" : "/",
      date: a.created_at,
      dedupeKey,
      urgencyScore: ageDays,
    });
  }

  items.sort((a, b) => {
    const r = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
    if (r !== 0) return r;
    return a.urgencyScore - b.urgencyScore;
  });

  return items.slice(0, limit).map(({ dedupeKey: _k, urgencyScore: _u, ...n }) => n);
}
