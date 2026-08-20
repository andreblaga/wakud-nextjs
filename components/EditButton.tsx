import Link from "next/link";
import { Pencil } from "lucide-react";
import { RoleGate } from "@/components/RoleGate";

/**
 * "Edit" action for a read-only detail page.
 *
 * Wrapped in RoleGate, so a role that cannot write `domain` — every
 * executive_viewer, for one — simply never sees the button, rather than seeing
 * it and being bounced by the edit route's redirect.
 */
export function EditButton({
  href,
  domain,
  label = "Edit",
}: {
  href: string;
  domain: string;
  label?: string;
}) {
  return (
    <RoleGate domain={domain}>
      <Link
        href={href}
        className="inline-flex items-center gap-1.5 rounded-lg bg-brand-700 px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-800"
      >
        <Pencil className="h-4 w-4" /> {label}
      </Link>
    </RoleGate>
  );
}
