import { NextRequest, NextResponse } from "next/server";
import { canAccessKpiCenter } from "@/lib/auth/kpi-access";
import { createClient } from "@/lib/supabase/server";

const SAFE_SHARE_LINK_SELECT = "id,name,active,expires_at,created_by,last_viewed_at,views_count,created_at,updated_at";
const UNAUTHORIZED_ERROR = "غير مصرح";
const KPI_ACCESS_ERROR = "ليس لديك صلاحية لمركز المؤشرات حاليا";

async function getKpiAccessContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { supabase, error: UNAUTHORIZED_ERROR, status: 401 };

  const { data: profile } = await supabase
    .from("profiles")
    .select("id,email,full_name,role")
    .eq("id", user.id)
    .single();

  if (!canAccessKpiCenter(profile)) {
    return { supabase, error: KPI_ACCESS_ERROR, status: 403 };
  }
  return { supabase, error: null, status: 200 };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { supabase, error, status } = await getKpiAccessContext();
  if (error) return NextResponse.json({ error }, { status });

  let body: { name?: string; active?: boolean; expires_at?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "بيانات غير صحيحة" }, { status: 400 });
  }

  const payload: { name?: string; active?: boolean; expires_at?: string | null } = {};
  if (typeof body.name === "string") payload.name = body.name.trim() || "رابط مجلس الإدارة";
  if (typeof body.active === "boolean") payload.active = body.active;
  if (body.expires_at !== undefined) payload.expires_at = body.expires_at || null;

  const { data, error: updateError } = await supabase
    .from("kpi_share_links")
    .update(payload)
    .eq("id", id)
    .select(SAFE_SHARE_LINK_SELECT)
    .single();

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
  return NextResponse.json({ link: data });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { supabase, error, status } = await getKpiAccessContext();
  if (error) return NextResponse.json({ error }, { status });

  const { error: deleteError } = await supabase
    .from("kpi_share_links")
    .delete()
    .eq("id", id);

  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
