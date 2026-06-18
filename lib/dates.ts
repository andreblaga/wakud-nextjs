/** Date formatting helpers. Month values in the DB are first-of-month DATEs. */

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** "2026-03-01" → "Mar" (or "Mar 2026" with year). Parses the string directly
 * to avoid timezone shifts on first-of-month dates. */
export function monthLabel(
  dateStr: string | null | undefined,
  withYear = false,
): string {
  if (!dateStr) return "—";
  const [y, m] = dateStr.split("-");
  const mi = parseInt(m, 10) - 1;
  if (Number.isNaN(mi) || mi < 0 || mi > 11) return dateStr;
  return withYear ? `${MONTHS[mi]} ${y}` : MONTHS[mi];
}

/** "2026-03-15" → "15 Mar 2026". */
export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const [y, m, d] = dateStr.split("T")[0].split("-");
  const mi = parseInt(m, 10) - 1;
  if (Number.isNaN(mi) || mi < 0 || mi > 11) return dateStr;
  return `${parseInt(d, 10)} ${MONTHS[mi]} ${y}`;
}

/** First day of the current month as an ISO date string ("2026-06-01"). */
export function currentMonthStart(): string {
  const now = new Date();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `${now.getFullYear()}-${m}-01`;
}
