import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getNotifications } from "@/lib/notifications";

export const dynamic = "force-dynamic";

/** Authenticated: live notifications for the signed-in user (TopBar bell). */
export async function GET() {
  const supabase = createClient();
  if (!supabase) return NextResponse.json({ notifications: [], count: 0 });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const notifications = await getNotifications(supabase, 20);
  return NextResponse.json({ notifications, count: notifications.length });
}
