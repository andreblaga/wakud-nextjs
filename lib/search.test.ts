import { describe, it, expect } from "vitest";
import { sanitizeQuery, MIN_QUERY_LENGTH } from "@/lib/search";

/**
 * The sanitiser is the boundary between user text and a PostgREST filter
 * string. /api/search builds `or=(a.ilike.%x%,b.ilike.%x%)` by concatenation,
 * so any comma, parenthesis or dot the user types would be parsed as filter
 * syntax rather than matched as a character. `%` and `_` are LIKE wildcards
 * that would silently widen the search.
 */
describe("sanitizeQuery", () => {
  it("leaves ordinary text alone", () => {
    expect(sanitizeQuery("invoice 2026")).toBe("invoice 2026");
    expect(sanitizeQuery("Barka-Oman_Q3")).toBe("Barka-Oman_Q3".replace("_", " "));
  });

  it("strips the characters PostgREST reads as filter syntax", () => {
    for (const c of [",", "(", ")", ".", "\\", '"', "'"]) {
      expect(sanitizeQuery(`a${c}b`)).toBe("a b");
    }
  });

  it("strips LIKE wildcards so a search cannot widen itself", () => {
    expect(sanitizeQuery("%")).toBe("");
    expect(sanitizeQuery("a%b")).toBe("a b");
    expect(sanitizeQuery("a_b")).toBe("a b");
  });

  // The shape of a filter-injection attempt: closing the or() group and
  // appending another filter. Nothing structural may survive.
  it("defuses an attempt to close the filter group and add a condition", () => {
    const attack = 'x),status.eq.confirmed,(name.ilike.%';
    const clean = sanitizeQuery(attack);
    for (const c of [",", "(", ")", ".", "%"]) {
      expect(clean).not.toContain(c);
    }
  });

  it("collapses whitespace and trims", () => {
    expect(sanitizeQuery("  a   b  ")).toBe("a b");
    expect(sanitizeQuery("   ")).toBe("");
  });

  // A query that sanitises down to almost nothing must fall below the minimum
  // so the route returns empty rather than matching most of the table.
  it("reduces a punctuation-only query below the minimum length", () => {
    expect(sanitizeQuery("%%").length).toBeLessThan(MIN_QUERY_LENGTH);
    expect(sanitizeQuery("...").length).toBeLessThan(MIN_QUERY_LENGTH);
  });
});
