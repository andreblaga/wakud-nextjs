import "server-only";
import ExcelJS from "exceljs";

/**
 * Helpers for reading the team's workbooks.
 *
 * These are analyst workbooks, not data exports: header rows sit at different
 * offsets on each sheet (row 11 on one, row 12 on the next), summary blocks are
 * parked to the right of the data, and columns drift. So nothing here assumes
 * row 1 is the header or that a column is at a fixed index — the header row is
 * located by looking for the columns we need, and columns are addressed by name.
 */

export type SheetGrid = (ExcelJS.CellValue | null)[][];

export async function loadWorkbook(buffer: Buffer): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  return wb;
}

/** Normalise a cell to a trimmed lowercase string for header matching. */
function norm(v: ExcelJS.CellValue | null | undefined): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object" && "result" in (v as any)) return norm((v as any).result);
  if (typeof v === "object" && "text" in (v as any)) return norm((v as any).text);
  return String(v).trim().toLowerCase();
}

/** Unwrap a cell to a primitive: formula cells carry their cached result. */
export function cellValue(v: ExcelJS.CellValue | null | undefined): unknown {
  if (v === null || v === undefined) return null;
  if (typeof v === "object") {
    const o = v as any;
    if ("result" in o) return o.result ?? null;
    if ("text" in o) return o.text ?? null;
    if (o instanceof Date) return o;
  }
  return v;
}

/** A number, or null for blanks, text and Excel error values (#REF!, #N/A …). */
export function toNumber(v: ExcelJS.CellValue | null | undefined): number | null {
  const raw = cellValue(v);
  if (raw === null || raw === "") return null;
  if (raw instanceof Date) return null;
  if (typeof raw === "object" && (raw as any).error) return null; // #REF!, #N/A
  const n = typeof raw === "number" ? raw : Number(String(raw).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

export function toDate(v: ExcelJS.CellValue | null | undefined): Date | null {
  const raw = cellValue(v);
  if (raw instanceof Date) return raw;
  if (typeof raw === "number" && raw > 20000 && raw < 80000) {
    // Excel serial date (1900 system, with the well-known 1900 leap-year bug).
    return new Date(Date.UTC(1899, 11, 30) + raw * 86_400_000);
  }
  return null;
}

/**
 * Find the header row on a sheet by looking for the column names we need.
 *
 * Returns the 1-based row number and a name -> 1-based column index map, or
 * null when the sheet doesn't contain the expected columns (which is a signal
 * the workbook's shape changed, not something to paper over).
 */
export function findHeaderRow(
  sheet: ExcelJS.Worksheet,
  required: string[],
  searchRows = 20,
): { row: number; columns: Record<string, number> } | null {
  const wanted = required.map((r) => r.toLowerCase());

  for (let r = 1; r <= Math.min(searchRows, sheet.rowCount); r++) {
    const row = sheet.getRow(r);
    const columns: Record<string, number> = {};
    row.eachCell({ includeEmpty: false }, (cell, col) => {
      const key = norm(cell.value);
      if (key && !(key in columns)) columns[key] = col;
    });
    if (wanted.every((w) => w in columns)) return { row: r, columns };
  }
  return null;
}

/** First day of a date's month, as an ISO date string (the app stores months as DATE). */
export function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}
