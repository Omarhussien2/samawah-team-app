import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/notifications?limit=20&offset=0
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const limit = parseInt(request.nextUrl.searchParams.get("limit") ?? "20");
  const offset = parseInt(request.nextUrl.searchParams.get("offset") ?? "0");

  const { data: notifications, error, count } = await supabase
    .from("notifications")
    .select("*", { count: "exact" })
    .eq("user_id", user.id)
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
