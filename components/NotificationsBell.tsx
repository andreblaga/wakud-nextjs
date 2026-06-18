"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, Loader2 } from "lucide-react";
import type { Notification } from "@/lib/notifications";
import { NOTIFICATION_ICON, SEVERITY_COLOR, TYPE_LABEL } from "@/components/notification-ui";
import { formatDate } from "@/lib/dates";

export default function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const json = (await res.json()) as { notifications: Notification[] };
      setItems(json.notifications ?? []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  }, []);

  // Initial load for the badge count.
  useEffect(() => {
    load();
  }, [load]);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const count = items.length;

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next) load(); // refresh on open
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={toggle}
        className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100"
        aria-label="Notifications"
        aria-expanded={open}
        aria-haspopup="true"
      >
        <Bell className="h-5 w-5" />
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent-500 px-1 text-[10px] font-semibold leading-none text-white">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
            <h3 className="text-sm font-semibold text-slate-700">Notifications</h3>
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {error ? (
              <p className="px-4 py-8 text-center text-sm text-red-600">Couldn&apos;t load notifications.</p>
            ) : count === 0 && loaded ? (
              <p className="px-4 py-10 text-center text-sm text-slate-400">You&apos;re all caught up.</p>
            ) : (
              <ul className="divide-y divide-slate-50">
                {items.map((n) => {
                  const Icon = NOTIFICATION_ICON[n.type];
                  return (
                    <li key={`${n.type}-${n.id}`}>
                      <Link
                        href={n.href}
                        onClick={() => setOpen(false)}
                        className="flex gap-2.5 px-4 py-3 hover:bg-slate-50"
                      >
                        <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${SEVERITY_COLOR[n.severity]}`} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-medium text-slate-800">{n.title}</p>
                            <span className="ml-auto shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
                              {TYPE_LABEL[n.type]}
                            </span>
                          </div>
                          <p className="truncate text-xs text-slate-500">{n.detail}</p>
                          {n.date && <p className="mt-0.5 text-[11px] text-slate-400">{formatDate(n.date)}</p>}
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <Link
            href="/alerts"
            onClick={() => setOpen(false)}
            className="block border-t border-slate-100 px-4 py-2.5 text-center text-xs font-medium text-brand-700 hover:bg-slate-50"
          >
            View all
          </Link>
        </div>
      )}
    </div>
  );
}
