/**
 * Units for stock figures.
 *
 * stock_levels.unit records the unit its numeric columns are actually in.
 * Rows written by the SharePoint sync carry the source workbook's unit (KL, or
 * Kg for antioxidant) and are stored unconverted — converting to tonnes needs a
 * confirmed density per material, and none is confirmed, so nothing in the app
 * converts. Figures are displayed in the unit they were recorded in.
 */

/** The units a stock row can be recorded in — mirrors the stock_levels.unit comment. */
export const STOCK_UNITS = ["tonnes", "KL", "Kg"] as const;

export type StockUnit = (typeof STOCK_UNITS)[number];

/** Matches the `DEFAULT 'tonnes'` on stock_levels.unit. */
export const DEFAULT_STOCK_UNIT: StockUnit = "tonnes";

export const STOCK_UNIT_OPTIONS: { value: string; label: string }[] = [
  { value: "tonnes", label: "tonnes (t)" },
  { value: "KL", label: "kilolitres (KL)" },
  { value: "Kg", label: "kilograms (Kg)" },
];

/** Short label to sit next to a number — "tonnes" reads as "t" everywhere else in the app. */
export function unitLabel(unit: string | null | undefined): string {
  if (!unit || unit === "tonnes") return "t";
  return unit;
}
