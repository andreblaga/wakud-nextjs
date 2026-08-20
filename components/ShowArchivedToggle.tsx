import Link from "next/link";
import { Archive, ArchiveRestore } from "lucide-react";

/**
 * "Show archived" / "Hide archived" link for a list page.
 *
 * A link rather than a control with its own state, so the choice lives in the
 * URL: it survives a refresh, and it is shareable ("look at the archived ones").
 */
export function ShowArchivedToggle({
  href,
  showArchived,
  className = "",
}: {
  href: string;
  showArchived: boolean;
  className?: string;
}) {
  const Icon = showArchived ? ArchiveRestore : Archive;
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm ${
        showArchived
          ? "border-slate-300 bg-slate-100 text-slate-700"
          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
      } ${className}`}
    >
      <Icon className="h-4 w-4" />
      {showArchived ? "Hide archived" : "Show archived"}
    </Link>
  );
}
