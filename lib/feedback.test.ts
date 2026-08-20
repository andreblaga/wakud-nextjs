import { describe, it, expect } from "vitest";
import {
  canCommentOnFeedback,
  canSubmitFeedback,
  canTriageFeedback,
  feedbackWithNewReplies,
  isFeedbackCategory,
  isFeedbackStatus,
  resolutionRequiredFor,
  validateTriage,
} from "@/lib/feedback";
import { ROLES, type Role, type SessionUser } from "@/lib/permissions";

const user = (role: Role | null): SessionUser => ({
  id: "user-1",
  email: "someone@wakud.com",
  role,
});

/**
 * The deliberate exception at the heart of this module.
 *
 * executive_viewer holds no write domains at all — it cannot touch a deal, a
 * contract or an invoice. Feedback is not business data, and a suggestion box
 * the CEO cannot post to is not a suggestion box, so submitting and commenting
 * are gated on being signed in and nothing else. Triage is the opposite: it
 * decides what happens to other people's requests, so it stays with admin/gm.
 */
describe("executive_viewer — read-only on the business, not on feedback", () => {
  const viewer = user("executive_viewer");

  it("CAN submit feedback", () => {
    expect(canSubmitFeedback(viewer)).toBe(true);
  });

  it("CAN comment on feedback", () => {
    expect(canCommentOnFeedback(viewer)).toBe(true);
  });

  it("CANNOT change status or write a resolution", () => {
    expect(canTriageFeedback(viewer.role)).toBe(false);
  });
});

describe("who may submit and comment", () => {
  it("is every signed-in role, without exception", () => {
    for (const role of ROLES) {
      expect(canSubmitFeedback(user(role))).toBe(true);
      expect(canCommentOnFeedback(user(role))).toBe(true);
    }
    // Including someone signed in with no role assigned yet.
    expect(canSubmitFeedback(user(null))).toBe(true);
  });

  it("is nobody at all when signed out", () => {
    expect(canSubmitFeedback(null)).toBe(false);
    expect(canCommentOnFeedback(null)).toBe(false);
    expect(canSubmitFeedback(undefined)).toBe(false);
  });
});

describe("who may triage", () => {
  it("is admin and gm, and only them", () => {
    expect(canTriageFeedback("admin")).toBe(true);
    expect(canTriageFeedback("gm")).toBe(true);
    for (const role of ["sales", "operations", "finance", "executive_viewer"] as Role[]) {
      expect(canTriageFeedback(role)).toBe(false);
    }
    expect(canTriageFeedback(null)).toBe(false);
    expect(canTriageFeedback(undefined)).toBe(false);
  });
});

describe("status and category guards", () => {
  it("accept the configured values", () => {
    for (const s of ["new", "reviewing", "planned", "done", "declined"]) {
      expect(isFeedbackStatus(s)).toBe(true);
    }
    for (const c of ["idea", "problem", "question", "data"]) {
      expect(isFeedbackCategory(c)).toBe(true);
    }
  });

  it("reject anything else, inherited Object properties included", () => {
    for (const bad of ["", "closed", "wontfix", "__proto__", "constructor", null, 7]) {
      expect(isFeedbackStatus(bad)).toBe(false);
      expect(isFeedbackCategory(bad)).toBe(false);
    }
  });
});

/**
 * A request that vanishes without explanation is how people stop submitting,
 * so "declined" cannot be set without a reason. The rule is checked in the
 * server action, which is what these tests stand behind — the form's required
 * marker is only a hint.
 */
describe("validateTriage", () => {
  it("requires a resolution to decline", () => {
    const result = validateTriage({ status: "declined", resolution: null });
    expect(result.ok).toBe(false);
    expect(result).toMatchObject({ field: "resolution" });
  });

  it("does not accept whitespace as a reason", () => {
    expect(validateTriage({ status: "declined", resolution: "   \n\t " }).ok).toBe(false);
  });

  it("accepts a declined item that explains itself", () => {
    const result = validateTriage({ status: "declined", resolution: "Duplicate of #12." });
    expect(result).toEqual({ ok: true, status: "declined", resolution: "Duplicate of #12." });
  });

  it("trims the stored reason", () => {
    const result = validateTriage({ status: "declined", resolution: "  Not this quarter.  " });
    expect(result).toMatchObject({ resolution: "Not this quarter." });
  });

  it("leaves every other status free to have no resolution", () => {
    for (const status of ["new", "reviewing", "planned", "done"]) {
      expect(validateTriage({ status })).toEqual({ ok: true, status, resolution: null });
      expect(resolutionRequiredFor(status as never)).toBe(false);
    }
  });

  it("still keeps a resolution written against a non-declined status", () => {
    expect(validateTriage({ status: "done", resolution: "Shipped in a2a50c1." })).toEqual({
      ok: true,
      status: "done",
      resolution: "Shipped in a2a50c1.",
    });
  });

  it("rejects a status that is not one of ours, however it arrived", () => {
    // Server actions are reachable by direct POST, so this is the real gate.
    for (const status of ["wontfix", "", null, undefined, "__proto__"]) {
      const result = validateTriage({ status, resolution: "because" });
      expect(result.ok).toBe(false);
      expect(result).toMatchObject({ field: "status" });
    }
  });
});

