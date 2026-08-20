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

/** Clock portion of a timestamp, as stored ("…T09:41:07Z" → "09:41"). Parsed
 * from the string so a UTC timestamp is not shifted into the viewer's zone. */
export function timeOfDay(iso: string | null | undefined): string {
  if (!iso) return "";
  const t = iso.split("T")[1];
  return t ? t.slice(0, 5) : "";
}

/** First day of the month after `dateStr` ("2026-12-01" → "2027-01-01"). Used
 * to bound a month with a half-open range when the related rows may carry any
 * day of the month rather than the first. */
export function nextMonthStart(dateStr: string): string {
  const [y, m] = dateStr.split("-").map((p) => parseInt(p, 10));
  if (Number.isNaN(y) || Number.isNaN(m)) return dateStr;
  const year = m >= 12 ? y + 1 : y;
  const month = m >= 12 ? 1 : m + 1;
  return `${year}-${String(month).padStart(2, "0")}-01`;
}
