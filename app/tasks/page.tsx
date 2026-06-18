import { ListChecks, Plus } from "lucide-react";
import { PageHeader, Card } from "@/components/ui";

const columns = [
  { name: "To do", tint: "border-slate-200" },
  { name: "In progress", tint: "border-amber-200" },
  { name: "Done", tint: "border-brand-200" },
];

export default function TasksPage() {
  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="To-Do"
        description="Timeline & priorities"
        icon={ListChecks}
        action={
          <button className="inline-flex items-center gap-1.5 rounded-lg bg-brand-700 px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-800">
            <Plus className="h-4 w-4" /> New task
          </button>
        }
      />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {columns.map((col) => (
          <div key={col.name}>
            <div className="mb-2 flex items-center justify-between px-1">
              <span className="text-sm font-semibold text-slate-700">{col.name}</span>
              <span className="text-xs text-slate-400">0</span>
            </div>
            <Card className={`min-h-[24rem] border-dashed ${col.tint} bg-slate-50/50 p-3`}>
              <p className="px-2 py-8 text-center text-xs text-slate-400">
                No tasks yet
              </p>
            </Card>
          </div>
        ))}
      </div>
    </div>
  );
}
