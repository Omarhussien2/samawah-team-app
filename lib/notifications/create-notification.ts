import {
  upsertNotification,
  upsertNotificationForMany,
} from "@/lib/notifications/upsert-notification";
import type { NotificationPayload } from "@/lib/notifications/types";

type NotificationData = NotificationPayload;

export async function createNotification(data: NotificationData): Promise<void> {
  await upsertNotification(data);
}

export async function createNotificationForMany(userIds: string[], data: Omit<NotificationData, "user_id">): Promise<void> {
  await upsertNotificationForMany(userIds, data);
}
