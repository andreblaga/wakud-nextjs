/**
 * SharePoint sync smoke test — read-only, writes nothing.
 *
 * Exercises the real sync read path end to end: app-only token, site + drive
 * resolution, full delta traversal, document-row construction, workbook download
 * and parse, and the natural-key uniqueness the upserts depend on. Run it after
 * touching anything under lib/sharepoint/, and after IT rotates the client secret.
 *
 *   npm i -D tsx          # once
 *   node --import tsx --env-file=.env.local scripts/verify-sharepoint.mts
 *
 * Needs MS_* + SHAREPOINT_SITE_URL in .env.local. Takes ~30s (the library holds
 * ~14,400 items). Last green run: 2026-08-19 — 14,393 items, 8,186 indexable
 * documents, 108 stock rows, zero key collisions.
 */
import { readConfig, resolveSite, listAllItems, downloadFile, itemPath } from "@/lib/sharepoint/graph";
import { buildDocumentRows } from "@/lib/sharepoint/extractors/documents";
import { extractStock } from "@/lib/sharepoint/extractors/stock";
import { extractProduction } from "@/lib/sharepoint/extractors/production";
import { ACTIVE_SOURCES, BLOCKED_SOURCES } from "@/lib/sharepoint/sources";

const KNOWN_DRIVE_ID =
  "b!YtIPQWn9lEqE0exZPkIcy4EWTDYiAopHivZclDgaOD2_6Im8GDbxSKrqY9V_t7em";

const t0 = Date.now();
let failures = 0;
const check = (label: string, ok: boolean, detail = "") => {
  if (!ok) failures++;
  console.log(`${ok ? "ok  " : "FAIL"}  ${label.padEnd(34)} ${detail}`);
};

const cfg = readConfig();
check("config parsed", !!cfg, cfg ? `${cfg.hostname}${cfg.sitePath}` : "MS_* / SHAREPOINT_SITE_URL missing");
if (!cfg) process.exit(1);

const { driveId, driveName, drives } = await resolveSite(cfg);
check("app-only token + site resolved", true, `${drives.length} library ("${driveName}")`);
check("drive id matches the documented one", driveId === KNOWN_DRIVE_ID);

const items = await listAllItems(cfg, driveId);
check("delta traversal", items.length > 1000, `${items.length} items in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

const { rows: docs, skipped } = buildDocumentRows(items);
check("document rows built", docs.length > 0, `${docs.length} indexable, ${skipped} noise skipped`);
check("every row has a webUrl", docs.every((d) => d.file_url.length > 0));
check(
  "source_ref is unique (upsert key)",
  docs.length === new Set(docs.map((d) => d.source_ref)).size,
  "documents_source_ref_uidx is the ON CONFLICT target",
);

const byPath = new Map(items.filter((i) => i.file).map((i) => [itemPath(i), i]));
for (const source of ACTIVE_SOURCES) {
  const item = byPath.get(source.path);
  check(`source found: ${source.key}`, !!item, source.path);
  if (!item) continue;

  const buffer = await downloadFile(cfg, driveId, item.id);
  check(`downloaded: ${source.key}`, buffer.length > 0, `${(buffer.length / 1024).toFixed(0)}KB`);

  if (source.key === "stock_levels") {
    const { rows, skipped: sheetsSkipped } = await extractStock(buffer);
    check("stock parsed", rows.length > 0, `${rows.length} rows, ${new Set(rows.map((r) => r.product)).size} products`);
    check("no sheets skipped", sheetsSkipped.length === 0, sheetsSkipped.join("; "));
    check(
      "(product, month) is unique",
      rows.length === new Set(rows.map((r) => `${r.product}|${r.month}`)).size,
      "stock_levels UNIQUE(product, month) depends on this",
    );
    console.table(rows.filter((r) => r.product === "B100").slice(0, 3));
  }

  if (source.key === "production_plan") {
    const { rows, skipped: monthsSkipped, warnings } = await extractProduction(buffer);
    check("production derived", rows.length > 0, `${rows.length} month(s) with recorded activity`);
    check(
      "month is unique (upsert key)",
      rows.length === new Set(rows.map((r) => r.month)).size,
      "production_plan.month is UNIQUE",
    );
    check("no target invented", rows.every((r) => r.target_output === null), "the workbook records actuals only");
    check("months without activity are withheld", monthsSkipped.length > 0, monthsSkipped.join("; "));
    // Warnings are expected — they describe the SOURCE data, not a code fault.
    for (const w of warnings) console.log(`warn  ${"source data".padEnd(34)} ${w}`);
    console.table(rows);
  }
}

check("blocked areas carry a reason", BLOCKED_SOURCES.every((s) => !!s.blocked && !!s.question), `${BLOCKED_SOURCES.length} areas`);

console.log(`\n${failures === 0 ? "PASS" : `FAIL (${failures})`} — ${((Date.now() - t0) / 1000).toFixed(1)}s. Nothing was written to SharePoint or Supabase.`);
process.exit(failures === 0 ? 0 : 1);
