import { MessagesSquare, Link2, Archive, Hash } from "lucide-react";
import { PageHeader, Card } from "@/components/ui";

export default function DiscussionsPage() {
  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Discussions"
        description="Team chat with references to pages & items, plus a searchable archive"
        icon={MessagesSquare}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        <Card className="p-4 lg:col-span-1">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Channels
          </p>
          <ul className="space-y-0.5 text-sm">
            {["general", "deals", "production", "compliance", "logistics"].map((c) => (
              <li
                key={c}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-slate-600 hover:bg-slate-50"
              >
                <Hash className="h-3.5 w-3.5 text-slate-400" /> {c}
              </li>
            ))}
          </ul>
          <button className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-500 hover:bg-slate-50">
            <Archive className="h-3.5 w-3.5" /> Archive
          </button>
        </Card>

        <Card className="flex min-h-[28rem] flex-col lg:col-span-3">
          <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3">
            <Hash className="h-4 w-4 text-slate-400" />
            <span className="text-sm font-semibold text-slate-700">deals</span>
          </div>
          <div className="flex flex-1 items-center justify-center p-8 text-center">
            <div className="max-w-sm">
              <MessagesSquare className="mx-auto mb-3 h-8 w-8 text-slate-300" />
              <p className="text-sm font-medium text-slate-600">Team discussions live here</p>
              <p className="mt-1 text-xs text-slate-500">
                Messages, threads, and an archive — with the ability to reference a deal,
                contract, or batch directly in conversation.
              </p>
            </div>
          </div>
          <div className="border-t border-slate-100 p-3">
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-400">
              <Link2 className="h-4 w-4" />
              <span>Message #deals — reference an item with @…</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
