"use client";

import { createContext, useContext } from "react";
import type { SessionUser } from "@/lib/permissions";

/**
 * Client-side access to the current user + role. Hydrated from the server in
 * the root layout (see app/layout.tsx → getSessionUser), so client components
 * like TopBar and RoleGate can read it without another round-trip.
 */
const SessionContext = createContext<SessionUser | null>(null);

export function SessionProvider({
  value,
  children,
}: {
  value: SessionUser | null;
  children: React.ReactNode;
}) {
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionUser | null {
  return useContext(SessionContext);
}
