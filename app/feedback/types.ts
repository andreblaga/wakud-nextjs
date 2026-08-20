import type { FeedbackCategory, FeedbackStatus } from "@/lib/feedback";

export type FeedbackRow = {
  id: string;
  title: string;
  description: string | null;
  status: FeedbackStatus;
  category: FeedbackCategory | null;
  resolution: string | null;
  submitted_by: string | null;
  task_id: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

export type FeedbackCommentRow = {
  id: string;
  feedback_id: string;
  body: string;
  author_id: string;
  created_at: string;
};

/** One row of the list, with its thread size counted alongside. */
export type FeedbackListRow = Pick<
  FeedbackRow,
  "id" | "title" | "status" | "category" | "submitted_by" | "created_at" | "task_id" | "archived_at"
> & { commentCount: number };
