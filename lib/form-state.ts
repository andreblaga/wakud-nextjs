/** Shared form-action state (client-safe — no server-only imports). */
export type FormState = {
  ok: boolean;
  /** Per-field validation messages, keyed by field name. */
  errors?: Record<string, string>;
  /** Form-level error (auth, DB, etc.). */
  formError?: string;
  /** Neutral success/info message (e.g. reorder check result). */
  message?: string;
};

export const INITIAL_FORM_STATE: FormState = { ok: false };
