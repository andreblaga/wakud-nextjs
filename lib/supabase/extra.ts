/**
 * Access tables added in Phase 4 migrations (tasks, channels, messages) that
 * aren't in the generated lib/supabase/types.ts yet. Re-run
 * `npx supabase gen types typescript ... > lib/supabase/types.ts` after the
 * migrations are applied to make these fully typed and drop this shim.
 *
 * Works with either the server or browser Supabase client. Callers cast the
 * returned `.data` to the hand-written Row types for that table.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
export function extraTable(client: any, name: string): any {
  return client.from(name);
}
