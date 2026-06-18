import { History } from "lucide-react";
import { PageHeader, PlaceholderPanel } from "@/components/ui";

export default function ChangeLogPage() {
  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Change Log"
        description="Audit trail of every action — completed, added, or removed"
        icon={History}
      />
      <PlaceholderPanel
        title="Activity"
        columns={["When", "User", "Action", "Entity", "Before", "After"]}
      />
      <p className="mt-4 text-xs text-slate-400">
        Backed by the audit_log table. Each create / update / delete across the app will
        record an entry here automatically.
      </p>
    </div>
  );
}
