import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { matchRecommendationRowsToProjects, parseRecommendationImportText } from "@/lib/recommendations/tasks";

const previewSchema = z.object({
  text: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = previewSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "نص التوصيات مطلوب" }, { status: 400 });

  const { data: projects, error } = await supabase
    .from("projects")
    .select("id,name")
    .order("name");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = parseRecommendationImportText(parsed.data.text);
  const previewRows = matchRecommendationRowsToProjects(rows, projects ?? []);

  return NextResponse.json({
    rows: previewRows,
    summary: {
      total: previewRows.length,
      matched: previewRows.filter((row) => row.matchStatus === "matched").length,
      unmatched: previewRows.filter((row) => row.matchStatus !== "matched").length,
    },
  });
}
