import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  readConfig,
  missingConfigKeys,
  resolveSite,
  listAllItems,
  downloadFile,
  itemPath,
  type DriveItem,
} from "@/lib/sharepoint/graph";
import { SOURCES, BLOCKED_SOURCES, DOCUMENT_INDEX_LABEL } from "@/lib/sharepoint/sources";
import { buildDocumentRows } from "@/lib/sharepoint/extractors/documents";
import { extractStock } from "@/lib/sharepoint/extractors/stock";

/**
 * The SharePoint sync.
 *
 * One-way and read-only: SharePoint -> Supabase. Nothing in this file writes to
 * SharePoint, and the Graph client physically cannot (see lib/sharepoint/graph.ts).
 *
 * Idempotent: every upsert is keyed on a natural key that survives re-runs —
 * documents on source_ref (the Graph driveItem id), stock_levels on
 * (product, month) — so
 * running twice produces the same rows, never duplicates.
 *
 * Uses the service-role client because it writes to tables whose RLS write
 * matrix only admits specific staff roles; the sync isn't a person. Everything
 * it writes is readable through normal RLS afterwards.
 */

export type AreaResult = {
  area: string;
  status: "ok" | "skipped" | "error" | "blocked";
  read: number;
  upserted: number;
  skipped: number;
  errored: number;
  note?: string;
};

export type SyncResult = {
  runId: string | null;
  status: "success" | "partial" | "failed";
  durationMs: number;
  areas: AreaResult[];
  totals: { read: number; upserted: number; skipped: number; errored: number };
  error?: string;
};

const CHUNK = 500;

async function upsertChunked(
  client: NonNullable<ReturnType<typeof createAdminClient>>,
  table: string,
  rows: Record<string, unknown>[],
  onConflict: string,
): Promise<{ upserted: number; errored: number; error?: string }> {
  let upserted = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK);
    // `table` is a runtime string, so the generated per-table overloads can't
    // narrow it; the shape is guaranteed by the extractor that produced `rows`.
    const { error } = await (client.from(table as never) as any).upsert(slice, {
      onConflict,
      ignoreDuplicates: false,
    });
    if (error) {
      return { upserted, errored: rows.length - upserted, error: error.message };
    }
    upserted += slice.length;
  }
  return { upserted, errored: 0 };
}

export async function runSharePointSync(
  opts: { trigger?: "manual" | "scheduled"; triggeredBy?: string | null } = {},
): Promise<SyncResult> {
  const startedAt = Date.now();
  const areas: AreaResult[] = [];

  const cfg = readConfig();
  const service = createAdminClient();

  if (!service) {
    return {
      runId: null,
      status: "failed",
      durationMs: 0,
      areas: [],
      totals: { read: 0, upserted: 0, skipped: 0, errored: 0 },
      error:
        "SUPABASE_SERVICE_ROLE_KEY isn't set on the server, so the sync can't write. " +
        "In production this must be set in Vercel — the deployment cannot see .env.local.",
    };
  }

  if (!cfg) {
    return {
      runId: null,
      status: "failed",
      durationMs: 0,
      areas: [],
      totals: { read: 0, upserted: 0, skipped: 0, errored: 0 },
      error: `SharePoint isn't configured — missing: ${missingConfigKeys().join(", ") || "SHAREPOINT_SITE_URL is not a valid URL"}.`,
    };
  }

  // Open the run row first so a crash still leaves a visible "running" record.
  const { data: run } = await service
    .from("sync_runs" as any)
    .insert({
      source: "sharepoint",
      status: "running",
      trigger: opts.trigger ?? "manual",
      triggered_by: opts.triggeredBy ?? null,
    })
    .select("id")
    .single();
  const runId = (run as { id: string } | null)?.id ?? null;

  let fatal: string | undefined;

  try {
    const { driveId } = await resolveSite(cfg);
    const items: DriveItem[] = await listAllItems(cfg, driveId);

    // --- 1. Document index ---------------------------------------------------
    try {
      const { rows, skipped } = buildDocumentRows(items);
      const res = await upsertChunked(service, "documents", rows, "source_ref");
      areas.push({
        area: DOCUMENT_INDEX_LABEL,
        status: res.error ? "error" : "ok",
        read: rows.length,
        upserted: res.upserted,
        skipped,
        errored: res.errored,
        note:
          res.error ??
          `Indexed every file in the library. Bytes stay in SharePoint; rows store the webUrl.`,
      });
    } catch (err) {
      areas.push({
        area: DOCUMENT_INDEX_LABEL,
        status: "error",
        read: 0,
        upserted: 0,
        skipped: 0,
        errored: 0,
        note: err instanceof Error ? err.message : String(err),
      });
    }

    // --- 2. Active workbook sources -----------------------------------------
    const byPath = new Map(items.filter((i) => i.file).map((i) => [itemPath(i), i]));

    for (const source of SOURCES.filter((s) => s.status === "active")) {
      try {
        const item = byPath.get(source.path);
        if (!item) {
          areas.push({
            area: source.label,
            status: "error",
            read: 0,
            upserted: 0,
            skipped: 0,
            errored: 0,
            note:
              `Not found at the pinned path "${source.path}". The file was moved or renamed — ` +
              `do not fall back to a same-named copy, 120 spreadsheet filenames in this library are duplicated.`,
          });
          continue;
        }

        const buffer = await downloadFile(cfg, driveId, item.id);

        if (source.key === "stock_levels") {
          const { rows, skipped } = await extractStock(buffer);
          const res = await upsertChunked(service, "stock_levels", rows, "product,month");
          areas.push({
            area: source.label,
            status: res.error ? "error" : "ok",
            read: rows.length,
            upserted: res.upserted,
            skipped: skipped.length,
            errored: res.errored,
            note: res.error ?? [source.notes, ...skipped].filter(Boolean).join(" | "),
          });
        }
      } catch (err) {
        areas.push({
          area: source.label,
          status: "error",
          read: 0,
          upserted: 0,
          skipped: 0,
          errored: 0,
          note: err instanceof Error ? err.message : String(err),
        });
      }
    }
  } catch (err) {
    fatal = err instanceof Error ? err.message : String(err);
  }

  // --- 3. Record the blocked areas so the status page is the whole truth -----
  for (const s of BLOCKED_SOURCES) {
    areas.push({
      area: s.label,
      status: "blocked",
      read: 0,
      upserted: 0,
      skipped: 0,
      errored: 0,
      note: s.blocked,
    });
  }

  const counted = areas.filter((a) => a.status !== "blocked");
  const totals = counted.reduce(
    (acc, a) => ({
      read: acc.read + a.read,
      upserted: acc.upserted + a.upserted,
      skipped: acc.skipped + a.skipped,
      errored: acc.errored + a.errored,
    }),
    { read: 0, upserted: 0, skipped: 0, errored: 0 },
  );

  const status: SyncResult["status"] = fatal
    ? "failed"
    : counted.some((a) => a.status === "error")
      ? "partial"
      : "success";
  const durationMs = Date.now() - startedAt;

  if (runId) {
    await service
      .from("sync_runs" as any)
      .update({
        status,
        finished_at: new Date().toISOString(),
        duration_ms: durationMs,
        areas: areas as unknown as Record<string, unknown>[],
        rows_read: totals.read,
        rows_upserted: totals.upserted,
        rows_skipped: totals.skipped,
        rows_errored: totals.errored,
        error: fatal ?? null,
      })
      .eq("id", runId);
  }

  return { runId, status, durationMs, areas, totals, error: fatal };
}
