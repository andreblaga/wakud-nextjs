import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { FileStack, Info } from "lucide-react";
import { PageHeader, Card } from "@/components/ui";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/DataTable";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth";
import DocumentFilters from "./DocumentFilters";
import DocumentsTable, { type DocumentRow } from "./DocumentsTable";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

/** Matches classify() in lib/sharepoint/extractors/documents.ts. */
const DOCUMENT_TYPES = [
  "finance",
  "supply_chain",
  "legal",
  "operations",
  "sales",
  "iscc",
  "quality",
  "hse",
  "maintenance",
  "pdf",
  "document",
  "spreadsheet",
  "other",
];

type SearchParams = { q?: string; folder?: string; type?: string; page?: string };

export default function DocumentsPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Documents"
        description="Index of files held in the Barka Operations Hub SharePoint site"
        icon={FileStack}
      />
      <Suspense key={JSON.stringify(searchParams)} fallback={<TableSkeleton columns={6} rows={8} />}>
        <DocumentsContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

/**
 * `%` and `_` are wildcards in SQL LIKE, so a user typing them would silently
 * widen their own search. Escape them (and the escape character itself) so the
 * box matches literally.
 */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

async function DocumentsContent({ searchParams }: { searchParams: SearchParams }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const supabase = createClient();
  if (!supabase) return <ErrorState message="Supabase isn't configured." />;

  const q = (searchParams.q ?? "").trim();
  const folder = searchParams.folder ?? "";
  const type = searchParams.type ?? "";
  const page = Math.max(1, Number(searchParams.page) || 1);
  const from = (page - 1) * PAGE_SIZE;

  // The folder list for the dropdown. Only one column is read, and only for
  // synced rows, so this stays a narrow scan rather than loading the documents
  // themselves. If it ever gets slow it wants a DISTINCT view or an RPC —
  // PostgREST cannot express DISTINCT directly.
  const folderRes = await supabase
    .from("documents")
    .select("source_folder")
    .eq("source", "sharepoint")
    .not("source_folder", "is", null);

  const folders = Array.from(
    new Set(((folderRes.data ?? []) as { source_folder: string | null }[]).map((r) => r.source_folder)),
  )
    .filter((f): f is string => !!f)
    .sort();

  let query = supabase
    .from("documents")
    .select(
      "id, file_name, file_url, document_type, source, source_folder, source_path, file_size_bytes, source_modified_at, uploaded_by",
      { count: "exact" },
    );

  if (q) query = query.ilike("file_name", `%${escapeLike(q)}%`);
  if (folder) query = query.eq("source_folder", folder);
  if (type) query = query.eq("document_type", type);

  const { data, error, count } = await query
    .order("source_modified_at", { ascending: false, nullsFirst: false })
    .range(from, from + PAGE_SIZE - 1);

  if (error) return <ErrorState message={error.message} />;

  const rows = (data ?? []) as DocumentRow[];
  const total = count ?? 0;
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filtered = !!(q || folder || type);

  // Preserve the active filters when moving between pages.
  const hrefFor = (p: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (folder) params.set("folder", folder);
    if (type) params.set("type", type);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `/documents?${qs}` : "/documents";
  };

  return (
    <>
      <Card className="mb-4 flex items-start gap-3 border-brand-100 bg-brand-50/40 px-5 py-3.5">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" />
        <p className="text-xs leading-relaxed text-slate-600">
          This is an <strong>index</strong>, not a copy. The app stores each file&apos;s name, location and
          metadata; the file itself stays in SharePoint. Opening one sends you to SharePoint in a new tab,
          where <strong>your own SharePoint permissions decide whether you can see it</strong> — a file listed
          here may still be closed to you. Nothing on this page writes back to SharePoint.
        </p>
      </Card>

      <DocumentFilters
        folders={folders}
        types={DOCUMENT_TYPES}
        initialQuery={q}
        initialFolder={folder}
        initialType={type}
      />

      {rows.length > 0 ? (
        <>
          <DocumentsTable
            rows={rows}
            title={`${total.toLocaleString("en-GB")} ${filtered ? "matching " : ""}file${total === 1 ? "" : "s"}`}
          />

          {lastPage > 1 && (
            <div className="mt-4 flex items-center justify-between text-sm">
              <p className="text-xs text-slate-500">
                Showing {(from + 1).toLocaleString("en-GB")}–
                {Math.min(from + PAGE_SIZE, total).toLocaleString("en-GB")} of{" "}
                {total.toLocaleString("en-GB")}
              </p>
              <div className="flex items-center gap-2">
                {page > 1 ? (
                  <Link
                    href={hrefFor(page - 1)}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Previous
                  </Link>
                ) : (
                  <span className="rounded-lg border border-slate-100 px-3 py-1.5 text-xs text-slate-300">
                    Previous
                  </span>
                )}
                <span className="text-xs text-slate-500">
                  Page {page} of {lastPage.toLocaleString("en-GB")}
                </span>
                {page < lastPage ? (
                  <Link
                    href={hrefFor(page + 1)}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Next
                  </Link>
                ) : (
                  <span className="rounded-lg border border-slate-100 px-3 py-1.5 text-xs text-slate-300">
                    Next
                  </span>
                )}
              </div>
            </div>
          )}
        </>
      ) : (
        <EmptyState
          title={filtered ? "No matching documents" : "No documents indexed yet"}
          message={
            filtered
              ? "Try a different search term, folder or type."
              : "Run the SharePoint sync from Data Sync to build the index."
          }
          icon={FileStack}
        />
      )}
    </>
  );
}
