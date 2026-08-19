import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { runSharePointSync } from "@/lib/sharepoint/sync";

export const dynamic = "force-dynamic";
// The library holds ~14,000 items; a full run takes well over the default limit.
export const maxDuration = 300;

/**
 * Trigger the SharePoint sync.
 *
 * POST only, admin only. requireAdmin() is re-checked here rather than trusting
 * any page-level redirect — a route handler is reachable by direct POST.
 *
 * A scheduled trigger (BUILD-PLAN Phase 5 item 3) can call the same function
 * with { trigger: "scheduled" } once a cron is wired up; it must authenticate
 * with its own secret rather than reusing this handler.
 */
export async function POST() {
  const gate = await requireAdmin();
  if ("error" in gate) {
    return NextResponse.json(
      { error: gate.error.formError ?? "Not permitted." },
      { status: 403 },
    );
  }

  const result = await runSharePointSync({
    trigger: "manual",
    triggeredBy: gate.admin.userId,
  });

  return NextResponse.json(result, {
    status: result.status === "failed" ? 500 : 200,
  });
}
