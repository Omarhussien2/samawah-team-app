import { createServiceClient } from "@/lib/supabase/server";

interface NotificationData {
  user_id: string;
  project_id?: string;
  task_id?: string;
  type: string;
  title: string;
  body: string;
  sent_via?: string;
}

export async function createNotification(data: NotificationData): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase.from("notifications").insert({
    user_id: data.user_id,
    project_id: data.project_id ?? null,
    task_id: data.task_id ?? null,
    type: data.type,
    title: data.title,
    body: data.body,
    sent_via: data.sent_via ?? "in_app",
    created_at: new Date().toISOString(),
  });
  if (error) console.error("[Notification] Failed to create:", error);
}

export async function createNotificationForMany(userIds: string[], data: Omit<NotificationData, "user_id">): Promise<void> {
  const supabase = createServiceClient();
  const notifications = userIds.map((userId) => ({
    user_id: userId,
    project_id: data.project_id ?? null,
    task_id: data.task_id ?? null,
    type: data.type,
    title: data.title,
    body: data.body,
    sent_via: data.sent_via ?? "in_app",
    created_at: new Date().toISOString(),
  }));
  const { error } = await supabase.from("notifications").insert(notifications);
  if (error) console.error("[Notification] Failed to create many:", error);
}
