import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/notifications/send-email";
import { weeklySummaryTemplate } from "@/lib/notifications/templates";

export async function GET(request: NextRequest) {
  const secret = request.headers.get("authorization")?.replace("Bearer ", "");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const today = new Date().toISOString().split("T")[0];
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekAgoStr = weekAgo.toISOString().split("T")[0];

  try {
    const { data: log } = await supabase
      .from("automation_logs")
      .insert({ type: "weekly-summary", status: "running" })
      .select()
      .single();

    // Get stats
    const [{ count: completedCount }, { count: overdueCount }, { data: projects }, { data: adminUsers }] = await Promise.all([
      supabase.from("tasks").select("*", { count: "exact", head: true }).eq("status", "Done").gte("updated_at", weekAgoStr),
      supabase.from("tasks").select("*", { count: "exact", head: true }).lt("due_date", today).not("status", "in", '("Done","Cancelled")'),
      supabase.from("projects").select("name, progress").eq("status", "active").order("progress", { ascending: false }).limit(8),
      supabase.from("profiles").select("email, full_name").eq("role", "admin").eq("active", true),
    ]);

    const html = weeklySummaryTemplate({
      totalCompleted: completedCount ?? 0,
      totalOverdue: overdueCount ?? 0,
      topProjects: (projects ?? []).map((p) => ({
        name: p.name,
        progress: Math.round(p.progress ?? 0),
      })),
    });

    let sentCount = 0;
    for (const admin of adminUsers ?? []) {
      if (!admin.email) continue;
      const { success } = await sendEmail({
        to: admin.email,
        subject: "📊 الملخص الأسبوعي - سماوة",
        html,
      });
      if (success) sentCount++;
    }

    await supabase.from("automation_logs").update({ status: "success", payload: { sent: sentCount } }).eq("id", log?.id ?? "");
    return NextResponse.json({ success: true, sent: sentCount });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    await supabase.from("automation_logs").insert({ type: "weekly-summary", status: "error", error: errorMessage });
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
