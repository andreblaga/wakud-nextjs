"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2, ExternalLink, Handshake, FileText, FileStack, ListChecks } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  MIN_QUERY_LENGTH,
  type SearchGroup,
  type SearchResult,
  type SearchResultType,
} from "@/lib/search";

const ICON: Record<SearchResultType, LucideIcon> = {
  deal: Handshake,
  contract: FileText,
  document: FileStack,
  task: ListChecks,
};

const DEBOUNCE_MS = 250;

export default function GlobalSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [groups, setGroups] = useState<SearchGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  // Lets a slow response for an old query be discarded when a newer one lands.
  const requestId = useRef(0);

  const trimmed = query.trim();
  const enoughText = trimmed.length >= MIN_QUERY_LENGTH;

  /** Every result across groups, in render order — the arrow keys walk this. */
  const flat = useMemo(() => groups.flatMap((g) => g.results), [groups]);

  // Debounced fetch. Nothing fires below MIN_QUERY_LENGTH.
  useEffect(() => {
    if (!enoughText) {
      setGroups([]);
      setLoading(false);
      setError(false);
      return;
    }
    setLoading(true);
    const id = ++requestId.current;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const json = (await res.json()) as { groups?: SearchGroup[] };
        if (id !== requestId.current) return; // a newer query has overtaken this one
        setGroups(json.groups ?? []);
        setError(false);
      } catch {
        if (id !== requestId.current) return;
        setError(true);
        setGroups([]);
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [trimmed, enoughText]);

  // Reset the highlight whenever the result set changes.
  useEffect(() => setActive(0), [groups]);

  // "/" or Cmd/Ctrl-K focuses the box from anywhere, unless the user is already
  // typing into some other field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement;
      const typing =
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        el instanceof HTMLSelectElement ||
        (el instanceof HTMLElement && el.isContentEditable);

      const isSlash = e.key === "/" && !typing;
      const isCmdK = e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey);
      if (isSlash || isCmdK) {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
        setOpen(true);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Close when clicking away.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const go = useCallback(
    (result: SearchResult) => {
      setOpen(false);
      if (result.external) {
        window.open(result.href, "_blank", "noopener,noreferrer");
      } else {
        router.push(result.href);
      }
    },
    [router],
  );

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      // First Esc closes the dropdown; a second on an open box clears the text.
      if (open && flat.length > 0) setOpen(false);
      else {
        setQuery("");
        inputRef.current?.blur();
      }
      return;
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (flat.length === 0) return;
      e.preventDefault();
      setOpen(true);
      setActive((i) => {
        const next = e.key === "ArrowDown" ? i + 1 : i - 1;
        return (next + flat.length) % flat.length;
      });
      return;
    }
    if (e.key === "Enter") {
      const target = flat[active];
      if (target) {
        e.preventDefault();
        go(target);
      }
    }
  }

  const showPanel = open && enoughText;
  let index = -1; // running position across groups, matched against `active`

  return (
    <div ref={boxRef} className="relative max-w-md flex-1">
      <div className="flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 focus-within:bg-white focus-within:ring-1 focus-within:ring-brand-500">
        <Search className="h-4 w-4 shrink-0 text-slate-400" />
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={showPanel}
          aria-controls="global-search-results"
          aria-label="Search deals, contracts, documents and tasks"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Search deals, contracts, documents…"
          className="w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
        />
        {loading ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-slate-400" />
        ) : (
          <kbd className="hidden shrink-0 rounded border border-slate-300 px-1.5 py-0.5 text-[10px] text-slate-400 sm:block">
            /
          </kbd>
        )}
      </div>

      {showPanel && (
        <div
          id="global-search-results"
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-2 max-h-[28rem] overflow-y-auto rounded-xl border border-slate-200 bg-white py-1.5 shadow-lg"
        >
          {loading && groups.length === 0 && (
            <p className="px-4 py-6 text-center text-xs text-slate-400">Searching…</p>
          )}

          {!loading && error && (
            <p className="px-4 py-6 text-center text-xs text-red-600">
              Search failed. Check your connection and try again.
            </p>
          )}

          {!loading && !error && groups.length === 0 && (
            <p className="px-4 py-6 text-center text-xs text-slate-400">
              No matches for “{trimmed}”.
            </p>
          )}

          {groups.map((group) => {
            const Icon = ICON[group.type];
            return (
              <div key={group.type} className="py-1">
                <div className="flex items-baseline justify-between px-4 py-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    {group.label}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {group.total > group.results.length
                      ? `${group.results.length} of ${group.total}`
                      : group.total}
                  </span>
                </div>

                {group.results.map((r) => {
                  index += 1;
                  const isActive = index === active;
                  return (
                    <button
                      key={`${r.type}-${r.id}`}
                      type="button"
                      role="option"
                      aria-selected={isActive}
                      onMouseEnter={() => setActive(flat.indexOf(r))}
                      onClick={() => go(r)}
                      className={`flex w-full items-start gap-2.5 px-4 py-2 text-left ${
                        isActive ? "bg-slate-100" : "hover:bg-slate-50"
                      }`}
                    >
                      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1 truncate text-sm text-slate-700">
                          <span className="truncate">{r.title}</span>
                          {r.external && <ExternalLink className="h-3 w-3 shrink-0 text-slate-400" />}
                        </span>
                        {r.subtitle && (
                          <span className="block truncate text-xs text-slate-400">{r.subtitle}</span>
                        )}
                      </span>
                    </button>
                  );
                })}

                {group.seeAllHref && group.total > group.results.length && (
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      router.push(group.seeAllHref as string);
                    }}
                    className="w-full px-4 py-1.5 text-left text-xs font-medium text-brand-700 hover:underline"
                  >
                    See all {group.total} {group.label.toLowerCase()}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
