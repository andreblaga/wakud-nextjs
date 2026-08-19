/**
 * Shared shapes for global search (TopBar box + /api/search).
 *
 * Deliberately free of server-only imports so the client component can use the
 * types and constants without pulling the route handler into the bundle.
 */

export type SearchResultType = "deal" | "contract" | "document" | "task";

export type SearchResult = {
  id: string;
  type: SearchResultType;
  title: string;
  subtitle: string | null;
  href: string;
  /** True for links that leave the app (a document opens in SharePoint). */
  external?: boolean;
};

export type SearchGroup = {
  type: SearchResultType;
  label: string;
  /** Total matches, which may exceed the results returned. */
  total: number;
  results: SearchResult[];
  /** Where "see all" goes, or null when no list page can take the query. */
  seeAllHref: string | null;
};

export type SearchResponse = { groups: SearchGroup[] };

/** Below this, searching is more noise than signal — the UI does not fire. */
export const MIN_QUERY_LENGTH = 2;

/** Per-group cap in the dropdown. */
export const GROUP_LIMIT = 5;

/**
 * PostgREST builds `or=(a.ilike.%x%,b.ilike.%x%)` from a plain string, so commas,
 * parentheses, dots and backslashes in the user's text would be read as filter
 * syntax rather than as characters to match. `%` and `_` are LIKE wildcards and
 * would silently widen the search. Strip the lot: this is a search box, not a
 * query language, and dropping a stray bracket is better than a broken filter.
 */
export function sanitizeQuery(raw: string): string {
  return raw
    .replace(/[(),.\\%_*"']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
