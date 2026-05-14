import { createServiceClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import type { NotificationCategory, NotificationPayload } from "./types";

type NotificationInsert = Database["public"]["Tables"]["notifications"]["Insert"];
type NotificationUpdate = Database["public"]["Tables"]["notifications"]["Update"];

function inferCategory(data: NotificationPayload): NotificationCategory | null {
  if (data.category) return data.category;
  if (data.kpi_id) return "kpi";
  if (data.form_instance_id) return "form";
  if (data.challenge_id) return "challenge";
  if (data.task_id) return "task";
  if (data.project_id) return "project";
  if (data.type.includes("digest") || data.type.includes("summary")) return "digest";
  if (data.type.includes("comment") || data.type.includes("mention")) return "comment";
  return null;
}

function toNotificationInsert(data: NotificationPayload): NotificationInsert {
  return {
    user_id: data.user_id,
    actor_id: data.actor_id ?? null,
    project_id: data.project_id ?? null,
    task_id: data.task_id ?? null,
    challenge_id: data.challenge_id ?? null,
    form_instance_id: data.form_instance_id ?? null,
    kpi_id: data.kpi_id ?? null,
    category: inferCategory(data),
    priority: data.priority ?? "medium",
    type: data.type,
    title: data.title,
    body: data.body,
    action_url: data.action_url ?? null,
    metadata: data.metadata ?? {},
    dedupe_key: data.dedupe_key ?? null,
    status: data.status ?? "active",
    sent_via: data.sent_via ?? "in_app",
    sent_at: data.sent_at ?? null,
    read_at: data.read_at ?? null,
    expires_at: data.expires_at ?? null,
    created_at: new Date().toISOString(),
  };
}

function toNotificationRefresh(data: NotificationPayload): NotificationUpdate {
  return {
    actor_id: data.actor_id ?? null,
    project_id: data.project_id ?? null,
    task_id: data.task_id ?? null,
    challenge_id: data.challenge_id ?? null,
    form_instance_id: data.form_instance_id ?? null,
    kpi_id: data.kpi_id ?? null,
    category: inferCategory(data),
    priority: data.priority ?? "medium",
    type: data.type,
    title: data.title,
    body: data.body,
    action_url: data.action_url ?? null,
    metadata: data.metadata ?? {},
    status: data.status ?? "active",
    sent_via: data.sent_via ?? "in_app",
    sent_at: data.sent_at ?? null,
    read_at: data.read_at ?? null,
    dismissed_at: null,
    snoozed_until: null,
    archived_at: null,
    expires_at: data.expires_at ?? null,
    created_at: new Date().toISOString(),
  };
}

export async function upsertNotification(data: NotificationPayload): Promise<void> {
  const supabase = createServiceClient();

  if (data.dedupe_key) {
    const { data: existing, error: findError } = await supabase
      .from("notifications")
      .select("id")
      .eq("user_id", data.user_id)
      .eq("dedupe_key", data.dedupe_key)
      .maybeSingle();

    if (findError) {
      console.error("[Notification] Failed to find duplicate:", findError);
      return;
    }

    if (existing) {
      const { error: updateError } = await supabase
        .from("notifications")
        .update(toNotificationRefresh(data))
        .eq("id", existing.id);

      if (updateError) console.error("[Notification] Failed to update duplicate:", updateError);
      return;
    }
  }

  const { error } = await supabase.from("notifications").insert(toNotificationInsert(data));
  if (error) console.error("[Notification] Failed to create:", error);
}

export async function upsertNotificationForMany(
  userIds: string[],
  data: Omit<NotificationPayload, "user_id">
): Promise<void> {
  await Promise.all(userIds.map((userId) => upsertNotification({ ...data, user_id: userId })));
}
