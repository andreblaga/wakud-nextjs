"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, NAV_SECTIONS } from "@/lib/nav";
import { useSession } from "@/components/SessionProvider";
import { isAdmin } from "@/lib/permissions";

export default function Sidebar() {
  const pathname = usePathname();
  const session = useSession();
  // Admin-only links are hidden from everyone else, GM included. The /admin
  // page and its server actions enforce this again — this is presentation.
  const admin = isAdmin(session?.role);

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
      <div className="flex h-16 items-center border-b border-slate-800 bg-slate-900 px-5">
        <Image
          src="/wakud-logo.png"
          alt="WAKUD"
          width={172}
          height={32}
          priority
          className="h-8 w-auto"
        />
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {NAV_SECTIONS.map((section) => {
          const items = NAV_ITEMS.filter(
            (i) => i.section === section && (!i.adminOnly || admin),
          );
          if (items.length === 0) return null;
          return (
            <div key={section} className="mb-5">
              <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                {section}
              </p>
              <ul className="space-y-0.5">
                {items.map((item) => {
                  const active =
                    item.href === "/"
                      ? pathname === "/"
                      : pathname.startsWith(item.href);
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                          active
                            ? "bg-brand-50 font-medium text-brand-800"
                            : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                        }`}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-slate-100 px-5 py-3 text-[11px] text-slate-400">
        Wakud International LLC · Barka, Oman
      </div>
    </aside>
  );
}
