import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Handshake,
  TrendingUp,
  Factory,
  Boxes,
  Truck,
  Wallet,
  ShieldCheck,
  MessagesSquare,
  ListChecks,
  History,
  Bell,
  Bot,
  ShieldAlert,
} from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  description: string;
  section: "Overview" | "Operations" | "Commercial" | "Compliance" | "Collaboration" | "System";
  /** Rendered only for the admin role (see Sidebar). GM does not see these. */
  adminOnly?: boolean;
};

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard, description: "Facility overview & key metrics", section: "Overview" },
  { label: "Alerts", href: "/alerts", icon: Bell, description: "Live notifications & updates", section: "Overview" },

  { label: "Production", href: "/production", icon: Factory, description: "B100 fuel & glycerol output status", section: "Operations" },
  { label: "Inventory", href: "/inventory", icon: Boxes, description: "UCO stock, intake & material reorder", section: "Operations" },
  { label: "Logistics", href: "/logistics", icon: Truck, description: "Shipments & deliveries", section: "Operations" },

  { label: "Deals", href: "/deals", icon: Handshake, description: "Trade evaluation & pipeline", section: "Commercial" },
  { label: "Sales Forecast", href: "/sales-forecast", icon: TrendingUp, description: "Committed volumes & projections", section: "Commercial" },
  { label: "Finance", href: "/finance", icon: Wallet, description: "Invoices & finance exports", section: "Commercial" },

  { label: "ISCC Compliance", href: "/iscc", icon: ShieldCheck, description: "Certificates & feed/product mass balance", section: "Compliance" },
  { label: "Change Log", href: "/change-log", icon: History, description: "Audit trail of all actions", section: "Compliance" },

  { label: "Discussions", href: "/discussions", icon: MessagesSquare, description: "Team chat & item references", section: "Collaboration" },
  { label: "To-Do", href: "/tasks", icon: ListChecks, description: "Timeline & priorities", section: "Collaboration" },
  { label: "Assistant", href: "/assistant", icon: Bot, description: "Ask questions about your data", section: "Collaboration" },

  { label: "Admin", href: "/admin", icon: ShieldAlert, description: "Users, roles & system settings", section: "System", adminOnly: true },
];

export const NAV_SECTIONS: NavItem["section"][] = [
  "Overview",
  "Operations",
  "Commercial",
  "Compliance",
  "Collaboration",
  "System",
];
