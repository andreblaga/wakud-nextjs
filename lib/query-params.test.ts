import { describe, it, expect } from "vitest";
import { getParam, setParam } from "@/lib/query-params";

/**
 * Every list filter in this app lives in the URL so a filtered view survives a
 * refresh and can be pasted to a colleague. That only holds if setting one
 * parameter preserves the others — global search sends people to
 * /contracts?q=acme, and a status chip that dropped q would silently widen the
 * list back out to everything.
 */
describe("getParam", () => {
  it("reads a single value", () => {
    expect(getParam({ status: "new" }, "status")).toBe("new");
  });

  it("treats missing, empty and repeated values as absent", () => {
    expect(getParam({}, "status")).toBeNull();
    expect(getParam(undefined, "status")).toBeNull();
    expect(getParam({ status: "" }, "status")).toBeNull();
    expect(getParam({ status: ["a", "b"] }, "status")).toBeNull();
  });
});

describe("setParam", () => {
  it("sets a parameter on a bare path", () => {
    expect(setParam("/feedback", {}, "status", "new")).toBe("/feedback?status=new");
  });

  it("replaces a parameter that is already set", () => {
    expect(setParam("/feedback", { status: "new" }, "status", "done")).toBe("/feedback?status=done");
  });

  it("removes a parameter, and the whole query string with it", () => {
    expect(setParam("/feedback", { status: "new" }, "status", null)).toBe("/feedback");
  });

  it("keeps the other parameters on the way through", () => {
    expect(setParam("/feedback", { category: "idea", archived: "1" }, "status", "declined")).toBe(
      "/feedback?category=idea&archived=1&status=declined",
    );
  });

  it("escapes values rather than pasting them in raw", () => {
    expect(setParam("/feedback", {}, "q", "a b&c=d")).toBe("/feedback?q=a+b%26c%3Dd");
  });

  it("carries repeated parameters through unflattened", () => {
    expect(setParam("/feedback", { tag: ["a", "b"] }, "status", "new")).toBe(
      "/feedback?tag=a&tag=b&status=new",
    );
  });
});
