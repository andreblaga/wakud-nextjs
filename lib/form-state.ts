/** Shared form-action state (client-safe — no server-only imports). */
export type FormState = {
  ok: boolean;
  /** Per-field validation messages, keyed by field name. */
  errors?: Record<string, string>;
  /** Form-level error (auth, DB, etc.). */
  formError?: string;
  /** Neutral success/info message (e.g. reorder check result). */
  message?: string;
  /**
   * A one-time value the user must copy before it's gone — currently only
   * generated passwords from the admin screen. Held in memory for the life of
   * the response and never written to the audit log, server logs, or the DB.
   * Kept separate from `message` so a copy button can put just the value on the
   * clipboard rather than the whole sentence.
   */
  secret?: string;
};

export const INITIAL_FORM_STATE: FormState = { ok: false };
