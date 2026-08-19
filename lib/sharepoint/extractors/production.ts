import "server-only";
import type ExcelJS from "exceljs";
import { loadWorkbook, findHeaderRow, toNumber, toDate, monthKey } from "@/lib/sharepoint/workbook";

/**
 * Inventory workbook -> production_plan.
 *
 * Source: the SAME file the stock extractor reads —
 *   05_Supply_Chain_and_Logistics/Inventory_Records/2026/
 *   Material Inventory Jan 26 -Dec 26.xlsx
 *
 * The nominated production source (05_Supply_Chain_and_Logistics/Lists/
 * Sales-Production MAHER.xlsx) is empty — a single sheet with a used range of
 * A1:A1. But the inventory workbook already records, per day:
 *
 *   BIODIESEL sheet : Produced, Wastage   -> b100_output, wastage
 *   GLYCEROL  sheet : Produced            -> glycerin_output
 *   UCO       sheet : Consumption         -> uco_consumed
 *
 * so monthly production can be derived with no new file and no input from the
 * team. Nothing is invented: every figure below is a sum of values that are
 * physically in the workbook.
 *
 * ── Decisions, all deliberate and all flagged rather than hidden ────────────
 *
 * 1. ONLY MONTHS WITH RECORDED ACTIVITY are emitted. April–December 2026 have
 *    no entries at all — that is absence of data, not a month of zero
 *    production, and writing 0 would assert something the workbook does not say.
 *    Same principle as NULL-not-zero for safety thresholds.
 *
 * 2. NO TARGET. The workbook records what happened, never what was planned, so
 *    target_output is left NULL (phase5c drops its NOT NULL). A fabricated
 *    target would make every derived month look like a 100% overshoot.
 *
 * 3. actual_output = b100_output. B100 is the saleable product; glycerol is a
 *    byproduct carried in its own column. If "actual output" is meant to include
 *    glycerol, that is a one-line change here — flagged for Andre.
 *
 * 4. UNITS ARE KL, stored unconverted with `unit` set, exactly as stock does.
 *
 * 5. status = 'actual', not the 'planned' column default, because these rows are
 *    a record of what happened.
 *
 * ── ⚠️ TWO THINGS THE SOURCE DATA SAYS THAT CANNOT BOTH BE TRUE ─────────────
 *
 * A. The implied yield is impossible. January: 9.0 KL UCO consumed -> 17.26 KL
 *    B100 produced (192%). February: 17.0 -> 39.3 (231%). Transesterification is
 *    roughly 1:1 by mass and cannot exceed 100% by volume. So either UCO
 *    consumption is under-recorded, or the B100 "Produced" column means
 *    something other than fresh output. The extractor reports the workbook
 *    faithfully; the workbook is what needs resolving.
 *
 * B. Glycerol produced is 0.000 in every month, while the glycerol tank level
 *    sits at a constant 96.8 KL. Byproduct output is simply not being recorded.
 *    That matters beyond this page: ISCC mass balance needs it.
 *
 * Neither is a reason to withhold the import — a dashboard that makes these
 * visible is worth more than a spreadsheet that hides them. Both are surfaced in
 * the sync's per-area note so they appear on /sync rather than only in a comment.
 */

export type ProductionRow = {
  month: string;
  target_output: number | null;
  actual_output: number | null;
  b100_output: number | null;
  glycerin_output: number | null;
  uco_consumed: number | null;
  wastage: number | null;
  status: string;
  unit: string;
  source: "sharepoint";
  notes: string | null;
};

const UNIT = "KL";

type DaySeries = Map<string, Map<string, number>>;

