import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type {
  NotificationCategory,
  NotificationPriority,
  NotificationStatus,
} from "@/lib/notifications/types";

const notificationStatuses: NotificationStatus[] = ["active", "done", "dismissed", "snoozed", "archived"];
const notificationPriorities: NotificationPriority[] = ["low", "medium", "high", "critical"];
const notificationCategories: NotificationCategory[] = ["task", "project", "challenge", "form", "kpi", "digest", "comment", "system"];

// GET /api/notifications?limit=20&offset=0&status=active&category=task&priority=high
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const limit = parseInt(request.nextUrl.searchParams.get("limit") ?? "20");
  const offset = parseInt(request.nextUrl.searchParams.get("offset") ?? "0");
  const status = request.nextUrl.searchParams.get("status");
  const category = request.nextUrl.searchParams.get("category");
  const priority = request.nextUrl.searchParams.get("priority");
  const importantOnly = request.nextUrl.searchParams.get("important") === "true";

  let query = supabase
    .from("notifications")
    .select("*", { count: "exact" })
    .eq("user_id", user.id);

  const parsedStatus = status as NotificationStatus;
  if (status && notificationStatuses.includes(parsedStatus)) {
    query = query.eq("status", parsedStatus);
  } else {
    query = query.neq("status", "archived");
  }

  const parsedCategory = category as NotificationCategory;
  if (category && notificationCategories.includes(parsedCategory)) {
    query = query.eq("category", parsedCategory);
  }

  const parsedPriority = priority as NotificationPriority;
  if (priority && notificationPriorities.includes(parsedPriority)) {
    query = query.eq("priority", parsedPriority);
  }

  if (importantOnly) {
    query = query.in("priority", ["high", "critical"]).in("status", ["active", "snoozed"]);
  }

  const { data: notifications, error, count } = await query
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    notifications: notifications ?? [],
    total: count ?? 0,
  });
}

// PATCH /api/notifications  { id: string } or { mark_all_read: true }
export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  let body: { id?: string; mark_all_read?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "بيانات غير صحيحة" }, { status: 400 });
  }

  const now = new Date().toISOString();

  if (body.mark_all_read) {
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: now })
      .eq("user_id", user.id)
      .is("read_at", null);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  if (body.id) {
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: now })
      .eq("id", body.id)
      .eq("user_id", user.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "id أو mark_all_read مطلوب" }, { status: 400 });
}
