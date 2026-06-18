import type { ServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import { currentMonthStart } from "@/lib/dates";

type AlertInsert = Database["public"]["Tables"]["system_alerts"]["Insert"];

export type ReorderResult = { raised: number; flagged: string[] };

/**
 * Reorder check: flag products whose latest stock is below safety — or is
 * projected to fall below after the next planned month's consumption — and
 * raise a system_alert for each, considering supplier lead times. Skips
 * products that already have an open reorder alert (no duplicates).
 *
 * Runs after a stock save and from the "Run reorder check" action on Inventory.
 */
export async function evaluateReorder(supabase: ServerSupabaseClient): Promise<ReorderResult> {
  const month = currentMonthStart();

  const [stockRes, planRes, orderRes, alertRes] = await Promise.all([
    supabase.from("stock_levels").select("product, month, closing_stock, safety_stock_level").order("month", { ascending: false }),
    supabase.from("production_plan").select("month, uco_consumed").gte("month", month).order("month", { ascending: true }),
    supabase.from("raw_material_orders").select("material, lead_time_days, status").in("status", ["pending", "ordered"]),
    supabase.from("system_alerts").select("related_entity_id").eq("category", "inventory").eq("alert_type", "reorder").eq("is_resolved", false),
  ]);

  const stock = (stockRes.data ?? []) as { product: string; month: string; closing_stock: number | null; safety_stock_level: number | null }[];
  const plans = (planRes.data ?? []) as { month: string; uco_consumed: number | null }[];
  const orders = (orderRes.data ?? []) as { material: string; lead_time_days: number | null }[];
  const existing = new Set(
    ((alertRes.data ?? []) as { related_entity_id: string | null }[]).map((a) => a.related_entity_id),
  );

  // Latest stock row per product (rows are month-descending).
  const latest = new Map<string, { closing: number; safety: number }>();
  for (const s of stock) {
    if (!latest.has(s.product)) {
      latest.set(s.product, { closing: Number(s.closing_stock) || 0, safety: Number(s.safety_stock_level) || 0 });
    }
  }

  // Next planned month's UCO consumption (forward-looking shortfall for UCO).
  const nextUcoConsumption = plans.length ? Number(plans[0].uco_consumed) || 0 : 0;

  // Shortest open-order lead time per material.
  const leadByMaterial = new Map<string, number>();
  for (const o of orders) {
    const d = Number(o.lead_time_days) || 0;
    const cur = leadByMaterial.get(o.material);
    if (cur === undefined || d < cur) leadByMaterial.set(o.material, d);
  }

  const toRaise: AlertInsert[] = [];
  const flagged: string[] = [];

  for (const [product, { closing, safety }] of Array.from(latest.entries())) {
    const consumption = product.toUpperCase() === "UCO" ? nextUcoConsumption : 0;
    const projected = closing - consumption;
    const below = closing < safety;
    const projectedBelow = projected < safety;
    if (!below && !projectedBelow) continue;
    if (existing.has(product)) continue; // already alerted, not resolved

    const critical = closing <= 0 || projected <= 0;
    const leadDays = leadByMaterial.get(product);
    const basis = below
      ? `at ${closing} t (safety ${safety} t)`
      : `projected ${projected} t after ${consumption} t consumption (safety ${safety} t)`;

    toRaise.push({
      alert_type: "reorder",
      severity: critical ? "critical" : "warning",
      title: `Reorder ${product}`,
      description: `${product} ${basis}.${leadDays !== undefined ? ` Supplier lead time ~${leadDays}d.` : ""}`,
      category: "inventory",
      related_entity_type: "stock_product",
      related_entity_id: product,
    });
    flagged.push(product);
  }

  if (toRaise.length > 0) {
    await supabase.from("system_alerts").insert(toRaise as never);
  }

  return { raised: toRaise.length, flagged };
}
