import "server-only";
import type { z } from "zod";
import { createClient, type ServerSupabaseClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth";
import { canWrite } from "@/lib/permissions";
import type { FormState } from "@/lib/form-state";

export type { FormState } from "@/lib/form-state";

export type Writer = { supabase: ServerSupabaseClient; userId: string };

/**
 * Gate a write server-side (defense in depth on top of RLS): require a
 * signed-in user whose role may write `domain`. Returns either the writer
 * (authed Supabase client + user id) or a FormState error to return as-is.
 */
export async function requireWriter(
  domain: string,
): Promise<{ writer: Writer } | { error: FormState }> {
  const supabase = createClient();
  if (!supabase) return { error: { ok: false, formError: "Supabase isn't configured." } };
  const user = await getSessionUser();
  if (!user) return { error: { ok: false, formError: "You must be signed in." } };
  if (!canWrite(user.role, domain)) {
    return { error: { ok: false, formError: "Your role can't perform this action." } };
  }
  return { writer: { supabase, userId: user.id } };
}

/** Flatten a ZodError into a { field: message } map (first message per field). */
export function zodErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

/** Normalize a "YYYY-MM" month input to a first-of-month DATE ("YYYY-MM-01"). */
export function normalizeMonth(value: string | null | undefined): string | null {
  if (!value) return null;
  return /^\d{4}-\d{2}$/.test(value) ? `${value}-01` : value;
}
