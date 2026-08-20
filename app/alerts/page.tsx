import { Suspense } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { PageHeader, Card } from "@/components/ui";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/DataTable";
import { createClient } from "@/lib/supabase/server";
import { getNotifications } from "@/lib/notifications";
import { getSessionUser } from "@/lib/auth";
import { NOTIFICATION_ICON, SEVERITY_COLOR, TYPE_LABEL } from "@/components/notification-ui";
import { formatDate } from "@/lib/dates";

export default function AlertsPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Alerts & notifications" description="Live updates across the facility" icon={Bell} />
      <Suspense fallback={<TableSkeleton columns={2} title="Notifications" />}>
        <AlertsContent />
      </Suspense>
    </div>
  );
}

async function AlertsContent() {
  const supabase = createClient();
  if (!supabase) return <ErrorState message="Supabase isn't configured." />;

  const user = await getSessionUser();
  const notifications = await getNotifications(supabase, 100, user);

  if (notifications.length === 0) {
    return <EmptyState title="You're all caught up" message="No upcoming orders, low stock, new deals, feedback awaiting a reply, or open alerts." icon={Bell} />;
  }

  return (
    <Card className="overflow-hidden">
      <ul className="divide-y divide-slate-50">
        {notifications.map((n) => {
          const Icon = NOTIFICATION_ICON[n.type];
          return (
            <li key={`${n.type}-${n.id}`}>
              <Link href={n.href} className="flex gap-3 px-5 py-3.5 hover:bg-slate-50">
                <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${SEVERITY_COLOR[n.severity]}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-slate-800">{n.title}</p>
                    <span className="ml-auto shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
                      {TYPE_LABEL[n.type]}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">{n.detail}</p>
                  {n.date && <p className="mt-0.5 text-[11px] text-slate-400">{formatDate(n.date)}</p>}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
