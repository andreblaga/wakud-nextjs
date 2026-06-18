"use client";

import { useState } from "react";
import { FileDown, Loader2 } from "lucide-react";
import { exportRowsToExcel, type ExportColumn } from "@/lib/export-excel";

/**
 * Reusable "Export to Excel" button. Lives in client components so the `rows`
 * it receives are whatever is currently in view (e.g. after filtering).
 */
export default function ExportExcelButton<T>({
  filename,
  sheetName,
  columns,
  rows,
  label = "Export to Excel",
}: {
  filename: string;
  sheetName?: string;
  columns: ExportColumn<T>[];
  rows: T[];
  label?: string;
}) {
  const [busy, setBusy] = useState(false);

  async function handleExport() {
    if (rows.length === 0) return;
    setBusy(true);
    try {
      await exportRowsToExcel({ filename, sheetName, columns, rows });
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={busy || rows.length === 0}
      title={rows.length === 0 ? "Nothing to export" : `Export ${rows.length} row(s)`}
      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
      {busy ? "Exporting…" : label}
    </button>
  );
}
