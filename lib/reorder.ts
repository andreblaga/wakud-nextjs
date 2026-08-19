import type { ServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import { currentMonthStart } from "@/lib/dates";
import { DEFAULT_STOCK_UNIT, unitLabel } from "@/lib/units";

type AlertInsert = Database["public"]["Tables"]["system_alerts"]["Insert"];

export type ReorderResult = { raised: number; flagged: string[]; mismatched: string[] };

/** One product flagged as below (or projected below) its safety stock level. */
export type ReorderFlag = {
  product: string;
  closing: number;
  safety: number;
  projected: number;
  below: boolean;
  projectedBelow: boolean;
  critical: boolean;
  leadDays?: number;
  /** The unit `closing`, `safety` and `projected` are all in. */
  unit: string;
  /** Human-readable basis, e.g. "at 5 t (safety 20 t)". */
  basis: string;
};

/**
 * A product whose stock figures and safety threshold are in different units, so
 * no below-safety judgement is possible. Surfaced instead of an alert.
 */
export type UnitMismatch = {
  product: string;
  stockUnit: string;
  safetyUnit: string;
  /** Human-readable basis, e.g. "stock is in KL but the safety level is in tonnes". */
  basis: string;
};

export type ReorderDetection = { flags: ReorderFlag[]; mismatches: UnitMismatch[] };

/**
 * The unit safety stock levels are expressed in.
 *
 * safety_stock_level predates the unit column (`DECIMAL DEFAULT 20` in
 * setup.sql) and is tonnes-denominated wherever it is set: the stock form
 * defaults it to 20 t, and the SharePoint sync never writes a safety level at
 * all. So a synced row keeps the tonnes-based column default while its stock
 * figures arrive in KL, and the two are not comparable.
 */
const SAFETY_UNIT: string = DEFAULT_STOCK_UNIT;

/**
 * Pure detection: which products are below safety, or projected below after the
 * next planned month's consumption (UCO), factoring in supplier lead times.
 * Reads only — no writes. Shared by evaluateReorder() (which raises alerts) and
 * lib/notifications.ts (which lists them), so the two never diverge.
 *
 * Unit-aware: a product is only judged when its stock figures are in the same
 * unit as its safety level (see SAFETY_UNIT). Anything else is returned as a
 * mismatch rather than a flag — a wrong reorder alert is worse than a missing
 * one.
 */
export async function detectReorderFlags(supabase: ServerSupabaseClient): Promise<ReorderDetection> {
  const month = currentMonthStart();

  const [stockRes, planRes, orderRes] = await Promise.all([
    supabase.from("stock_levels").select("product, month, closing_stock, safety_stock_level, unit").order("month", { ascending: false }),
    supabase.from("production_plan").select("month, uco_consumed").gte("month", month).order("month", { ascending: true }),
    supabase.from("raw_material_orders").select("material, lead_time_days, status").in("status", ["pending", "ordered"]),
  ]);

  const stock = (stockRes.data ?? []) as { product: string; month: string; closing_stock: number | null; safety_stock_level: number | null; unit: string | null }[];
  const plans = (planRes.data ?? []) as { month: string; uco_consumed: number | null }[];
  const orders = (orderRes.data ?? []) as { material: string; lead_time_days: number | null }[];

  // Latest stock row per product (rows are month-descending).
  const latest = new Map<string, { closing: number; safety: number; unit: string }>();
  for (const s of stock) {
    if (!latest.has(s.product)) {
      latest.set(s.product, {
        closing: Number(s.closing_stock) || 0,
        safety: Number(s.safety_stock_level) || 0,
        unit: s.unit || SAFETY_UNIT,
      });
    }
  }

  // Next planned month's UCO consumption (forward-looking shortfall for UCO).
  // production_plan has no unit column and is tonnes throughout, so this is only
  // safe to subtract from a stock figure that is itself in SAFETY_UNIT — which
  // the unit guard below already ensures.
  const nextUcoConsumption = plans.length ? Number(plans[0].uco_consumed) || 0 : 0;

  // Shortest open-order lead time per material.
  const leadByMaterial = new Map<string, number>();
  for (const o of orders) {
    const d = Number(o.lead_time_days) || 0;
    const cur = leadByMaterial.get(o.material);
    if (cur === undefined || d < cur) leadByMaterial.set(o.material, d);
  }

  const flags: ReorderFlag[] = [];
  const mismatches: UnitMismatch[] = [];
  for (const [product, { closing, safety, unit }] of Array.from(latest.entries())) {
    // Different units — comparing them would be meaningless, and converting
    // needs a confirmed density per material that we do not have. Warn instead
    // of judging: a wrong reorder alert is worse than a missing one.
    if (unit !== SAFETY_UNIT) {
      mismatches.push({
        product,
        stockUnit: unit,
        safetyUnit: SAFETY_UNIT,
        basis: `stock is in ${unit} but the safety level is in ${SAFETY_UNIT}`,
      });
      continue;
    }

    const consumption = product.toUpperCase() === "UCO" ? nextUcoConsumption : 0;
    const projected = closing - consumption;
    const below = closing < safety;
    const projectedBelow = projected < safety;
    if (!below && !projectedBelow) continue;

    const critical = closing <= 0 || projected <= 0;
    const leadDays = leadByMaterial.get(product);
    const u = unitLabel(unit);
    const basis = below
      ? `at ${closing} ${u} (safety ${safety} ${u})`
      : `projected ${projected} ${u} after ${consumption} ${u} consumption (safety ${safety} ${u})`;

    flags.push({ product, closing, safety, projected, below, projectedBelow, critical, leadDays, unit, basis });
  }
  return { flags, mismatches };
}

/**
 * Reorder check: detect below-safety products and raise a system_alert for each,
 * skipping products that already have an open alert of the same kind (no
 * duplicates).
 *
 * Products whose stock and safety level are in different units raise a distinct
 * `unit_mismatch` alert naming both units, never a reorder alert — the figures
 * are not comparable, so there is nothing to judge.
 *
 * Runs after a stock save and from the "Run reorder check" action on Inventory.
 */
export async function evaluateReorder(supabase: ServerSupabaseClient): Promise<ReorderResult> {
  const [{ flags, mismatches }, alertRes] = await Promise.all([
    detectReorderFlags(supabase),
    supabase
      .from("system_alerts")
      .select("alert_type, related_entity_id")
      .eq("category", "inventory")
      .in("alert_type", ["reorder", "unit_mismatch"])
      .eq("is_resolved", false),
  ]);

  const open = (alertRes.data ?? []) as { alert_type: string; related_entity_id: string | null }[];
  // Keyed per alert type: a product can legitimately hold an open unit_mismatch
  // without that suppressing a later reorder alert, and vice versa.
  const existing = new Set(open.map((a) => `${a.alert_type}:${a.related_entity_id}`));

  const toRaise: AlertInsert[] = [];
  const flagged: string[] = [];
  const mismatched: string[] = [];

  for (const f of flags) {
    if (existing.has(`reorder:${f.product}`)) continue; // already alerted, not resolved
    toRaise.push({
      alert_type: "reorder",
      severity: f.critical ? "critical" : "warning",
      title: `Reorder ${f.product}`,
      description: `${f.product} ${f.basis}.${f.leadDays !== undefined ? ` Supplier lead time ~${f.leadDays}d.` : ""}`,
      category: "inventory",
      related_entity_type: "stock_product",
      related_entity_id: f.product,
    });
    flagged.push(f.product);
  }

  for (const m of mismatches) {
    if (existing.has(`unit_mismatch:${m.product}`)) continue;
    toRaise.push({
      alert_type: "unit_mismatch",
      severity: "warning",
      title: `Units differ for ${m.product}`,
      description:
        `${m.product} ${m.basis}, so no below-safety check ran. ` +
        `Set the safety level in ${m.stockUnit}, or record the stock figures in ${m.safetyUnit}.`,
      category: "inventory",
      related_entity_type: "stock_product",
      related_entity_id: m.product,
    });
    mismatched.push(m.product);
  }

  if (toRaise.length > 0) {
    await supabase.from("system_alerts").insert(toRaise as never);
  }

  return { raised: toRaise.length, flagged, mismatched };
}
