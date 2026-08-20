/**
 * Feedback — the rules, free of any server or React import so both sides and
 * the tests can use them.
 *
 * Two decisions are load-bearing here and are enforced in code rather than
 * left to the UI:
 *
 *   1. Anyone signed in may submit and comment, executive_viewer included.
 *      Feedback is not business data — locking the CEO out of the suggestion
 *      box would be absurd — so submission is never gated on canWrite(). Same
 *      deliberate exception Discussions makes; see supabase/phase6-feedback.sql.
 *
 *   2. Declining a request without saying why is how a feedback channel dies.
 *      A resolution is required to move an item to "declined", checked in the
 *      server action so a hand-rolled POST cannot skip it.
 */

import { canWrite, type Role, type SessionUser } from "@/lib/permissions";

export const FEEDBACK_STATUSES = ["new", "reviewing", "planned", "done", "declined"] as const;
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];

export const FEEDBACK_CATEGORIES = ["idea", "problem", "question", "data"] as const;
export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number];

export const STATUS_LABELS: Record<FeedbackStatus, string> = {
  new: "New",
  reviewing: "Reviewing",
  planned: "Planned",
  done: "Done",
  declined: "Declined",
};

export const CATEGORY_LABELS: Record<FeedbackCategory, string> = {
  idea: "Idea",
  problem: "Problem",
  question: "Question",
  data: "Data",
};

const STATUS_NAMES: ReadonlySet<string> = new Set(FEEDBACK_STATUSES);
const CATEGORY_NAMES: ReadonlySet<string> = new Set(FEEDBACK_CATEGORIES);

export function isFeedbackStatus(value: unknown): value is FeedbackStatus {
  return typeof value === "string" && STATUS_NAMES.has(value);
}

export function isFeedbackCategory(value: unknown): value is FeedbackCategory {
  return typeof value === "string" && CATEGORY_NAMES.has(value);
}

/**
 * Triage domain. No domain role lists "feedback" in supabase/roles-rls.sql's
 * write matrix, so canWrite() passes only the roles holding "*" — admin and gm.
 * Using the domain rather than a bespoke check means <RoleGate domain="feedback">
 * and requireWriter("feedback") gate the UI and the action with one rule.
 */
export const FEEDBACK_TRIAGE_DOMAIN = "feedback";

/** Whether `role` may set a status, write a resolution, or convert to a task. */
export function canTriageFeedback(role: Role | null | undefined): boolean {
  return canWrite(role, FEEDBACK_TRIAGE_DOMAIN);
}

/**
 * Whether this user may submit feedback or post a comment.
 *
 * Being signed in is the whole test, on purpose — see the note at the top of
 * this file. Written as a function rather than inlined so the rule has one
 * home and a test can hold it there.
 */
export function canSubmitFeedback(user: SessionUser | null | undefined): boolean {
  return !!user;
}

/** Same rule as submitting: any signed-in user may join the conversation. */
export function canCommentOnFeedback(user: SessionUser | null | undefined): boolean {
  return !!user;
}

/** Statuses that may not be set without an explanation. */
export const RESOLUTION_REQUIRED_STATUSES: readonly FeedbackStatus[] = ["declined"];

export function resolutionRequiredFor(status: FeedbackStatus): boolean {
  return RESOLUTION_REQUIRED_STATUSES.includes(status);
}

export type TriageValidation =
  | { ok: true; status: FeedbackStatus; resolution: string | null }
  | { ok: false; field: "status" | "resolution"; message: string };

/**
 * Validate a triage submission.
 *
 * Lives here, not in the zod schema, because it is a cross-field rule the
 * server action must apply on every path — including a request that never went
 * near the form.
 */
export function validateTriage(input: {
  status: unknown;
  resolution?: string | null;
}): TriageValidation {
  if (!isFeedbackStatus(input.status)) {
    return { ok: false, field: "status", message: "Pick a valid status." };
  }
  const resolution = (input.resolution ?? "").trim();

  if (resolutionRequiredFor(input.status) && resolution === "") {
    return {
      ok: false,
      field: "resolution",
      message: "Say why this is being declined — a request that vanishes without explanation is how people stop submitting.",
    };
  }

  return { ok: true, status: input.status, resolution: resolution === "" ? null : resolution };
}

// ----------------------------------------------------------------------------
// Unanswered replies, derived from timestamps alone.
// ----------------------------------------------------------------------------

export type CommentStamp = {
  feedback_id: string;
  author_id: string;
  created_at: string;
};

/**
 * Which of the viewer's own feedback items are waiting on them.
 *
 * "Waiting" means the newest comment is by somebody else and is newer than
 * anything the viewer has said on that item. That is the whole definition, and
 * it needs no read-state table: the timestamps already say who spoke last.
 * Read state stored per user would be another table to keep correct, and would
 * go stale the moment anything wrote to it out of band.
 *
 * `comments` may contain items the viewer did not submit; pass the ids they did
 * as `ownFeedbackIds` so somebody else's thread never lands in their bell.
 */
export function feedbackWithNewReplies(
  viewerId: string,
  ownFeedbackIds: Iterable<string>,
  comments: CommentStamp[],
): { feedbackId: string; latestReplyAt: string }[] {
  const own = new Set(ownFeedbackIds);
  const latestOther = new Map<string, string>();
  const latestSelf = new Map<string, string>();

  for (const c of comments) {
    if (!own.has(c.feedback_id) || !c.created_at) continue;
    const bucket = c.author_id === viewerId ? latestSelf : latestOther;
    const current = bucket.get(c.feedback_id);
    if (!current || c.created_at > current) bucket.set(c.feedback_id, c.created_at);
  }

  const out: { feedbackId: string; latestReplyAt: string }[] = [];
  // Array.from rather than iterating the Map directly: tsconfig targets ES5.
  for (const [feedbackId, replyAt] of Array.from(latestOther.entries())) {
    const mine = latestSelf.get(feedbackId);
    // Strictly newer: a reply posted in the same instant as the viewer's own
    // comment is not something they are waiting on.
    if (!mine || replyAt > mine) out.push({ feedbackId, latestReplyAt: replyAt });
  }
  return out.sort((a, b) => b.latestReplyAt.localeCompare(a.latestReplyAt));
}
