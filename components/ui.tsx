import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

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
  };
  const cls = map[status.toLowerCase()] ?? "bg-slate-100 text-slate-600";
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}
