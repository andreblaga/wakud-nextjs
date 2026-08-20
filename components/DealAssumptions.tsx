import { Info } from "lucide-react";
import { Card } from "@/components/ui";
import { ASSUMPTION_NOTES, ASSUMPTIONS_UNCONFIRMED } from "@/lib/deal-economics";

/**
 * The DEAL_ASSUMPTIONS basis note.
 *
 * Shown wherever deal economics are — the form's live preview and the
 * read-only detail view — so nobody ever reads a profit figure without the
 * rates it was computed from, or without the "provisional" flag that says
 * finance has not signed those rates off yet.
 */
export function DealAssumptions() {
  return (
    <Card className="p-5">
      <h2 className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
        <Info className="h-4 w-4 text-slate-400" /> Assumptions
        {ASSUMPTIONS_UNCONFIRMED && (
          <span className="ml-auto rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium uppercase text-amber-800">
            provisional
          </span>
        )}
      </h2>
      <p className="mt-1 text-[11px] text-slate-500">
        Figures use these defaults until finance confirms them.
      </p>
      <ul className="mt-2 space-y-1 text-[11px] text-slate-500">
        {ASSUMPTION_NOTES.map((a) => (
          <li key={a.label} className="flex justify-between gap-2">
            <span>{a.label}</span>
            <span className="text-slate-700">{a.display}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
