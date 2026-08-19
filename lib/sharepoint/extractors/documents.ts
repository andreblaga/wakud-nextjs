import "server-only";
import { itemPath, topFolder, type DriveItem } from "@/lib/sharepoint/graph";

/**
 * Library file listing -> documents.
 *
 * This is the part of Phase 5 that delivers on the original architecture:
 * "documents (contracts, ISCC certs, QC PDFs) stay in SharePoint, the app
 * reads" (project.md §8b). The bytes never move — each row stores the file's
 * SharePoint webUrl, so opening a document from the app opens it in SharePoint,
 * with SharePoint's own permissions still applying.
 *
 * ~8,300 files across the site's 16 numbered top-level folders, of which ~4,400
 * are PDFs (certificates, lab reports, invoices, delivery notes).
 */

export type DocumentRow = {
  entity_type: "sharepoint";
  entity_id: string;
  document_type: string;
  file_name: string;
  file_url: string;
  file_size_bytes: number;
  mime_type: string | null;
  uploaded_by: string | null;
  uploaded_at: string | null;
  notes: string | null;
  source: "sharepoint";
  /** Graph driveItem id — the upsert key (documents_source_ref_uidx). */
  source_ref: string;
  source_path: string;
  source_folder: string;
  source_modified_at: string | null;
  synced_at: string;
};

/**
 * Classify a file for the Documents page filter. Extension first, then folder,
 * because the numbered taxonomy is reliable where filenames are not.
 */
export function classify(path: string, name: string): string {
  const ext = name.includes(".") ? name.split(".").pop()!.toLowerCase() : "";
  const p = path.toLowerCase();

  if (p.includes("/iscc") || p.includes("11_esg")) return "iscc";
  if (p.includes("04_quality")) return "quality";
  if (p.includes("invoice") || p.includes("07_finance")) return "finance";
  if (p.includes("06_sales")) return "sales";
  if (p.includes("05_supply_chain")) return "supply_chain";
  if (p.includes("09_legal") || p.includes("contract")) return "legal";
  if (p.includes("03_hse")) return "hse";
  if (p.includes("02_maintenance")) return "maintenance";
  if (p.includes("01_operations")) return "operations";
  if (["xlsx", "xlsm", "xls", "csv"].includes(ext)) return "spreadsheet";
  if (["docx", "doc"].includes(ext)) return "document";
  if (ext === "pdf") return "pdf";
  return "other";
}

/** Files that are noise in a document index rather than records. */
function isIndexable(item: DriveItem, path: string): boolean {
  if (!item.file) return false;
  const name = item.name.toLowerCase();
  if (name.startsWith("~$")) return false; // Office lock files
  if (name === "thumbs.db" || name === ".ds_store") return false;
  if (["css", "js", "aspx", "master", "webpart", "dwp"].includes(name.split(".").pop() ?? "")) {
    return false; // SharePoint's own site assets
  }
  if (path.toLowerCase().startsWith("forms/")) return false;
  return true;
}

export function buildDocumentRows(items: DriveItem[], now = new Date()): {
  rows: DocumentRow[];
  skipped: number;
} {
  const rows: DocumentRow[] = [];
  let skipped = 0;
  const syncedAt = now.toISOString();

  for (const item of items) {
    const path = itemPath(item);
    if (!isIndexable(item, path)) {
      if (item.file) skipped++;
      continue;
    }

    rows.push({
      entity_type: "sharepoint",
      entity_id: item.id,
      document_type: classify(path, item.name),
      file_name: item.name,
      // webUrl, not a download link: the file stays in SharePoint and the user's
      // own SharePoint permissions still decide whether they can open it.
      file_url: item.webUrl ?? "",
      file_size_bytes: item.size ?? 0,
      mime_type: item.file?.mimeType ?? null,
      uploaded_by: item.lastModifiedBy?.user?.displayName ?? null,
      uploaded_at: item.createdDateTime ?? null,
      notes: null,
      source: "sharepoint",
      source_ref: item.id,
      source_path: path,
      source_folder: topFolder(path),
      source_modified_at: item.lastModifiedDateTime ?? null,
      synced_at: syncedAt,
    });
  }

  return { rows, skipped };
}
