import { describe, it, expect } from "vitest";
import { nextMonthStart, timeOfDay, monthLabel, formatDate } from "@/lib/dates";

/**
 * Month values in the DB are first-of-month DATEs, and related rows
 * (production confirmations, for one) may carry any day of that month. Detail
 * pages bound a month with [month, nextMonthStart(month)) rather than an
 * equality match, so the roll-over has to be right.
 */
describe("nextMonthStart", () => {
  it("advances within a year", () => {
    expect(nextMonthStart("2026-03-01")).toBe("2026-04-01");
  });

  it("rolls December over into the next year", () => {
    expect(nextMonthStart("2026-12-01")).toBe("2027-01-01");
  });

  it("pads single-digit months", () => {
    expect(nextMonthStart("2026-08-01")).toBe("2026-09-01");
  });

  it("ignores the day component of the input", () => {
    expect(nextMonthStart("2026-03-17")).toBe("2026-04-01");
  });

  it("returns unparseable input unchanged rather than inventing a date", () => {
    expect(nextMonthStart("not-a-date")).toBe("not-a-date");
  });
});

describe("timeOfDay", () => {
  it("takes the clock straight from the string, with no timezone shift", () => {
    expect(timeOfDay("2026-08-20T09:41:07+00:00")).toBe("09:41");
    expect(timeOfDay("2026-08-20T23:59:00Z")).toBe("23:59");
  });

  it("is empty for a missing or date-only value", () => {
    expect(timeOfDay(null)).toBe("");
    expect(timeOfDay("2026-08-20")).toBe("");
  });
});

// Guards the parse-the-string approach these two share: a first-of-month DATE
// must not slip back a day for a viewer west of UTC.
describe("month and date labels", () => {
  it("labels a first-of-month date without shifting it", () => {
    expect(monthLabel("2026-01-01", true)).toBe("Jan 2026");
    expect(formatDate("2026-01-01")).toBe("1 Jan 2026");
  });

  it("renders an em dash for a missing date", () => {
    expect(formatDate(null)).toBe("—");
    expect(monthLabel(undefined)).toBe("—");
  });
});
