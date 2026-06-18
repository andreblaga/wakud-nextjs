/**
 * Currency + number formatting helpers.
 *
 * USD is primary; OMR is derived via the fixed peg. The canonical source of
 * the rate is the `exchange_rates` table (seeded USD→OMR = 0.385 in
 * supabase/setup.sql). The constant here mirrors that peg so components never
 * hardcode the rate themselves — import from this module instead.
 *
 * Note: the `invoices` table already exposes a generated `amount_omr` column
 * (amount_usd * 0.385); prefer that DB value for invoices rather than
 * recomputing here.
 */

/** Fixed USD→OMR peg (mirrors the seeded exchange_rates row). */
export const USD_TO_OMR = 0.385;

export function usdToOmr(usd: number): number {
  return usd * USD_TO_OMR;
}

const usdInt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
const usdDec = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const omr = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 3,
  maximumFractionDigits: 3,
});

/** Format a USD amount. Returns "—" for null/undefined. */
export function formatUSD(
  value: number | null | undefined,
  opts: { decimals?: boolean } = {},
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return (opts.decimals ? usdDec : usdInt).format(value);
}

/** Format an OMR amount with the customary 3 decimals. */
export function formatOMR(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `OMR ${omr.format(value)}`;
}

/** Plain number with thousands separators. */
export function formatNumber(
  value: number | null | undefined,
  decimals = 0,
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * Format a margin/percentage. By default the input is treated as a fraction
 * (0.29 → "29%"); pass { isFraction: false } if the value is already a percent.
 */
export function formatPercent(
  value: number | null | undefined,
  opts: { isFraction?: boolean; decimals?: number } = {},
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const { isFraction = true, decimals = 1 } = opts;
  const pct = isFraction ? value * 100 : value;
  return `${pct.toFixed(decimals)}%`;
}
