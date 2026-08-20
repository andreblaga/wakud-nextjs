import type { LucideIcon } from "lucide-react";
import { Truck, PackageMinus, Handshake, AlertTriangle, Lightbulb } from "lucide-react";
import type { NotificationType, NotificationSeverity } from "@/lib/notifications";

/** Shared presentation maps so the bell, dashboard card, and /alerts never diverge. */
export const NOTIFICATION_ICON: Record<NotificationType, LucideIcon> = {
  order: Truck,
  stock: PackageMinus,
  deal: Handshake,
  alert: AlertTriangle,
  feedback: Lightbulb,
};

export const SEVERITY_COLOR: Record<NotificationSeverity, string> = {
  critical: "text-red-500",
  warning: "text-accent-500",
  info: "text-blue-500",
};

export const TYPE_LABEL: Record<NotificationType, string> = {
  order: "Order",
  stock: "Stock",
  deal: "Deal",
  alert: "Alert",
  feedback: "Feedback",
};
