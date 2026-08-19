"use client";

import { ExternalLink } from "lucide-react";
import { DataTable, type Column } from "@/components/DataTable";
import ExportExcelButton from "@/components/ExportExcelButton";
import type { ExportColumn } from "@/lib/export-excel";
import { formatDate } from "@/lib/dates";

export type DocumentRow = {
  id: string;
  file_name: string;
  file_url: string;
  document_type: string;
  source: string;
  source_folder: string | null;
  source_path: string | null;
  file_size_bytes: number | null;
  source_modified_at: string | null;
  uploaded_by: string | null;
};

/** Bytes as a short human-readable size; null stays null so the table shows a dash. */
function formatBytes(bytes: number | null): string | null {
  if (bytes === null || Number.isNaN(bytes)) return null;
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[i]}`;
}

const columns: Column<DocumentRow>[] = [
  {
    key: "file_name",
    header: "File",
    render: (d) =>
      d.file_url ? (
        // Opens the file in SharePoint, not in the app — see the note above the
        // table. noopener because target=_blank otherwise exposes window.opener.
        <a
          href={d.file_url}
          target="_blank"
          rel="noopener noreferrer"
          title={`Open in SharePoint: ${d.source_path ?? d.file_name}`}
          className="inline-flex items-start gap-1 font-medium text-brand-700 hover:underline"
        >
          <span className="break-all">{d.file_name}</span>
          <ExternalLink className="mt-0.5 h-3 w-3 shrink-0 opacity-60" />
        </a>
      ) : (
        <span className="break-all font-medium text-slate-900">{d.file_name}</span>
      ),
  },
  {
    key: "source_folder",
    header: "Folder",
    render: (d) => <span className="text-xs text-slate-500">{d.source_folder}</span>,
  },
  {
    key: "document_type",
    header: "Type",
    render: (d) => (
      <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs capitalize text-slate-600">
        {d.document_type.replace(/_/g, " ")}
      </span>
    ),
  },
  { key: "uploaded_by", header: "Last modified by" },
  {
    key: "source_modified_at",
    header: "Modified",
    render: (d) => (d.source_modified_at ? formatDate(d.source_modified_at) : null),
  },
  {
    key: "file_size_bytes",
    header: "Size",
    align: "right",
    render: (d) => formatBytes(d.file_size_bytes),
  },
];

const exportColumns: ExportColumn<DocumentRow>[] = [
  { header: "File name", value: (d) => d.file_name },
  { header: "Folder", value: (d) => d.source_folder },
  { header: "Type", value: (d) => d.document_type },
  { header: "Path", value: (d) => d.source_path },
  { header: "Last modified by", value: (d) => d.uploaded_by },
  { header: "Modified", value: (d) => d.source_modified_at },
  { header: "Size (bytes)", value: (d) => d.file_size_bytes ?? null },
  { header: "Source", value: (d) => d.source },
  { header: "Link", value: (d) => d.file_url },
];

export default function DocumentsTable({
  rows,
  title,
}: {
  rows: DocumentRow[];
  title?: string;
}) {
  return (
    <>
      <div className="mb-3 flex justify-end">
        {/* Exports the rows on this page — the same set the table is showing. */}
        <ExportExcelButton
          filename="wakud-documents"
          sheetName="Documents"
          columns={exportColumns}
          rows={rows}
          label="Export page to Excel"
        />
      </div>
      <DataTable columns={columns} rows={rows} getRowKey={(d) => d.id} title={title} />
    </>
  );
}
