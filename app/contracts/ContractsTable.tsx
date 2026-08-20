"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Search, Pencil } from "lucide-react";
import { DataTable, type Column } from "@/components/DataTable";
import { StatusBadge } from "@/components/ui";
import { ShowArchivedToggle } from "@/components/ShowArchivedToggle";
import ExportExcelButton from "@/components/ExportExcelButton";
import { formatUSD } from "@/lib/currency";
import { formatDate } from "@/lib/dates";
import type { ExportColumn } from "@/lib/export-excel";

export type ContractRow = {
  id: string;
  name: string;
  buyer: string;
  price_per_tonne: number | null;
  is_active: boolean | null;
  status: string | null;
  start_date: string | null;
  end_date: string | null;
  renewal_date: string | null;
  archived_at: string | null;
};

const STATUSES = ["active", "pending", "expired", "terminated"];

const baseColumns: Column<ContractRow>[] = [
  {
    key: "name",
    header: "Contract",
    render: (c) => (
      <span className="flex items-center gap-2">
        <Link href={`/contracts/${c.id}`} className="font-medium text-slate-900 hover:text-brand-700 hover:underline">
          {c.name}
        </Link>
        {c.archived_at && <StatusBadge status="archived" />}
      </span>
    ),
  },
  { key: "buyer", header: "Buyer" },
  { key: "price_per_tonne", header: "Price /t", align: "right", render: (c) => formatUSD(c.price_per_tonne, { decimals: true }) },
  { key: "start_date", header: "Start", render: (c) => formatDate(c.start_date) },
  { key: "end_date", header: "End", render: (c) => formatDate(c.end_date) },
  { key: "renewal_date", header: "Renewal", render: (c) => formatDate(c.renewal_date) },
  { key: "status", header: "Status", render: (c) => (c.status ? <StatusBadge status={c.status} /> : null) },
];

const exportColumns: ExportColumn<ContractRow>[] = [
  { header: "Contract", value: (c) => c.name },
  { header: "Buyer", value: (c) => c.buyer },
  { header: "Price /t (USD)", value: (c) => c.price_per_tonne ?? null },
  { header: "Start", value: (c) => c.start_date },
  { header: "End", value: (c) => c.end_date },
  { header: "Renewal", value: (c) => c.renewal_date },
  { header: "Status", value: (c) => c.status },
  { header: "Active", value: (c) => (c.is_active ? "Yes" : "No") },
  { header: "Archived", value: (c) => (c.archived_at ? "Yes" : "No") },
];

const editColumn: Column<ContractRow> = {
  key: "edit",
  header: "",
  align: "right",
  render: (c) => (
    <Link href={`/contracts/${c.id}/edit`} className="inline-flex text-slate-400 hover:text-brand-700" aria-label={`Edit ${c.name}`}>
      <Pencil className="h-4 w-4" />
    </Link>
  ),
};

export default function ContractsTable({
  contracts,
  canEdit = false,
  showArchived = false,
  toggleArchivedHref,
}: {
  contracts: ContractRow[];
  canEdit?: boolean;
  /** Whether the server query included archived contracts. */
  showArchived?: boolean;
  /** Href that flips that, with the other query parameters kept. */
  toggleArchivedHref: string;
}) {
  const columns = canEdit ? [...baseColumns, editColumn] : baseColumns;
  const [status, setStatus] = useState("");
  const [activeOnly, setActiveOnly] = useState(false);
  // Seeded from ?q= so global search's "see all contracts" lands here with its
  // query already applied; still freely editable afterwards.
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return contracts.filter((c) => {
      if (status && c.status !== status) return false;
      if (activeOnly && !c.is_active) return false;
      if (q && !`${c.name} ${c.buyer}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [contracts, status, activeOnly, query]);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
          <Search className="h-4 w-4 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, buyer…"
            className="w-48 outline-none placeholder:text-slate-400"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm capitalize outline-none focus:border-brand-500"
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s} className="capitalize">
              {s}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={activeOnly}
            onChange={(e) => setActiveOnly(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-brand-700 focus:ring-brand-500"
          />
          Active only
        </label>
        <ShowArchivedToggle href={toggleArchivedHref} showArchived={showArchived} />
        <span className="ml-auto text-xs text-slate-400">
          {rows.length} of {contracts.length}
        </span>
        <ExportExcelButton filename="wakud-contracts" sheetName="Contracts" columns={exportColumns} rows={rows} />
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(c) => c.id}
        rowClassName={(c) => (c.archived_at ? "opacity-55" : "")}
        footer={rows.length === 0 ? "No contracts match the current filters." : undefined}
      />
    </div>
  );
}
