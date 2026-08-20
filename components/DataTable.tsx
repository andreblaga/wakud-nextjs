import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { AlertCircle, Inbox } from "lucide-react";
import { Card } from "@/components/ui";

export type Column<T> = {
  /** Unique key; also used as the property accessor when `render` is omitted. */
  key: string;
  header: string;
  render?: (row: T) => ReactNode;
  align?: "left" | "right";
  /** Extra classes applied to each cell in this column. */
  className?: string;
};

/**
 * Reusable data table. Presentational + server-renderable — pages fetch on the
 * server and pass rows in. Pair with EmptyState/ErrorState/TableSkeleton for
 * the non-happy paths (see the page components).
 */
export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  title,
  footer,
  rowClassName,
}: {
  columns: Column<T>[];
  rows: T[];
  getRowKey: (row: T, index: number) => string | number;
  title?: string;
  footer?: ReactNode;
  /** Extra classes per row — used to mute archived records. */
  rowClassName?: (row: T, index: number) => string;
}) {
  return (
    <Card className="overflow-hidden">
      {title && (
        <div className="border-b border-slate-100 px-5 py-3">
          <h2 className="text-sm font-semibold text-slate-700">{title}</h2>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={`px-5 py-2.5 font-medium ${c.align === "right" ? "text-right" : ""}`}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={getRowKey(row, i)}
                className={`border-b border-slate-50 last:border-0 hover:bg-slate-50/60 ${
                  rowClassName?.(row, i) ?? ""
                }`}
              >
                {columns.map((c) => {
                  const content = c.render
                    ? c.render(row)
                    : ((row as Record<string, unknown>)[c.key] as ReactNode);
                  return (
                    <td
                      key={c.key}
                      className={`px-5 py-3.5 text-slate-700 ${
                        c.align === "right" ? "text-right tabular-nums" : ""
                      } ${c.className ?? ""}`}
                    >
                      {content === null || content === undefined || content === "" ? (
                        <span className="text-slate-300">—</span>
                      ) : (
                        content
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {footer && (
        <div className="border-t border-slate-100 px-5 py-3 text-xs text-slate-400">
          {footer}
        </div>
      )}
    </Card>
  );
}

/** Shown when a query succeeds but returns no rows. */
export function EmptyState({
  title = "Nothing here yet",
  message,
  icon: Icon = Inbox,
}: {
  title?: string;
  message?: string;
  icon?: LucideIcon;
}) {
  return (
    <Card className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      <Icon className="h-8 w-8 text-slate-300" />
      <p className="text-sm font-medium text-slate-600">{title}</p>
      {message && <p className="max-w-sm text-xs text-slate-400">{message}</p>}
    </Card>
  );
}

/** Shown when a query errors. */
export function ErrorState({ message }: { message?: string }) {
  return (
    <Card className="flex items-start gap-3 border-red-100 bg-red-50/50 px-5 py-4">
      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
      <div>
        <p className="text-sm font-medium text-red-800">Couldn&apos;t load data</p>
        {message && <p className="mt-0.5 text-xs text-red-600">{message}</p>}
      </div>
    </Card>
  );
}

/** Loading placeholder; use as a <Suspense> fallback around async tables. */
export function TableSkeleton({
  columns = 4,
  rows = 5,
  title,
}: {
  columns?: number;
  rows?: number;
  title?: string;
}) {
  const cols = Array.from({ length: columns });
  return (
    <Card className="overflow-hidden">
      {title && (
        <div className="border-b border-slate-100 px-5 py-3">
          <h2 className="text-sm font-semibold text-slate-700">{title}</h2>
        </div>
      )}
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            {cols.map((_, i) => (
              <th key={i} className="px-5 py-2.5">
                <div className="h-2.5 w-16 rounded bg-slate-200" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, r) => (
            <tr key={r} className="border-b border-slate-50 last:border-0">
              {cols.map((_, c) => (
                <td key={c} className="px-5 py-3.5">
                  <div className="h-3 w-3/4 animate-pulse rounded bg-slate-100" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
