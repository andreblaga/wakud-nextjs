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
 * A product whose stock figures could not be compared against something, because
 * the two sides are in different units. Surfaced instead of an alert.
 *
 *   "safety"     — stock unit vs the row's own safety_stock_unit.
 *   "projection" — stock unit vs the production plan's unit, which blocks only
 *                  the forward-looking check; the direct one still runs.
 */
export type UnitMismatch = {
  product: string;
  kind: "safety" | "projection";
  stockUnit: string;
  /** The unit the stock was going to be compared against. */
  comparedUnit: string;
  /** Human-readable basis, e.g. "stock is in KL but the safety level is in tonnes". */
  basis: string;
};

export type ReorderDetection = { flags: ReorderFlag[]; mismatches: UnitMismatch[] };


/**
 * Pure detection: which products are below safety, or projected below after the
 * next planned month's consumption (UCO), factoring in supplier lead times.
 * Reads only — no writes. Shared by evaluateReorder() (which raises alerts) and
 * lib/notifications.ts (which lists them), so the two never diverge.
 *
 * Unit-aware: a product is only judged when its stock figures and its safety
 * level are in the same unit, both read from the row. Anything else is returned
 * as a mismatch rather than a flag — a wrong reorder alert is worse than a
 * missing one.
 *
 * A NULL safety level means no threshold has been set. Such a row is not below
 * safety, is not a unit mismatch, and produces nothing at all: NULL is not zero.
 */
export async function detectReorderFlags(supabase: ServerSupabaseClient): Promise<ReorderDetection> {
  const month = currentMonthStart();

  const [stockRes, planRes, orderRes] = await Promise.all([
    supabase.from("stock_levels").select("product, month, closing_stock, safety_stock_level, safety_stock_unit, unit").order("month", { ascending: false }),
    supabase.from("production_plan").select("month, uco_consumed, unit").gte("month", month).order("month", { ascending: true }),
    supabase.from("raw_material_orders").select("material, lead_time_days, status").in("status", ["pending", "ordered"]),
  ]);

  const stock = (stockRes.data ?? []) as { product: string; month: string; closing_stock: number | null; safety_stock_level: number | null; safety_stock_unit: string | null; unit: string | null }[];
  const plans = (planRes.data ?? []) as { month: string; uco_consumed: number | null; unit: string | null }[];
  const orders = (orderRes.data ?? []) as { material: string; lead_time_days: number | null }[];

  // Latest stock row per product (rows are month-descending).
  const latest = new Map<string, { closing: number; safety: number | null; unit: string; safetyUnit: string }>();
  for (const s of stock) {
    if (!latest.has(s.product)) {
      latest.set(s.product, {
        closing: Number(s.closing_stock) || 0,
        // NULL means no threshold set, which is not the same as 0 — keep it null
        // rather than coercing, so the guard below can tell them apart.
        safety: s.safety_stock_level === null ? null : Number(s.safety_stock_level),
        unit: s.unit || DEFAULT_STOCK_UNIT,
        safetyUnit: s.safety_stock_unit || DEFAULT_STOCK_UNIT,
      });
    }
  }

  // Next planned month's UCO consumption (forward-looking shortfall for UCO).
  // production_plan carries its own unit: rows a person entered default to
  // tonnes, rows the sync derives from the inventory workbook are KL. Read it
  // rather than assuming, and only subtract from stock in the same unit.
  const nextUcoConsumption = plans.length ? Number(plans[0].uco_consumed) || 0 : 0;
  const planUnit = (plans.length ? plans[0].unit : null) || DEFAULT_STOCK_UNIT;

  // Shortest open-order lead time per material.
  const leadByMaterial = new Map<string, number>();
  for (const o of orders) {
    const d = Number(o.lead_time_days) || 0;
    const cur = leadByMaterial.get(o.material);
    if (cur === undefined || d < cur) leadByMaterial.set(o.material, d);
  }

  const flags: ReorderFlag[] = [];
  const mismatches: UnitMismatch[] = [];
  for (const [product, { closing, safety, unit, safetyUnit }] of Array.from(latest.entries())) {
    // No threshold set. Not below safety, not a mismatch, nothing to say —
    // NULL is not zero, and inventing a threshold would alert on a number
    // nobody chose.
    if (safety === null) continue;

    // Different units — comparing them would be meaningless, and converting
    // needs a confirmed density per material that we do not have. Warn instead
    // of judging: a wrong reorder alert is worse than a missing one.
    if (unit !== safetyUnit) {
      mismatches.push({
        product,
        kind: "safety",
        stockUnit: unit,
        comparedUnit: safetyUnit,
        basis: `stock is in ${unit} but the safety level is in ${safetyUnit}`,
      });
      continue;
    }

    // The forward-looking check subtracts a production_plan figure. Matching
    // stock and safety units does not make that subtraction valid — the plan has
    // a unit of its own — so it is guarded separately. The direct comparison
    // below still runs; only the projection is withheld.
    const wantsConsumption = product.toUpperCase() === "UCO" && nextUcoConsumption > 0;
    const canProject = unit === planUnit;
    if (wantsConsumption && !canProject) {
      mismatches.push({
        product,
        kind: "projection",
        stockUnit: unit,
        comparedUnit: planUnit,
        basis: `stock is in ${unit} but planned consumption is in ${planUnit}`,
      });
    }

    const consumption = wantsConsumption && canProject ? nextUcoConsumption : 0;
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
    // A product yields at most one mismatch: a safety mismatch short-circuits
    // before the projection check ever runs, so the product alone is key enough.
    if (existing.has(`unit_mismatch:${m.product}`)) continue;
    toRaise.push({
      alert_type: "unit_mismatch",
      severity: "warning",
      title: `Units differ for ${m.product}`,
      description:
        m.kind === "safety"
          ? `${m.product} ${m.basis}, so no below-safety check ran. ` +
            `Set the safety level in ${m.stockUnit}, or record the stock figures in ${m.comparedUnit}.`
          : `${m.product} ${m.basis}, so the forward-looking check was skipped ` +
            `(the direct below-safety check still ran). Record the stock figures in ${m.comparedUnit} to restore it.`,
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
