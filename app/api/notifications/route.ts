import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getNotifications } from "@/lib/notifications";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Authenticated: live notifications for the signed-in user (TopBar bell). */
export async function GET() {
  const supabase = createClient();
  if (!supabase) return NextResponse.json({ notifications: [], count: 0 });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // The viewer decides the per-person feedback items (replies waiting on
  // them; anything needing triage if they can triage).
  const viewer = await getSessionUser();
  const notifications = await getNotifications(supabase, 20, viewer);
  return NextResponse.json({ notifications, count: notifications.length });
}
