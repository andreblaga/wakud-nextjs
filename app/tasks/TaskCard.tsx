"use client";

import { useTransition } from "react";
import Link from "next/link";
import { Pencil, Trash2, ChevronLeft, ChevronRight, Link2, Loader2, Lightbulb } from "lucide-react";
import { formatDate } from "@/lib/dates";
import { moveTask, deleteTask } from "./actions";
import type { TaskRow, TaskStatus } from "./types";

const PRIORITY_CLASS: Record<string, string> = {
  urgent: "bg-red-100 text-red-700",
  high: "bg-amber-100 text-amber-800",
  medium: "bg-slate-100 text-slate-600",
  low: "bg-slate-100 text-slate-500",
};

const LINK_HREF: Record<string, string> = {
  deal: "/deals",
  contract: "/sales-forecast",
  batch: "/production",
};

const ORDER: TaskStatus[] = ["todo", "in_progress", "done"];

export default function TaskCard({
  task,
  canEdit,
  fromFeedbackId = null,
}: {
  task: TaskRow;
  canEdit: boolean;
  /** Set when this task was created from a feedback request. */
  fromFeedbackId?: string | null;
}) {
  const [pending, startTransition] = useTransition();

  const idx = ORDER.indexOf(task.status);
  const prev = idx > 0 ? ORDER[idx - 1] : null;
  const next = idx < ORDER.length - 1 ? ORDER[idx + 1] : null;

  const move = (status: TaskStatus) => startTransition(() => moveTask(task.id, status));
  const remove = () => {
    if (confirm("Delete this task?")) startTransition(() => deleteTask(task.id));
  };

  return (
    <div className={`rounded-lg border border-slate-200 bg-white p-3 shadow-sm ${pending ? "opacity-60" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-slate-800">{task.title}</p>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${PRIORITY_CLASS[task.priority]}`}>
          {task.priority}
        </span>
      </div>

      {task.description && <p className="mt-1 line-clamp-2 text-xs text-slate-500">{task.description}</p>}

      {(task.due_date || task.assignee) && (
        <div className="mt-2 flex flex-wrap items-center gap-x-2 text-[11px] text-slate-400">
          {task.due_date && <span>Due {formatDate(task.due_date)}</span>}
          {task.due_date && task.assignee && <span>·</span>}
          {task.assignee && <span>{task.assignee}</span>}
        </div>
      )}

      {task.link_type && task.link_id && (
        <Link
          href={LINK_HREF[task.link_type] ?? "/"}
          className="mt-2 inline-flex items-center gap-1 rounded bg-slate-50 px-1.5 py-0.5 text-[11px] text-brand-700 hover:underline"
        >
          <Link2 className="h-3 w-3" />
          {task.link_type}: {task.link_id}
        </Link>
      )}

      {fromFeedbackId && (
        <Link
          href={`/feedback/${fromFeedbackId}`}
          className="mt-2 inline-flex items-center gap-1 rounded bg-slate-50 px-1.5 py-0.5 text-[11px] text-brand-700 hover:underline"
        >
          <Lightbulb className="h-3 w-3" /> From feedback
        </Link>
      )}

      {canEdit && (
        <div className="mt-3 flex items-center gap-1 border-t border-slate-100 pt-2 text-slate-400">
          <button
            type="button"
            onClick={() => prev && move(prev)}
            disabled={!prev || pending}
            className="rounded p-1 hover:bg-slate-100 disabled:opacity-30"
            aria-label="Move left"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => next && move(next)}
            disabled={!next || pending}
            className="rounded p-1 hover:bg-slate-100 disabled:opacity-30"
            aria-label="Move right"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <Link
            href={`/tasks/${task.id}/edit`}
            className="rounded p-1 hover:bg-slate-100 hover:text-brand-700"
            aria-label="Edit task"
          >
            <Pencil className="h-4 w-4" />
          </Link>
          <button
            type="button"
            onClick={remove}
            disabled={pending}
            className="ml-auto rounded p-1 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
            aria-label="Delete task"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </button>
        </div>
      )}
    </div>
  );
}
