"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, Pencil } from "lucide-react";
import { DataTable, type Column } from "@/components/DataTable";
import { StatusBadge } from "@/components/ui";
import ExportExcelButton from "@/components/ExportExcelButton";
import { formatNumber, formatUSD, formatPercent } from "@/lib/currency";
import type { ExportColumn } from "@/lib/export-excel";

export type DealRow = {
  id: string;
  deal_id: string;
  name: string;
  deal_type: string;
  status: string;
  buyer: string;
  tonnes: number | null;
  profit: number | null;
  margin: number | null;
  profit_per_tonne: number | null;
};

const STATUSES = ["draft", "approved", "confirmed", "in_transit", "delivered", "paid"];
const TYPES = ["production", "arbitrage"];

const baseColumns: Column<DealRow>[] = [
  { key: "deal_id", header: "Deal ID", render: (d) => <span className="font-medium text-slate-900">{d.deal_id}</span> },
  { key: "name", header: "Name" },
  { key: "deal_type", header: "Type", render: (d) => <span className="capitalize">{d.deal_type}</span> },
  { key: "buyer", header: "Buyer" },
  { key: "tonnes", header: "Tonnes", align: "right", render: (d) => formatNumber(d.tonnes) },
  { key: "profit_per_tonne", header: "Profit/t", align: "right", render: (d) => formatUSD(d.profit_per_tonne, { decimals: true }) },
  { key: "profit", header: "Profit", align: "right", render: (d) => formatUSD(d.profit) },
  { key: "margin", header: "Margin", align: "right", render: (d) => formatPercent(d.margin, { isFraction: false }) },
  { key: "status", header: "Status", render: (d) => <StatusBadge status={d.status} /> },
];

const exportColumns: ExportColumn<DealRow>[] = [
  { header: "Deal ID", value: (d) => d.deal_id },
  { header: "Name", value: (d) => d.name },
  { header: "Type", value: (d) => d.deal_type },
  { header: "Buyer", value: (d) => d.buyer },
  { header: "Tonnes", value: (d) => d.tonnes ?? null },
  { header: "Profit/t (USD)", value: (d) => d.profit_per_tonne ?? null },
  { header: "Profit (USD)", value: (d) => d.profit ?? null },
  { header: "Margin (%)", value: (d) => d.margin ?? null },
  { header: "Status", value: (d) => d.status },
];

const editColumn: Column<DealRow> = {
  key: "edit",
  header: "",
  align: "right",
  render: (d) => (
    <Link href={`/deals/${d.id}/edit`} className="inline-flex text-slate-400 hover:text-brand-700" aria-label={`Edit ${d.deal_id}`}>
      <Pencil className="h-4 w-4" />
    </Link>
  ),
};

export default function DealsTable({ deals, canEdit = false }: { deals: DealRow[]; canEdit?: boolean }) {
  const columns = canEdit ? [...baseColumns, editColumn] : baseColumns;
  const [status, setStatus] = useState("");
  const [type, setType] = useState("");
  const [query, setQuery] = useState("");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return deals.filter((d) => {
      if (status && d.status !== status) return false;
      if (type && d.deal_type !== type) return false;
      if (q && !(`${d.name} ${d.buyer} ${d.deal_id}`.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [deals, status, type, query]);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
          <Search className="h-4 w-4 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, buyer, ID…"
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
            <option key={s} value={s} className="capitalize">{s.replace(/_/g, " ")}</option>
          ))}
        </select>
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm capitalize outline-none focus:border-brand-500"
        >
          <option value="">All types</option>
          {TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <span className="ml-auto text-xs text-slate-400">
          {rows.length} of {deals.length}
        </span>
        <ExportExcelButton filename="wakud-deals" sheetName="Deals" columns={exportColumns} rows={rows} />
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(d) => d.id}
        footer={rows.length === 0 ? "No deals match the current filters." : undefined}
      />
    </div>
  );
}
