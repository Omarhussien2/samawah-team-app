import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, NotificationPreference } from "@/lib/supabase/types";

export const defaultNotificationPreferences = {
  in_app_enabled: true,
  email_enabled: true,
  important_email_only: true,
  daily_digest_enabled: true,
  weekly_digest_enabled: false,
  quiet_hours_start: null,
  quiet_hours_end: null,
  timezone: "Asia/Riyadh",
} satisfies Omit<NotificationPreference, "user_id" | "created_at" | "updated_at">;

export async function getOrCreateNotificationPreferences(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<NotificationPreference> {
  const { data } = await supabase
    .from("notification_preferences")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (data) return data;

  const { data: created, error } = await supabase
    .from("notification_preferences")
    .insert({ user_id: userId, ...defaultNotificationPreferences })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return created;
}

export function shouldSendImportantEmail(
  preferences: Pick<NotificationPreference, "email_enabled" | "important_email_only"> | null | undefined,
  hasImportantItems: boolean
) {
  if (!preferences?.email_enabled) return false;
  if (preferences.important_email_only) return hasImportantItems;
  return true;
}
