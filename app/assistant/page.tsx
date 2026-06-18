import { Bot, Lock } from "lucide-react";
import { PageHeader, Card } from "@/components/ui";

export default function AssistantPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Assistant"
        description="Ask questions about your facility data"
        icon={Bot}
      />
      <Card className="p-8 text-center">
        <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
          <Lock className="h-6 w-6" />
        </span>
        <h2 className="text-base font-semibold text-slate-700">Planned for the final phase</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
          A chat box that answers questions grounded in your live data — deals, stock,
          forecasts, and more. We&apos;ll build this once the core modules and data are in
          place.
        </p>
        <div className="mt-5 inline-flex flex-wrap justify-center gap-2 text-xs text-slate-400">
          {[
            "What’s our UCO stock next month?",
            "Which deals have the best margin?",
            "Show contracts expiring soon",
          ].map((q) => (
            <span key={q} className="rounded-full border border-slate-200 px-3 py-1">
              {q}
            </span>
          ))}
        </div>
      </Card>
    </div>
  );
}
