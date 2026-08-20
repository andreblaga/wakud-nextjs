import type { ReactNode } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowLeft } from "lucide-react";

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  icon: Icon,
  action,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        {Icon && (
          <span className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
            <Icon className="h-5 w-5" />
          </span>
        )}
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            {title}
          </h1>
          {description && (
            <p className="mt-1 text-sm text-slate-500">{description}</p>
          )}
        </div>
      </div>
      {action}
    </div>
  );
}

export function StatCard({
  label,
  value,
  unit,
  hint,
  accent = false,
}: {
  label: string;
  value: string;
  unit?: string;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <Card className="p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p
        className={`mt-2 text-2xl font-semibold ${
          accent ? "text-accent-600" : "text-slate-900"
        }`}
      >
        {value}
        {unit && <span className="ml-1 text-base font-normal text-slate-400">{unit}</span>}
      </p>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </Card>
  );
}

/**
 * "← Back to Deals" line above a detail page's header.
 *
 * Detail pages are reached from a list, from global search or from a link in a
 * discussion, so they always need a way back that does not rely on history.
 */
export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="mb-3 inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-brand-700"
    >
      <ArrowLeft className="h-3.5 w-3.5" /> {label}
    </Link>
  );
}

/**
 * Read layout for one record's fields: a titled Card wrapping a <dl> grid.
 *
 * Detail pages use this rather than a disabled form — inputs, even greyed out,
 * read as "you could type here if only you had permission", which is the wrong
 * message for a view that is read-only for everyone.
 */
export function DetailSection({
  title,
  columns = 2,
  children,
  className = "",
}: {
  title?: string;
  /** Field columns from the `sm` breakpoint up. */
  columns?: 2 | 3;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={`p-5 ${className}`}>
      {title && <h2 className="mb-4 text-sm font-semibold text-slate-700">{title}</h2>}
      <dl
        className={`grid grid-cols-1 gap-x-6 gap-y-4 ${
          columns === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"
        }`}
      >
        {children}
      </dl>
    </Card>
  );
}

/** One label/value pair inside a DetailSection. Empty values render as an em dash. */
export function DetailField({
  label,
  value,
  hint,
  full = false,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  /** Span the whole grid — for notes and other long text. */
  full?: boolean;
}) {
  const empty = value === null || value === undefined || value === "";
  return (
    <div className={full ? "sm:col-span-full" : ""}>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 whitespace-pre-wrap text-sm text-slate-800">
        {empty ? <span className="text-slate-300">—</span> : value}
      </dd>
      {hint && <p className="mt-0.5 text-[11px] text-slate-400">{hint}</p>}
    </div>
  );
}

/** Compact label/value line for a stacked panel (economics, totals). */
export function DetailRow({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-slate-500">{label}</dt>
      <dd className={`tabular-nums ${accent ? "font-semibold text-accent-600" : "text-slate-800"}`}>
        {value}
      </dd>
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    confirmed: "bg-brand-100 text-brand-800",
    approved: "bg-blue-100 text-blue-800",
    draft: "bg-slate-100 text-slate-600",
    paid: "bg-brand-100 text-brand-800",
    delivered: "bg-brand-100 text-brand-800",
    in_transit: "bg-amber-100 text-amber-800",
    planned: "bg-slate-100 text-slate-600",
    pending: "bg-amber-100 text-amber-800",
    active: "bg-brand-100 text-brand-800",
    archived: "bg-slate-200 text-slate-500",
    // Feedback statuses. "planned" is deliberately left on the shared slate
    // above — it is also a production/contract-volume status meaning "not
    // started", and one word cannot carry two colours.
    new: "bg-amber-100 text-amber-800",
    reviewing: "bg-blue-100 text-blue-800",
    done: "bg-brand-100 text-brand-800",
    declined: "bg-slate-200 text-slate-500",
    archive: "bg-slate-200 text-slate-500",
    unarchive: "bg-blue-100 text-blue-800",
  };
  const cls = map[status.toLowerCase()] ?? "bg-slate-100 text-slate-600";
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}
