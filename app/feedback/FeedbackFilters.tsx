import Link from "next/link";
import {
  CATEGORY_LABELS,
  FEEDBACK_CATEGORIES,
  FEEDBACK_STATUSES,
  STATUS_LABELS,
} from "@/lib/feedback";
import { setParam, type SearchParams } from "@/lib/query-params";

/**
 * Status and category filters as links.
 *
 * Server-rendered on purpose: the filter is in the URL, so a filtered view
 * survives a refresh and can be pasted to a colleague — "look at the declined
 * ones" is a link, not a description of which chips to click.
 */
export function FeedbackFilters({
  searchParams,
  activeStatus,
  activeCategory,
}: {
  searchParams: SearchParams;
  activeStatus: string | null;
  activeCategory: string | null;
}) {
  return (
    <div className="mb-4 space-y-2">
      <ChipRow label="Status">
        <Chip href={setParam("/feedback", searchParams, "status", null)} active={!activeStatus}>
          Open
        </Chip>
        {FEEDBACK_STATUSES.map((s) => (
          <Chip
            key={s}
            href={setParam("/feedback", searchParams, "status", s)}
            active={activeStatus === s}
          >
            {STATUS_LABELS[s]}
          </Chip>
        ))}
      </ChipRow>

      <ChipRow label="Category">
        <Chip href={setParam("/feedback", searchParams, "category", null)} active={!activeCategory}>
          All
        </Chip>
        {FEEDBACK_CATEGORIES.map((c) => (
          <Chip
            key={c}
            href={setParam("/feedback", searchParams, "category", c)}
            active={activeCategory === c}
          >
            {CATEGORY_LABELS[c]}
          </Chip>
        ))}
      </ChipRow>
    </div>
  );
}

function ChipRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 w-16 shrink-0 text-[11px] font-medium uppercase tracking-wide text-slate-400">
        {label}
      </span>
      {children}
    </div>
  );
}

function Chip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`rounded-full px-3 py-1 text-xs font-medium ${
        active
          ? "bg-brand-700 text-white"
          : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
      }`}
    >
      {children}
    </Link>
  );
}
