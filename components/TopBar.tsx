"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, LogOut, Loader2 } from "lucide-react";
import { useSession } from "@/components/SessionProvider";
import NotificationsBell from "@/components/NotificationsBell";
import { createClient } from "@/lib/supabase/client";
import { ROLE_LABELS } from "@/lib/permissions";

export default function TopBar() {
  const router = useRouter();
  const session = useSession();
  const [signingOut, setSigningOut] = useState(false);

  const email = session?.email ?? null;
  const role = session?.role ?? null;
  const roleLabel = role ? ROLE_LABELS[role] : email ? "No role assigned" : "Not signed in";

  // Initials: first two letters of the email local-part, else the role code.
  const initials = (
    email ? email.split("@")[0].slice(0, 2) : role ?? "?"
  ).toUpperCase();

  async function handleSignOut() {
    const supabase = createClient();
    if (!supabase) return;
    setSigningOut(true);
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-slate-200 bg-white px-6">
      <div className="flex max-w-md flex-1 items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-400">
        <Search className="h-4 w-4" />
        <span>Search deals, contracts, batches…</span>
      </div>
      <div className="flex items-center gap-3">
        <NotificationsBell />

        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-700 text-xs font-semibold text-white">
            {initials}
          </div>
          <div className="hidden leading-tight sm:block">
            {email && <p className="text-sm text-slate-700">{email}</p>}
            <p className="text-xs text-slate-400">{roleLabel}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSignOut}
          disabled={signingOut || !session}
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-40"
          aria-label="Sign out"
          title="Sign out"
        >
          {signingOut ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <LogOut className="h-5 w-5" />
          )}
        </button>
      </div>
    </header>
  );
}
