import { describe, it, expect } from "vitest";
import { changedFields, summarizeChange } from "@/lib/audit";

/**
 * The per-record history on every detail page is only worth showing if it says
 * what changed. logAudit writes an asymmetric pair — `old_value` is the whole
 * existing row (`SELECT *`) while `new_value` is the update payload — so a
 * naive key union reports every column as touched on every save.
 */
describe("changedFields", () => {
  it("reports only the fields whose value actually moved", () => {
    const before = { id: "u1", name: "Jebel", buyer: "Acme", tonnes: 5000, created_at: "2026-01-01" };
    const after = { name: "Jebel", buyer: "Contoso", tonnes: 6000 };
    expect(changedFields(before, after)).toEqual(["buyer", "tonnes"]);
  });

  it("ignores columns the update never carried", () => {
    // id/created_at are in the SELECT * snapshot but not in the payload.
    const before = { id: "u1", created_at: "2026-01-01", status: "draft" };
    const after = { status: "draft" };
    expect(changedFields(before, after)).toEqual([]);
  });

  it("treats a numeric string and its number as the same value", () => {
    // DECIMAL columns arrive as numbers or numeric strings depending on the path.
    expect(changedFields({ tonnes: 5000 }, { tonnes: "5000" })).toEqual([]);
    expect(changedFields({ tonnes: "5000" }, { tonnes: 5001 })).toEqual(["tonnes"]);
  });

  it("does not confuse booleans with 0/1", () => {
    expect(changedFields({ is_active: true }, { is_active: 1 })).toEqual(["is_active"]);
    expect(changedFields({ is_active: true }, { is_active: true })).toEqual([]);
  });

  it("distinguishes null from an empty string", () => {
    expect(changedFields({ notes: null }, { notes: "" })).toEqual(["notes"]);
    expect(changedFields({ notes: null }, { notes: null })).toEqual([]);
  });

  it("compares nested values structurally", () => {
    expect(changedFields({ meta: { a: 1 } }, { meta: { a: 1 } })).toEqual([]);
    expect(changedFields({ meta: { a: 1 } }, { meta: { a: 2 } })).toEqual(["meta"]);
  });

  it("counts every field as new when there is no before snapshot", () => {
    expect(changedFields(null, { name: "Jebel", buyer: "Acme" })).toEqual(["name", "buyer"]);
  });
});

describe("summarizeChange", () => {
  it("labels a create and a delete", () => {
    expect(summarizeChange({ old_value: null, new_value: { name: "x" } })).toBe("created");
    expect(summarizeChange({ old_value: { name: "x" }, new_value: null })).toBe("removed");
  });

  it("names the changed fields when there are few", () => {
    expect(summarizeChange({ old_value: { a: 1, b: 2 }, new_value: { a: 9, b: 2 } })).toBe("a");
  });

  it("truncates a long list rather than printing every column", () => {
    const before = { a: 1, b: 1, c: 1, d: 1, e: 1 };
    const after = { a: 2, b: 2, c: 2, d: 2, e: 2 };
    expect(summarizeChange({ old_value: before, new_value: after })).toBe("a, b, c +2 more");
  });

  it("says so when a save touched nothing", () => {
    expect(summarizeChange({ old_value: { a: 1 }, new_value: { a: 1 } })).toBe("no field changed");
  });
});
