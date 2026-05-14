import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  defaultNotificationPreferences,
  getOrCreateNotificationPreferences,
} from "@/lib/notifications/preferences";
import type { Database } from "@/lib/supabase/types";

type WritableKey =
  | "in_app_enabled"
  | "email_enabled"
  | "important_email_only"
  | "daily_digest_enabled"
  | "weekly_digest_enabled"
  | "quiet_hours_start"
  | "quiet_hours_end"
  | "timezone";
type NotificationPreferenceInsert = Database["public"]["Tables"]["notification_preferences"]["Insert"];

function booleanValue(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function nullableTextValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const preferences = await getOrCreateNotificationPreferences(supabase, user.id);
  return NextResponse.json({ preferences });
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  let body: Partial<Record<WritableKey, unknown>>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "بيانات غير صحيحة" }, { status: 400 });
  }

  const payload: NotificationPreferenceInsert = {
    user_id: user.id,
    in_app_enabled: booleanValue(body.in_app_enabled, defaultNotificationPreferences.in_app_enabled),
    email_enabled: booleanValue(body.email_enabled, defaultNotificationPreferences.email_enabled),
    important_email_only: booleanValue(body.important_email_only, defaultNotificationPreferences.important_email_only),
    daily_digest_enabled: booleanValue(body.daily_digest_enabled, defaultNotificationPreferences.daily_digest_enabled),
    weekly_digest_enabled: booleanValue(body.weekly_digest_enabled, defaultNotificationPreferences.weekly_digest_enabled),
    quiet_hours_start: nullableTextValue(body.quiet_hours_start),
    quiet_hours_end: nullableTextValue(body.quiet_hours_end),
    timezone: typeof body.timezone === "string" && body.timezone.trim() ? body.timezone : defaultNotificationPreferences.timezone,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("notification_preferences")
    .upsert(payload, { onConflict: "user_id" })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ preferences: data });
}
