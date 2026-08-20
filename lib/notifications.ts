import type { ServerSupabaseClient } from "@/lib/supabase/server";
import { detectReorderFlags } from "@/lib/reorder";
import { feedbackWithNewReplies, canTriageFeedback, type CommentStamp } from "@/lib/feedback";
import type { SessionUser } from "@/lib/permissions";
import { formatDate } from "@/lib/dates";

export type NotificationType = "order" | "stock" | "deal" | "alert" | "feedback";
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
 *   - feedback (see below) — needs `viewer`, since those two are per-person
 * De-duped (a live low-stock item supersedes its raised reorder alert), sorted
 * by severity then urgency, capped at `limit`.
 *
 * The two feedback items follow the same no-stored-state principle as the rest
 * of this file, which is what keeps it from going stale:
 *   - admin/gm see anything still sitting at status "new" and unarchived
 *   - a submitter sees their own items whose newest comment is by somebody else
 *     and newer than anything they have said on it. That is derivable from the
 *     timestamps alone, so there is no per-user read-state table to maintain —
 *     and nothing that can drift out of step with the conversation.
 *
 * Single source of truth for the TopBar bell, the dashboard card, and /alerts.
 */
export async function getNotifications(
  supabase: ServerSupabaseClient,
  limit = 20,
  viewer?: SessionUser | null,
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

  const feedbackItems = await getFeedbackNotifications(supabase, viewer);

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

  // 3b. Feedback: replies waiting on the viewer, then anything needing triage.
  // Replies are pushed first so that on the rare item that is both (an admin's
  // own request, still "new", already answered by someone else) the bell shows
  // the thing that actually happened rather than the standing state.
  for (const f of feedbackItems) push(f);

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

type FeedbackNotification = Notification & { dedupeKey: string; urgencyScore: number };

/**
 * Feedback items worth telling this viewer about.
 *
 * Both kinds share the `feedback:<id>` dedupe key, so one item never appears
 * twice in the same bell — consistent with how a live low-stock reading
 * supersedes the reorder alert raised for the same product.
 */
async function getFeedbackNotifications(
  supabase: ServerSupabaseClient,
  viewer: SessionUser | null | undefined,
): Promise<FeedbackNotification[]> {
  if (!viewer) return [];
  const now = Date.now();
  const out: FeedbackNotification[] = [];

  const ageDays = (iso: string | null | undefined) =>
    iso ? (now - new Date(iso).getTime()) / DAY : 0;

  // Replies on the viewer's own items, waiting for them.
  const { data: mine } = await supabase
    .from("feedback")
    .select("id, title")
    .eq("submitted_by", viewer.id)
    .is("archived_at", null);

  const own = (mine ?? []) as { id: string; title: string }[];
  if (own.length > 0) {
    const { data: commentData } = await supabase
      .from("feedback_comments")
      .select("feedback_id, author_id, created_at")
      .in("feedback_id", own.map((f) => f.id));

    const titles = new Map(own.map((f) => [f.id, f.title]));
    const waiting = feedbackWithNewReplies(
      viewer.id,
      titles.keys(),
      (commentData ?? []) as CommentStamp[],
    );

    for (const w of waiting) {
      out.push({
        id: `feedback-reply-${w.feedbackId}`,
        type: "feedback",
        severity: "info",
        title: `New reply: ${titles.get(w.feedbackId) ?? "your feedback"}`,
        detail: `Someone replied to your feedback · ${formatDate(w.latestReplyAt)}`,
        href: `/feedback/${w.feedbackId}`,
        date: w.latestReplyAt,
        dedupeKey: `feedback:${w.feedbackId}`,
        urgencyScore: ageDays(w.latestReplyAt),
      });
    }
  }

  // Untriaged feedback, for whoever can act on it.
  if (canTriageFeedback(viewer.role)) {
    const { data: untriaged } = await supabase
      .from("feedback")
      .select("id, title, category, created_at")
      .eq("status", "new")
      .is("archived_at", null)
      .order("created_at", { ascending: false });

    for (const f of (untriaged ?? []) as {
      id: string; title: string; category: string | null; created_at: string;
    }[]) {
      out.push({
        id: `feedback-triage-${f.id}`,
        type: "feedback",
        severity: "info",
        title: `Feedback needs triage: ${f.title}`,
        detail: `${f.category ?? "uncategorised"} · raised ${formatDate(f.created_at)}`,
        href: `/feedback/${f.id}`,
        date: f.created_at,
        dedupeKey: `feedback:${f.id}`,
        urgencyScore: ageDays(f.created_at),
      });
    }
  }

  return out;
}
