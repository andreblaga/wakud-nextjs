import { describe, it, expect } from "vitest";
import { detectReorderFlags } from "@/lib/reorder";
import type { ServerSupabaseClient } from "@/lib/supabase/server";

/**
 * Tests for the reorder unit guard.
 *
 * The rule these protect: a below-safety alert may only be raised when the two
 * numbers being compared are in the same unit. Stock figures synced from
 * SharePoint arrive in KL (Kg for antioxidant) and are stored unconverted,
 * because converting needs a confirmed density per material that nobody has
 * confirmed. A threshold that is absent is absent — NULL is not zero.
 *
 * A wrong reorder alert is worse than a missing one, so every ambiguous case
 * must produce a mismatch or nothing, never a flag.
 */

type StockFixture = {
  product: string;
  month: string;
  closing_stock: number | null;
  safety_stock_level: number | null;
  safety_stock_unit: string | null;
  unit: string | null;
};
type PlanFixture = { month: string; uco_consumed: number | null };
type OrderFixture = { material: string; lead_time_days: number | null; status: string };

type Fixtures = {
  stock_levels?: StockFixture[];
  production_plan?: PlanFixture[];
  raw_material_orders?: OrderFixture[];
};

/**
 * Minimal stand-in for the query builder: every chained method returns itself
 * and awaiting resolves to the rows for that table. detectReorderFlags does its
 * own filtering in JS, so the stub does not need to honour the filters.
 */
function stubClient(f: Fixtures): ServerSupabaseClient {
  const rowsFor = (table: string): unknown[] => {
    if (table === "stock_levels") return f.stock_levels ?? [];
    if (table === "production_plan") return f.production_plan ?? [];
    if (table === "raw_material_orders") return f.raw_material_orders ?? [];
    return [];
  };
  const builder = (rows: unknown[]) => {
    const b = {
      select: () => b,
      order: () => b,
      gte: () => b,
      in: () => b,
      eq: () => b,
      then: (resolve: (r: { data: unknown[]; error: null }) => void) => resolve({ data: rows, error: null }),
    };
    return b;
  };
  // A test double, not a real client — the cast is the point of the stub.
  return { from: (table: string) => builder(rowsFor(table)) } as unknown as ServerSupabaseClient;
}

const row = (over: Partial<StockFixture> = {}): StockFixture => ({
  product: "UCO",
  month: "2026-08-01",
  closing_stock: 5,
  safety_stock_level: 20,
  safety_stock_unit: "tonnes",
  unit: "tonnes",
  ...over,
});

describe("detectReorderFlags — matching units", () => {
  it("flags a tonnes row that is below its tonnes safety level", async () => {
    const { flags, mismatches } = await detectReorderFlags(stubClient({ stock_levels: [row()] }));

    expect(mismatches).toEqual([]);
    expect(flags).toHaveLength(1);
    expect(flags[0].product).toBe("UCO");
    expect(flags[0].below).toBe(true);
    expect(flags[0].basis).toBe("at 5 t (safety 20 t)");
  });

  it("flags a KL row against a KL safety level — it reads the column, not an assumption", async () => {
    const { flags, mismatches } = await detectReorderFlags(
      stubClient({ stock_levels: [row({ unit: "KL", safety_stock_unit: "KL" })] }),
    );

    expect(mismatches).toEqual([]);
    expect(flags).toHaveLength(1);
    expect(flags[0].basis).toBe("at 5 KL (safety 20 KL)");
  });

  it("produces nothing for a comfortable row", async () => {
    const { flags, mismatches } = await detectReorderFlags(
      stubClient({ stock_levels: [row({ product: "B100", closing_stock: 900 })] }),
    );

    expect(flags).toEqual([]);
    expect(mismatches).toEqual([]);
  });

  it("treats a null unit as the tonnes default rather than a mismatch", async () => {
    const { flags, mismatches } = await detectReorderFlags(
      stubClient({ stock_levels: [row({ unit: null, safety_stock_unit: null })] }),
    );

    expect(mismatches).toEqual([]);
    expect(flags).toHaveLength(1);
    expect(flags[0].basis).toBe("at 5 t (safety 20 t)");
  });
});

describe("detectReorderFlags — mismatched units", () => {
  // The case that matters. 5 KL against a 20 t threshold looks below-safety
  // numerically; comparing them is meaningless, so it must not alert.
  it("raises no reorder alert for KL stock against a tonnes safety level", async () => {
    const { flags, mismatches } = await detectReorderFlags(
      stubClient({ stock_levels: [row({ unit: "KL", safety_stock_unit: "tonnes" })] }),
    );

    expect(flags).toEqual([]);
    expect(mismatches).toHaveLength(1);
    expect(mismatches[0]).toMatchObject({
      product: "UCO",
      kind: "safety",
      stockUnit: "KL",
      comparedUnit: "tonnes",
    });
    expect(mismatches[0].basis).toBe("stock is in KL but the safety level is in tonnes");
  });

  it("raises no reorder alert for Kg stock against a tonnes safety level", async () => {
    const { flags, mismatches } = await detectReorderFlags(
      stubClient({
        stock_levels: [row({ product: "Antioxidant", closing_stock: 1, unit: "Kg", safety_stock_unit: "tonnes" })],
      }),
    );

    expect(flags).toEqual([]);
    expect(mismatches).toHaveLength(1);
    expect(mismatches[0].basis).toBe("stock is in Kg but the safety level is in tonnes");
  });

  it("judges each product on its own units", async () => {
    const { flags, mismatches } = await detectReorderFlags(
      stubClient({
        stock_levels: [
          row({ product: "UCO" }),
          row({ product: "Methanol", closing_stock: 2, unit: "KL", safety_stock_unit: "tonnes" }),
        ],
      }),
    );

    expect(flags.map((f) => f.product)).toEqual(["UCO"]);
    expect(mismatches.map((m) => m.product)).toEqual(["Methanol"]);
  });
});

