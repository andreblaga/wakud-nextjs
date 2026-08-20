import { Archive } from "lucide-react";
import { Card } from "@/components/ui";
import { formatDate, timeOfDay } from "@/lib/dates";

/**
 * Banner across the top of an archived record's detail page.
 *
 * Says plainly that nothing was destroyed — the fear this control has to answer
 * is "have I just lost it?", and the answer is no: the row is on file, its
 * Change Log history is intact, and Restore puts it back.
 */
export function ArchivedNotice({
  archivedAt,
  label,
}: {
  archivedAt: string;
  /** Human noun: "This deal is archived." */
  label: string;
}) {
  return (
    <Card className="mb-4 flex items-start gap-3 border-slate-300 bg-slate-100 px-5 py-4">
      <Archive className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" />
      <div>
        <p className="text-sm font-medium text-slate-700">
          This {label} is archived
          <span className="font-normal text-slate-500">
            {" — "}
            {formatDate(archivedAt)} {timeOfDay(archivedAt)}
          </span>
        </p>
        <p className="mt-0.5 text-xs text-slate-500">
          It is hidden from the default lists. Nothing was deleted: the record is still on file,
          its Change Log history is intact, and Restore brings it back.
        </p>
      </div>
    </Card>
  );
}
