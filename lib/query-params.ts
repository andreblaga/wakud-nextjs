/**
 * Building list-page URLs that keep the parameters already on them.
 *
 * Every filter in this app lives in the query string rather than in component
 * state, so a filtered view survives a refresh and can be pasted to someone
 * else. That only works if setting one parameter preserves the rest — global
 * search sends people to `/contracts?q=acme`, and a status chip that dropped
 * `q` would silently widen the list back out to everything.
 */

export type SearchParams = Record<string, string | string[] | undefined>;

/** Read a single-valued parameter, ignoring a repeated one. */
export function getParam(params: SearchParams | undefined, key: string): string | null {
  const value = params?.[key];
  return typeof value === "string" && value !== "" ? value : null;
}

/**
 * Href with `key` set to `value`, or removed when `value` is null.
 * Every other parameter is carried through, repeats included.
 */
export function setParam(
  basePath: string,
  params: SearchParams | undefined,
  key: string,
  value: string | null,
): string {
  const next = new URLSearchParams();
  for (const [k, v] of Object.entries(params ?? {})) {
    if (k === key || v === undefined) continue;
    if (Array.isArray(v)) v.forEach((one) => next.append(k, one));
    else next.set(k, v);
  }
  if (value !== null) next.set(key, value);
  const query = next.toString();
  return query ? `${basePath}?${query}` : basePath;
}
