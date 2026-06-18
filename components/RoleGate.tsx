"use client";

import { useSession } from "@/components/SessionProvider";
import { canWrite } from "@/lib/permissions";

/**
 * Renders children only if the current user's role may write within `domain`.
 * Used to hide/disable create/edit actions the role can't perform.
 */
export function RoleGate({
  domain,
  children,
}: {
  domain: string;
  children: React.ReactNode;
}) {
  const session = useSession();
  if (!canWrite(session?.role, domain)) return null;
  return <>{children}</>;
}
