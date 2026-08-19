import "server-only";
import type ExcelJS from "exceljs";
import { loadWorkbook, findHeaderRow, toNumber, toDate, monthKey } from "@/lib/sharepoint/workbook";

/**
 * Inventory workbook -> stock_levels.
 *
 * Source: 05_Supply_Chain_and_Logistics/Inventory_Records/2026/
 *         Material Inventory Jan 26 -Dec 26.xlsx
 *
 * Shape: one sheet per material, each a daily series for calendar 2026 (365
 * rows) with a running "Level" column. The app stores one row per product per
 * month, so each sheet is aggregated:
 *
 *   opening_stock = the running level on the last day of the previous month
 *                   (for the first month, the first day's level backed out by
 *                   that day's own movements)
 *   produced      = SUM(Produced)            — finished products only
 *   purchased     = SUM(Receipit)            — raw materials only  [sic, the
 *                   workbook's spelling]
 *   delivered     = SUM(Dispatched) for products,
 *                   SUM(Consumption) for raw materials
 *   closing_stock = the running level on the last day with data in the month
 *
 * ⚠️ Two judgement calls, both flagged for Andre rather than hidden:
 *   1. UNITS. The workbook is in KL (antioxidant in Kg); the app labels stock in
 *      tonnes. Numbers are stored unconverted with stock_levels.unit set to the
 *      source unit. Converting needs a confirmed density per material.
 *   2. "delivered" FOR RAW MATERIALS means consumed into production, not sold.
 *      stock_levels has no separate consumption column, so outflow is mapped to
 *      delivered. If that reads wrong on the Inventory page, the fix is a
 *      `consumed` column, not a change here.
 */

export type StockRow = {
  product: string;
  month: string;
  opening_stock: number;
  produced: number | null;
  purchased: number | null;
  delivered: number | null;
  closing_stock: number | null;
  unit: string;
};

/** Sheet name -> the product name the app should show. */
const PRODUCTS: Record<string, { product: string; unit: string; kind: "product" | "material" }> = {
  BIODIESEL: { product: "B100", unit: "KL", kind: "product" },
  GLYCEROL: { product: "Glycerol", unit: "KL", kind: "product" },
  UCO: { product: "UCO", unit: "KL", kind: "material" },
  METHANOL: { product: "Methanol", unit: "KL", kind: "material" },
  "K-METHYLATE": { product: "Potassium Methylate", unit: "KL", kind: "material" },
  "NA-METHYLATE": { product: "Sodium Methylate", unit: "KL", kind: "material" },
  ANTIOXIDANT: { product: "Antioxidant", unit: "Kg", kind: "material" },
  "RECOVERED METHANOL": { product: "Recovered Methanol", unit: "KL", kind: "material" },
  RESIN: { product: "Resin", unit: "KL", kind: "material" },
};

type DayRow = {
  date: Date;
  produced: number | null;
  purchased: number | null;
  outflow: number | null;
  level: number | null;
};

function readSheet(sheet: ExcelJS.Worksheet): DayRow[] | null {
  // Every material sheet has a Date column and a running Level column; the rest
  // vary by material, so only those two are required to locate the header.
  const header = findHeaderRow(sheet, ["date", "level"]);
  if (!header) return null;

  const col = header.columns;
  const days: DayRow[] = [];

  for (let r = header.row + 1; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const date = toDate(row.getCell(col["date"]).value);
    if (!date) continue;

    days.push({
      date,
      produced: col["produced"] ? toNumber(row.getCell(col["produced"]).value) : null,
      purchased: col["receipit"] ? toNumber(row.getCell(col["receipit"]).value) : null,
      outflow:
        col["dispatched"]
          ? toNumber(row.getCell(col["dispatched"]).value)
          : col["consumption"]
            ? toNumber(row.getCell(col["consumption"]).value)
            : null,
      level: toNumber(row.getCell(col["level"]).value),
    });
  }

  return days;
}

function sum(values: (number | null)[]): number | null {
  const present = values.filter((v): v is number => v !== null);
  return present.length ? present.reduce((a, b) => a + b, 0) : null;
}

export function aggregate(days: DayRow[], product: string, unit: string): StockRow[] {
  const byMonth = new Map<string, DayRow[]>();
  for (const d of days) {
    const key = monthKey(d.date);
    const list = byMonth.get(key);
    if (list) list.push(d);
    else byMonth.set(key, [d]);
  }

  const months = Array.from(byMonth.keys()).sort();
  const rows: StockRow[] = [];
  let previousClosing: number | null = null;

  for (const month of months) {
    const entries = byMonth.get(month)!.sort((a, b) => a.date.getTime() - b.date.getTime());
    const withLevel = entries.filter((e) => e.level !== null);

    const produced = sum(entries.map((e) => e.produced));
    const purchased = sum(entries.map((e) => e.purchased));
    const delivered = sum(entries.map((e) => e.outflow));
    const closing: number | null = withLevel.length
      ? withLevel[withLevel.length - 1].level
      : previousClosing;

    let opening: number;
    if (previousClosing !== null) {
      opening = previousClosing;
    } else if (withLevel.length) {
      // First month: back the first day's own movements out of its level.
      const first = withLevel[0];
      opening =
        (first.level ?? 0) - (first.produced ?? 0) - (first.purchased ?? 0) + (first.outflow ?? 0);
    } else {
      opening = 0;
    }

    rows.push({
      product,
      month,
      opening_stock: round(opening),
      produced: round(produced),
      purchased: round(purchased),
      delivered: round(delivered),
      closing_stock: round(closing),
      unit,
    });

    previousClosing = closing;
  }

  return rows;
}

function round(n: number | null): number {
  // The source carries float noise from repeated addition (…999999997).
  return n === null ? 0 : Math.round(n * 1000) / 1000;
}

export async function extractStock(buffer: Buffer): Promise<{
  rows: StockRow[];
  skipped: string[];
}> {
  const wb = await loadWorkbook(buffer);
  const rows: StockRow[] = [];
  const skipped: string[] = [];

  for (const [sheetName, meta] of Object.entries(PRODUCTS)) {
    const sheet = wb.getWorksheet(sheetName);
    if (!sheet) {
      skipped.push(`${sheetName}: sheet not found`);
      continue;
    }
    const days = readSheet(sheet);
    if (!days) {
      skipped.push(`${sheetName}: no Date/Level header row found in the first 20 rows`);
      continue;
    }
    if (!days.length) {
      skipped.push(`${sheetName}: no dated rows`);
      continue;
    }
    rows.push(...aggregate(days, meta.product, meta.unit));
  }

  return { rows, skipped };
}
