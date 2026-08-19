import { RefreshCw, FileStack, AlertTriangle, CheckCircle2, HelpCircle } from "lucide-react";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card } from "@/components/ui";
import { SOURCES, BLOCKED_SOURCES, ACTIVE_SOURCES } from "@/lib/sharepoint/sources";
import RunSyncButton from "./RunSyncButton";

export const dynamic = "force-dynamic";

type AreaResult = {
  area: string;
  status: "ok" | "skipped" | "error" | "blocked";
  read: number;
  upserted: number;
  skipped: number;
  errored: number;
  note?: string;
};

type Run = {
  id: string;
  status: string;
  trigger: string;
  started_at: string;
  finished_at: string | null;
  duration_ms: number | null;
  areas: AreaResult[] | null;
  rows_read: number;
  rows_upserted: number;
  rows_errored: number;
  error: string | null;
};

function fmt(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

const STATUS_STYLE: Record<string, string> = {
  success: "bg-brand-100 text-brand-800",
  ok: "bg-brand-100 text-brand-800",
  partial: "bg-amber-100 text-amber-800",
  running: "bg-blue-100 text-blue-800",
  failed: "bg-red-100 text-red-800",
  error: "bg-red-100 text-red-800",
  blocked: "bg-slate-100 text-slate-600",
  skipped: "bg-slate-100 text-slate-600",
};

function Pill({ status }: { status: string }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[status] ?? "bg-slate-100 text-slate-600"}`}>
      {status}
    </span>
  );
}

export default async function SyncPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  // Mirrors /admin: isAdmin(), never canWrite() — gm holds "*" and must not
  // reach system settings. The route handler re-checks this independently.
  if (!isAdmin(user.role)) redirect("/");

  const supabase = createClient();
  let runs: Run[] = [];
  let tableMissing = false;

  if (supabase) {
    const { data, error } = await supabase
      .from("sync_runs" as any)
      .select("*")
      .order("started_at", { ascending: false })
      .limit(10);
    if (error) tableMissing = true;
    else runs = (data ?? []) as unknown as Run[];
  }

  const last = runs[0];
  const docCount = supabase
    ? (await supabase
        .from("documents")
        .select("id", { count: "exact", head: true })
        .eq("entity_type", "sharepoint")).count ?? 0
    : 0;

  return (
    <div>
      <PageHeader
        title="Data Sync"
        description="Read-only import from the Barka Operations Hub SharePoint site. The app never writes back — data out is Export to Excel."
        icon={RefreshCw}
        action={<RunSyncButton disabled={tableMissing} />}
      />

      {tableMissing && (
        <Card className="mb-6 border-amber-200 bg-amber-50 p-4">
          <div className="flex gap-3">
            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
            <div className="text-sm text-amber-900">
              <p className="font-medium">Migration not run yet</p>
              <p className="mt-1">
                Run <code className="rounded bg-amber-100 px-1">supabase/phase5-sharepoint-sync.sql</code> in the
                Supabase SQL Editor, then regenerate <code className="rounded bg-amber-100 px-1">lib/supabase/types.ts</code>.
                The sync can&apos;t record runs until the <code className="rounded bg-amber-100 px-1">sync_runs</code> table exists.
              </p>
            </div>
          </div>
        </Card>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Last run</p>
          <p className="mt-2 text-lg font-semibold text-slate-900">{last ? fmt(last.started_at) : "Never"}</p>
          {last && <p className="mt-1 text-xs text-slate-400">{last.duration_ms ? `${(last.duration_ms / 1000).toFixed(1)}s` : "—"} · {last.trigger}</p>}
        </Card>
        <Card className="p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Documents indexed</p>
          <p className="mt-2 text-lg font-semibold text-slate-900">{docCount.toLocaleString()}</p>
          <p className="mt-1 text-xs text-slate-400">Files readable from SharePoint</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Sources</p>
          <p className="mt-2 text-lg font-semibold text-slate-900">
            {ACTIVE_SOURCES.length + 1} active · {BLOCKED_SOURCES.length} blocked
          </p>
          <p className="mt-1 text-xs text-slate-400">of {SOURCES.length + 1} mapped areas</p>
        </Card>
      </div>

      {last?.areas?.length ? (
        <Card className="mb-6 overflow-hidden">
          <div className="border-b border-slate-200 px-5 py-3">
            <h2 className="text-sm font-semibold text-slate-900">Last run detail</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-2 text-left font-medium">Area</th>
                <th className="px-3 py-2 text-left font-medium">Status</th>
                <th className="px-3 py-2 text-right font-medium">Read</th>
                <th className="px-3 py-2 text-right font-medium">Upserted</th>
                <th className="px-3 py-2 text-right font-medium">Errors</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {last.areas.map((a) => (
                <tr key={a.area} className="align-top">
                  <td className="px-5 py-3">
                    <p className="font-medium text-slate-900">{a.area}</p>
                    {a.note && <p className="mt-0.5 max-w-xl text-xs leading-relaxed text-slate-500">{a.note}</p>}
                  </td>
                  <td className="px-3 py-3"><Pill status={a.status} /></td>
                  <td className="px-3 py-3 text-right tabular-nums text-slate-700">{a.read || "—"}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-slate-700">{a.upserted || "—"}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-slate-700">{a.errored || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : null}

      <Card className="mb-6 overflow-hidden">
        <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-3">
          <FileStack className="h-4 w-4 text-slate-400" />
          <h2 className="text-sm font-semibold text-slate-900">Mapped sources</h2>
        </div>
        <div className="divide-y divide-slate-100">
          {SOURCES.map((s) => (
            <div key={`${s.key}`} className="px-5 py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-medium text-slate-900">
                    {s.status === "active" ? (
                      <CheckCircle2 className="h-4 w-4 text-brand-600" />
                    ) : (
                      <HelpCircle className="h-4 w-4 text-amber-500" />
                    )}
                    {s.label}
                  </p>
                  <p className="mt-1 break-all font-mono text-xs text-slate-400">{s.path}</p>
                  <p className="mt-2 max-w-3xl text-xs leading-relaxed text-slate-600">
                    {s.status === "active" ? s.notes : s.blocked}
                  </p>
                  {s.question && (
                    <p className="mt-2 max-w-3xl rounded-md bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">
                      <span className="font-medium">Needs from the team: </span>
                      {s.question}
                    </p>
                  )}
                </div>
                <Pill status={s.status === "active" ? "ok" : "blocked"} />
              </div>
            </div>
          ))}
        </div>
      </Card>

      {runs.length > 1 && (
        <Card className="overflow-hidden">
          <div className="border-b border-slate-200 px-5 py-3">
            <h2 className="text-sm font-semibold text-slate-900">Run history</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-2 text-left font-medium">Started</th>
                <th className="px-3 py-2 text-left font-medium">Status</th>
                <th className="px-3 py-2 text-right font-medium">Read</th>
                <th className="px-3 py-2 text-right font-medium">Upserted</th>
                <th className="px-3 py-2 text-right font-medium">Errors</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {runs.map((r) => (
                <tr key={r.id}>
                  <td className="px-5 py-2 text-slate-700">{fmt(r.started_at)}</td>
                  <td className="px-3 py-2"><Pill status={r.status} /></td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-700">{r.rows_read}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-700">{r.rows_upserted}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-700">{r.rows_errored}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