/**
 * "Someone replied and you haven't answered" derived from timestamps alone.
 * No read-state table: another table to keep correct, and one that goes stale
 * the moment anything writes to it out of band.
 */
describe("feedbackWithNewReplies", () => {
  const me = "me";
  const ids = ["f1", "f2"];

  it("flags an item whose only comment is from somebody else", () => {
    const result = feedbackWithNewReplies(me, ids, [
      { feedback_id: "f1", author_id: "andre", created_at: "2026-08-20T10:00:00Z" },
    ]);
    expect(result).toEqual([{ feedbackId: "f1", latestReplyAt: "2026-08-20T10:00:00Z" }]);
  });

  it("stays quiet once the submitter has answered", () => {
    expect(
      feedbackWithNewReplies(me, ids, [
        { feedback_id: "f1", author_id: "andre", created_at: "2026-08-20T10:00:00Z" },
        { feedback_id: "f1", author_id: me, created_at: "2026-08-20T11:00:00Z" },
      ]),
    ).toEqual([]);
  });

  it("speaks up again when they reply after that", () => {
    const result = feedbackWithNewReplies(me, ids, [
      { feedback_id: "f1", author_id: "andre", created_at: "2026-08-20T10:00:00Z" },
      { feedback_id: "f1", author_id: me, created_at: "2026-08-20T11:00:00Z" },
      { feedback_id: "f1", author_id: "andre", created_at: "2026-08-20T12:00:00Z" },
    ]);
    expect(result).toEqual([{ feedbackId: "f1", latestReplyAt: "2026-08-20T12:00:00Z" }]);
  });

  it("never flags the submitter's own comments back at them", () => {
    expect(
      feedbackWithNewReplies(me, ids, [
        { feedback_id: "f1", author_id: me, created_at: "2026-08-20T10:00:00Z" },
        { feedback_id: "f1", author_id: me, created_at: "2026-08-20T11:00:00Z" },
      ]),
    ).toEqual([]);
  });

  it("ignores threads on items the viewer did not submit", () => {
    expect(
      feedbackWithNewReplies(me, ["f1"], [
        { feedback_id: "f9", author_id: "andre", created_at: "2026-08-20T10:00:00Z" },
      ]),
    ).toEqual([]);
  });

  // A reply landing in the same instant is not something anyone is waiting on.
  it("treats an identical timestamp as answered, not waiting", () => {
    expect(
      feedbackWithNewReplies(me, ids, [
        { feedback_id: "f1", author_id: "andre", created_at: "2026-08-20T10:00:00Z" },
        { feedback_id: "f1", author_id: me, created_at: "2026-08-20T10:00:00Z" },
      ]),
    ).toEqual([]);
  });

  it("takes the newest reply per item, not the first it happens to see", () => {
    const result = feedbackWithNewReplies(me, ids, [
      { feedback_id: "f1", author_id: "andre", created_at: "2026-08-20T09:00:00Z" },
      { feedback_id: "f1", author_id: "sara", created_at: "2026-08-20T15:00:00Z" },
      { feedback_id: "f1", author_id: "andre", created_at: "2026-08-20T12:00:00Z" },
    ]);
    expect(result).toEqual([{ feedbackId: "f1", latestReplyAt: "2026-08-20T15:00:00Z" }]);
  });

  it("returns several items, most recently answered first", () => {
    const result = feedbackWithNewReplies(me, ids, [
      { feedback_id: "f1", author_id: "andre", created_at: "2026-08-19T10:00:00Z" },
      { feedback_id: "f2", author_id: "sara", created_at: "2026-08-20T10:00:00Z" },
    ]);
    expect(result.map((r) => r.feedbackId)).toEqual(["f2", "f1"]);
  });

  it("copes with an empty thread", () => {
    expect(feedbackWithNewReplies(me, ids, [])).toEqual([]);
  });
});
