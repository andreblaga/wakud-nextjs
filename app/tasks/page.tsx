import { Suspense } from "react";
import Link from "next/link";
import { ListChecks, Plus } from "lucide-react";
import { PageHeader, Card } from "@/components/ui";
import { RoleGate } from "@/components/RoleGate";
import { ErrorState } from "@/components/DataTable";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth";
import { canWrite } from "@/lib/permissions";
import TaskCard from "./TaskCard";
import { TASK_STATUSES, type TaskRow, type TaskStatus } from "./types";

export default function TasksPage({ searchParams }: { searchParams: { q?: string } }) {
  const q = (searchParams.q ?? "").trim();
  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="To-Do"
        description="Shared team board — timeline & priorities"
        icon={ListChecks}
        action={
          <RoleGate domain="tasks">
            <Link href="/tasks/new" className="inline-flex items-center gap-1.5 rounded-lg bg-brand-700 px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-800">
              <Plus className="h-4 w-4" /> New task
            </Link>
          </RoleGate>
        }
      />
      <Suspense key={q} fallback={<BoardSkeleton />}>
        <Board query={q} />
      </Suspense>
    </div>
  );
}

const PRIORITY_RANK: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
const COLUMN_TINT: Record<TaskStatus, string> = {
  todo: "border-slate-200",
  in_progress: "border-amber-200",
  done: "border-brand-200",
};

async function Board({ query }: { query: string }) {
  const supabase = createClient();
  if (!supabase) return <ErrorState message="Supabase isn't configured." />;

  let request = supabase.from("tasks").select("*");
  // `%` and `_` are LIKE wildcards; escape so a literal search stays literal.
  if (query) request = request.ilike("title", `%${query.replace(/[\\%_]/g, (c) => `\\${c}`)}%`);

  const { data, error } = await request.order("created_at", { ascending: false });
  if (error) {
    // tasks table may not exist yet (migration not run).
    return <ErrorState message={`${error.message} — has supabase/phase4-tasks.sql been run?`} />;
  }

  const tasks = (data ?? []) as TaskRow[];
  const user = await getSessionUser();
  const canEdit = canWrite(user?.role, "tasks");

  const byStatus = (status: TaskStatus) =>
    tasks
      .filter((t) => t.status === status)
      .sort((a, b) => {
        const p = (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9);
        if (p !== 0) return p;
        return (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999");
      });

  return (
    <>
      {query && (
        <p className="mb-3 text-xs text-slate-500">
          Showing tasks matching <span className="font-medium text-slate-700">“{query}”</span> ({tasks.length}).{" "}
          <Link href="/tasks" className="text-brand-700 hover:underline">
            Clear
          </Link>
        </p>
      )}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {TASK_STATUSES.map((col) => {
        const items = byStatus(col.value);
        return (
          <div key={col.value}>
            <div className="mb-2 flex items-center justify-between px-1">
              <span className="text-sm font-semibold text-slate-700">{col.label}</span>
              <span className="text-xs text-slate-400">{items.length}</span>
            </div>
            <Card className={`min-h-[24rem] space-y-2 border-dashed ${COLUMN_TINT[col.value]} bg-slate-50/50 p-3`}>
              {items.length > 0 ? (
                items.map((t) => <TaskCard key={t.id} task={t} canEdit={canEdit} />)
              ) : (
                <p className="px-2 py-8 text-center text-xs text-slate-400">No tasks</p>
              )}
            </Card>
          </div>
        );
      })}
      </div>
    </>
  );
}

function BoardSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <Card key={i} className="min-h-[24rem] animate-pulse border-dashed bg-slate-50/50 p-3">
          <div className="h-16 rounded bg-slate-100" />
        </Card>
      ))}
    </div>
  );
}