/** Sum the named columns of a daily sheet into monthly buckets. */
function monthlySums(sheet: ExcelJS.Worksheet, columns: string[]): DaySeries | null {
  const header = findHeaderRow(sheet, ["date"]);
  if (!header) return null;

  const col = header.columns;
  const out: DaySeries = new Map();

  for (let r = header.row + 1; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const date = toDate(row.getCell(col["date"]).value);
    if (!date) continue;

    const key = monthKey(date);
    let bucket = out.get(key);
    if (!bucket) {
      bucket = new Map();
      out.set(key, bucket);
    }

    for (const name of columns) {
      if (!col[name]) continue;
      const v = toNumber(row.getCell(col[name]).value);
      if (v === null) continue;
      bucket.set(name, (bucket.get(name) ?? 0) + v);
    }
  }

  return out;
}

const get = (s: DaySeries | null, month: string, col: string): number | null => {
  const v = s?.get(month)?.get(col);
  return v === undefined ? null : Math.round(v * 1000) / 1000;
};

export async function extractProduction(buffer: Buffer): Promise<{
  rows: ProductionRow[];
  skipped: string[];
  warnings: string[];
}> {
  const wb = await loadWorkbook(buffer);
  const skipped: string[] = [];
  const warnings: string[] = [];

  const sheetOf = (name: string) => {
    const s = wb.getWorksheet(name);
    if (!s) skipped.push(`${name}: sheet not found`);
    return s;
  };

  const bdSheet = sheetOf("BIODIESEL");
  const glSheet = sheetOf("GLYCEROL");
  const ucoSheet = sheetOf("UCO");

  const bd = bdSheet ? monthlySums(bdSheet, ["produced", "wastage"]) : null;
  const gl = glSheet ? monthlySums(glSheet, ["produced"]) : null;
  const uco = ucoSheet ? monthlySums(ucoSheet, ["consumption"]) : null;

  if (bdSheet && !bd) skipped.push("BIODIESEL: no Date header row found in the first 20 rows");
  if (glSheet && !gl) skipped.push("GLYCEROL: no Date header row found in the first 20 rows");
  if (ucoSheet && !uco) skipped.push("UCO: no Date header row found in the first 20 rows");

  const months = Array.from(
    new Set([
      ...Array.from(bd?.keys() ?? []),
      ...Array.from(gl?.keys() ?? []),
      ...Array.from(uco?.keys() ?? []),
    ]),
  ).sort();

  const rows: ProductionRow[] = [];
  let emptyMonths = 0;

  for (const month of months) {
    const b100 = get(bd, month, "produced");
    const wastage = get(bd, month, "wastage");
    const glycerin = get(gl, month, "produced");
    const ucoConsumed = get(uco, month, "consumption");

    // Absence of data is not a month of zero production.
    const hasActivity = [b100, wastage, glycerin, ucoConsumed].some((v) => v !== null && v !== 0);
    if (!hasActivity) {
      emptyMonths++;
      continue;
    }

    // Yield sanity check. Transesterification is ~1:1 by mass and cannot exceed
    // 100% by volume, so anything above that means the source is inconsistent.
    if (b100 && ucoConsumed && b100 > ucoConsumed) {
      warnings.push(
        `${month.slice(0, 7)}: ${b100} ${UNIT} B100 from ${ucoConsumed} ${UNIT} UCO ` +
          `(${Math.round((b100 / ucoConsumed) * 100)}% yield — not physically possible; ` +
          `UCO consumption is likely under-recorded)`,
      );
    }

    rows.push({
      month,
      target_output: null,
      actual_output: b100,
      b100_output: b100,
      glycerin_output: glycerin,
      uco_consumed: ucoConsumed,
      wastage,
      status: "actual",
      unit: UNIT,
      source: "sharepoint",
      notes: "Derived from the Barka inventory workbook (daily series aggregated to a month).",
    });
  }

  if (emptyMonths) {
    skipped.push(
      `${emptyMonths} month(s) had no recorded activity and were not written ` +
        `(absence of data, not zero production)`,
    );
  }

  if (rows.length && rows.every((r) => !r.glycerin_output)) {
    warnings.push(
      "Glycerol output is 0 in every month while the glycerol tank level is non-zero — " +
        "byproduct production is not being recorded. ISCC mass balance needs this figure.",
    );
  }

  return { rows, skipped, warnings };
}
