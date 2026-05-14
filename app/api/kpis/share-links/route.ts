import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateKpiShareToken, hashKpiShareToken } from "@/lib/kpis/share";

const SAFE_SHARE_LINK_SELECT = "id,name,active,expires_at,created_by,last_viewed_at,views_count,created_at,updated_at";

async function getAdminContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { supabase, profile: null, error: "غير مصرح" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("id,role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") return { supabase, profile: null, error: "هذه العملية متاحة لمدير النظام فقط" };
  return { supabase, profile, error: null };
}

export async function GET() {
  const { supabase, error } = await getAdminContext();
  if (error) return NextResponse.json({ error }, { status: error === "غير مصرح" ? 401 : 403 });

  const { data, error: queryError } = await supabase
    .from("kpi_share_links")
    .select(SAFE_SHARE_LINK_SELECT)
    .order("created_at", { ascending: false });

  if (queryError) return NextResponse.json({ error: queryError.message }, { status: 500 });
  return NextResponse.json({ links: data ?? [] });
}

export async function POST(request: NextRequest) {
  const { supabase, profile, error } = await getAdminContext();
  if (error || !profile) return NextResponse.json({ error }, { status: error === "غير مصرح" ? 401 : 403 });

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
