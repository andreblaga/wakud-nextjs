"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, Loader2, X } from "lucide-react";

/**
 * Filter bar for the document index. Filtering happens on the server — every
 * change rewrites the query string and the page re-renders with a new query, so
 * the browser never holds more than one page of the 8k+ rows.
 */
export default function DocumentFilters({
  folders,
  types,
  initialQuery,
  initialFolder,
  initialType,
}: {
  folders: string[];
  types: string[];
  initialQuery: string;
  initialFolder: string;
  initialType: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [text, setText] = useState(initialQuery);
  // Skips the debounce on first render so landing on ?q=… does not immediately
  // re-navigate to the URL it is already on.
  const mounted = useRef(false);

  function apply(next: { q?: string; folder?: string; type?: string }) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    params.delete("page"); // any filter change returns to the first page
    const qs = params.toString();
    startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname));
  }

  // Debounce the free-text box so typing does not fire a query per keystroke.
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    const id = setTimeout(() => {
      if (text !== initialQuery) apply({ q: text });
    }, 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  const selectClass =
    "rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500";

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <div className="relative min-w-[16rem] flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Search file names…"
          aria-label="Search file names"
          className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-8 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
        />
        {pending && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />
        )}
      </div>

      <select
        value={initialFolder}
        onChange={(e) => apply({ folder: e.target.value })}
        aria-label="Filter by folder"
        className={selectClass}
      >
        <option value="">All folders</option>
        {folders.map((f) => (
          <option key={f} value={f}>
            {f}
          </option>
        ))}
      </select>

      <select
        value={initialType}
        onChange={(e) => apply({ type: e.target.value })}
        aria-label="Filter by document type"
        className={selectClass}
      >
        <option value="">All types</option>
        {types.map((t) => (
          <option key={t} value={t}>
            {t.replace(/_/g, " ")}
          </option>
        ))}
      </select>

      {(initialQuery || initialFolder || initialType) && (
        <button
          type="button"
          onClick={() => {
            setText("");
            apply({ q: "", folder: "", type: "" });
          }}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
        >
          <X className="h-3.5 w-3.5" /> Clear
        </button>
      )}
    </div>
  );
}
