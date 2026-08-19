"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

/**
 * Triggers the sync via the admin-gated route handler.
 *
 * A full run traverses ~14,000 library items, so it takes tens of seconds —
 * hence the explicit in-flight state rather than optimistic UI.
 */
export default function RunSyncButton({ disabled }: { disabled?: boolean }) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function run() {
    setRunning(true);
    setMessage(null);
    try {
      const res = await fetch("/api/sync/sharepoint", { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        setMessage(json.error ?? `Sync failed (${res.status}).`);
      } else {
        setMessage(
          `${json.status}: ${json.totals.upserted} rows upserted, ` +
            `${json.totals.errored} errored, in ${(json.durationMs / 1000).toFixed(1)}s.`,
        );
        router.refresh();
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Sync request failed.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="text-right">
      <button
        type="button"
        onClick={run}
        disabled={running || disabled}
        className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <RefreshCw className={`h-4 w-4 ${running ? "animate-spin" : ""}`} />
        {running ? "Syncing…" : "Run sync now"}
      </button>
      {message && <p className="mt-2 max-w-sm text-xs text-slate-500">{message}</p>}
    </div>
  );
}
