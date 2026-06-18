import { Search, Bell } from "lucide-react";

export default function TopBar() {
  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-slate-200 bg-white px-6">
      <div className="flex max-w-md flex-1 items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-400">
        <Search className="h-4 w-4" />
        <span>Search deals, contracts, batches…</span>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-accent-500" />
        </button>
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-700 text-xs font-semibold text-white">
            GM
          </div>
          <span className="hidden text-sm text-slate-600 sm:inline">General Manager</span>
        </div>
      </div>
    </header>
  );
}