describe("detectReorderFlags — the forward-looking projection", () => {
  // production_plan.uco_consumed has no unit column and is tonnes throughout.
  // Matching stock/safety units does not license subtracting it from KL stock.
  it("withholds the projection when stock is not in the plan's unit, but still checks directly", async () => {
    const { flags, mismatches } = await detectReorderFlags(
      stubClient({
        stock_levels: [row({ closing_stock: 500, unit: "KL", safety_stock_unit: "KL" })],
        production_plan: [{ month: "2026-09-01", uco_consumed: 480 }],
      }),
    );

    // 500 KL is above the 20 KL threshold, so no flag — and crucially the
    // tonnes consumption was never subtracted from it.
    expect(flags).toEqual([]);
    expect(mismatches).toHaveLength(1);
    expect(mismatches[0]).toMatchObject({ kind: "projection", stockUnit: "KL", comparedUnit: "tonnes" });
  });

  it("applies the projection when stock is in the plan's unit", async () => {
    const { flags, mismatches } = await detectReorderFlags(
      stubClient({
        stock_levels: [row({ closing_stock: 500, unit: "tonnes", safety_stock_unit: "tonnes" })],
        production_plan: [{ month: "2026-09-01", uco_consumed: 490 }],
      }),
    );

    expect(mismatches).toEqual([]);
    expect(flags).toHaveLength(1);
    expect(flags[0].projectedBelow).toBe(true);
    expect(flags[0].projected).toBe(10);
  });
});

describe("detectReorderFlags — no threshold set", () => {
  it("produces nothing when the safety level is null", async () => {
    const { flags, mismatches } = await detectReorderFlags(
      stubClient({ stock_levels: [row({ safety_stock_level: null })] }),
    );

    expect(flags).toEqual([]);
    expect(mismatches).toEqual([]);
  });

  // NULL is not zero: an absent threshold must not read as "safety level 0",
  // which would silently make every row look healthy for the wrong reason, nor
  // as a threshold that zero stock falls below.
  it("does not flag zero stock when no threshold is set", async () => {
    const { flags, mismatches } = await detectReorderFlags(
      stubClient({ stock_levels: [row({ closing_stock: 0, safety_stock_level: null })] }),
    );

    expect(flags).toEqual([]);
    expect(mismatches).toEqual([]);
  });

  // The sharpest form of "NULL is not zero": with a real 0 threshold, negative
  // stock is below it and would flag. With no threshold, there is nothing to be
  // below, so nothing may be raised.
  it("does not flag negative stock when no threshold is set", async () => {
    const { flags, mismatches } = await detectReorderFlags(
      stubClient({ stock_levels: [row({ closing_stock: -3, safety_stock_level: null })] }),
    );

    expect(flags).toEqual([]);
    expect(mismatches).toEqual([]);
  });

  it("does flag negative stock against a real zero threshold", async () => {
    const { flags } = await detectReorderFlags(
      stubClient({ stock_levels: [row({ closing_stock: -3, safety_stock_level: 0 })] }),
    );

    expect(flags).toHaveLength(1);
    expect(flags[0].below).toBe(true);
  });

  it("reports no unit mismatch when the units differ but no threshold is set", async () => {
    const { flags, mismatches } = await detectReorderFlags(
      stubClient({
        stock_levels: [row({ safety_stock_level: null, unit: "KL", safety_stock_unit: "tonnes" })],
      }),
    );

    expect(flags).toEqual([]);
    expect(mismatches).toEqual([]);
  });

  it("still judges other products when one has no threshold", async () => {
    const { flags, mismatches } = await detectReorderFlags(
      stubClient({
        stock_levels: [row({ product: "Resin", safety_stock_level: null }), row({ product: "UCO" })],
      }),
    );

    expect(flags.map((f) => f.product)).toEqual(["UCO"]);
    expect(mismatches).toEqual([]);
  });
});

describe("detectReorderFlags — latest row wins", () => {
  it("judges only the most recent month per product", async () => {
    const { flags } = await detectReorderFlags(
      stubClient({
        stock_levels: [
          row({ month: "2026-08-01", closing_stock: 900 }), // latest: healthy
          row({ month: "2026-07-01", closing_stock: 1 }), // older: would flag
        ],
      }),
    );

    expect(flags).toEqual([]);
  });
});
