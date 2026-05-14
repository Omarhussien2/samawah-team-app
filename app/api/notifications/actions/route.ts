import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { NotificationAction } from "@/lib/notifications/types";
import type { Database } from "@/lib/supabase/types";

type NotificationUpdate = Database["public"]["Tables"]["notifications"]["Update"];

interface ActionBody {
  id?: string;
  action?: NotificationAction;
  snoozed_until?: string;
}

function buildActionUpdate(action: NotificationAction, snoozedUntil?: string): NotificationUpdate | null {
  const now = new Date().toISOString();

  if (action === "read") {
    return { read_at: now };
  }

  if (action === "done") {
    return { status: "done", read_at: now, dismissed_at: now, snoozed_until: null };
  }

  if (action === "dismiss") {
    return { status: "dismissed", read_at: now, dismissed_at: now, snoozed_until: null };
  }

  if (action === "snooze") {
    if (!snoozedUntil) return null;
    return { status: "snoozed", snoozed_until: snoozedUntil, read_at: now };
  }

  if (action === "archive") {
    return { status: "archived", read_at: now, archived_at: now };
  }

  return null;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  let body: ActionBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "بيانات غير صحيحة" }, { status: 400 });
  }

  if (!body.id || !body.action) {
    return NextResponse.json({ error: "id و action مطلوبان" }, { status: 400 });
  }

  const update = buildActionUpdate(body.action, body.snoozed_until);
  if (!update) {
    return NextResponse.json({ error: "إجراء غير مدعوم أو تاريخ تذكير غير صحيح" }, { status: 400 });
  }

  const { error } = await supabase
    .from("notifications")
    .update(update)
    .eq("id", body.id)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
