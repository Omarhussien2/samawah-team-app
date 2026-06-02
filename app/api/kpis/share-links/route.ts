import { NextRequest, NextResponse } from "next/server";
import { canAccessKpiCenter } from "@/lib/auth/kpi-access";
import { generateKpiShareToken, hashKpiShareToken } from "@/lib/kpis/share";
import { createClient } from "@/lib/supabase/server";

const SAFE_SHARE_LINK_SELECT = "id,name,active,expires_at,created_by,last_viewed_at,views_count,created_at,updated_at";
const UNAUTHORIZED_ERROR = "غير مصرح";
const KPI_ACCESS_ERROR = "ليس لديك صلاحية لمركز المؤشرات حاليا";

async function getKpiAccessContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { supabase, profile: null, error: UNAUTHORIZED_ERROR };

  const { data: profile } = await supabase
    .from("profiles")
    .select("id,email,full_name,role")
    .eq("id", user.id)
    .single();

  if (!canAccessKpiCenter(profile)) return { supabase, profile: null, error: KPI_ACCESS_ERROR };
  return { supabase, profile, error: null };
}

export async function GET() {
  const { supabase, error } = await getKpiAccessContext();
  if (error) return NextResponse.json({ error }, { status: error === UNAUTHORIZED_ERROR ? 401 : 403 });

  const { data, error: queryError } = await supabase
    .from("kpi_share_links")
    .select(SAFE_SHARE_LINK_SELECT)
    .order("created_at", { ascending: false });

  if (queryError) return NextResponse.json({ error: queryError.message }, { status: 500 });
  return NextResponse.json({ links: data ?? [] });
}

export async function POST(request: NextRequest) {
  const { supabase, profile, error } = await getKpiAccessContext();
  if (error || !profile) return NextResponse.json({ error }, { status: error === UNAUTHORIZED_ERROR ? 401 : 403 });

  let body: { name?: string; expires_at?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "بيانات غير صحيحة" }, { status: 400 });
  }

  const token = generateKpiShareToken();
  const tokenHash = hashKpiShareToken(token);
  const name = body.name?.trim() || "رابط مجلس الإدارة";
  const expiresAt = body.expires_at?.trim() ? body.expires_at : null;

  const { data, error: insertError } = await supabase
    .from("kpi_share_links")
    .insert({
      name,
      token_hash: tokenHash,
      expires_at: expiresAt,
      created_by: profile.id,
    })
    .select(SAFE_SHARE_LINK_SELECT)
    .single();

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  return NextResponse.json({
    link: data,
    token,
    url: `${request.nextUrl.origin}/kpis/share/${token}`,
  });
}
