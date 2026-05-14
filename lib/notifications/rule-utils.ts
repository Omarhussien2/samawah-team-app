import type { NotificationPriority } from "@/lib/notifications/types";

export function buildNotificationDedupeKey(...parts: Array<string | number | null | undefined>): string {
  return parts
    .filter((part): part is string | number => part !== null && part !== undefined && `${part}`.trim() !== "")
    .map((part) => `${part}`.trim().toLowerCase().replace(/\s+/g, "-"))
    .join(":");
}

export function resolveNotificationPriority(score: number): NotificationPriority {
  if (score >= 90) return "critical";
  if (score >= 70) return "high";
  if (score >= 40) return "medium";
  return "low";
}
