import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getProjectTypeMapForProjects } from "@/lib/projects/project-type-store";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const ids = Array.from(
    new Set(
      (request.nextUrl.searchParams.get("ids") ?? "")
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean)
    )
  ).slice(0, 250);

  if (ids.length === 0) {
    return NextResponse.json({ types: {} });
  }

  const { data: projects, error } = await supabase
    .from("projects")
    .select("id,name")
    .in("id", ids);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const typeMap = await getProjectTypeMapForProjects(projects ?? []);
  return NextResponse.json({ types: Object.fromEntries(typeMap) });
}
