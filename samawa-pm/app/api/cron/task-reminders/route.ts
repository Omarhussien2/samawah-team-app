import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/notifications/send-email";
import { taskReminderTemplate } from "@/lib/notifications/templates";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

export async function GET(request: NextRequest) {
  const secret = request.headers.get("authorization")?.replace("Bearer ", "");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const today = new Date().toISOString().split("T")[0];

  try {
    const { data: log } = await supabase
      .from("automation_logs")
      .insert({ type: "task-reminders", status: "running", payload: { date: today } })
      .select()
      .single();

    // Get all tasks due today or overdue (not done/cancelled), grouped by owner
    type TaskReminder = { id: string; title: string; due_date: string | null; project_id: string | null; owner_id: string | null; owner_name: string | null; project: { name: string } | null };
    const { data: tasks } = (await supabase
      .from("tasks")
      .select("id, title, due_date, project_id, owner_id, owner_name, project:projects(name)")
      .not("owner_id", "is", null)
      .lte("due_date", today)
      .not("status", "in", '("Done","Cancelled")')) as unknown as { data: TaskReminder[] | null };

    if (!tasks || tasks.length === 0) {
      await supabase.from("automation_logs").update({ status: "success", payload: { sent: 0 } }).eq("id", log?.id ?? "");
      return NextResponse.json({ success: true, sent: 0 });
    }

    // Group by owner
    const byOwner = tasks.reduce<Record<string, typeof tasks>>((acc, task) => {
      if (!task.owner_id) return acc;
      acc[task.owner_id] = acc[task.owner_id] ?? [];
      acc[task.owner_id].push(task);
      return acc;
    }, {});

    const ownerIds = Object.keys(byOwner);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", ownerIds)
      .eq("active", true);

    let sentCount = 0;

    for (const profile of profiles ?? []) {
      if (!profile.email) continue;
      const userTasks = byOwner[profile.id] ?? [];

      const html = taskReminderTemplate({
        userName: profile.full_name ?? profile.email,
        tasks: userTasks.map((t) => ({
          title: t.title,
          project: (t.project as { name: string } | null)?.name ?? "—",
          dueDate: t.due_date ? format(new Date(t.due_date), "d MMMM", { locale: ar }) : "—",
          isOverdue: t.due_date ? t.due_date < today : false,
        })),
      });

      const { success } = await sendEmail({
        to: profile.email,
        subject: `⏰ تذكير بمهامك - سماوة`,
        html,
      });

      if (success) sentCount++;
    }

    await supabase.from("automation_logs").update({ status: "success", payload: { sent: sentCount } }).eq("id", log?.id ?? "");
    return NextResponse.json({ success: true, sent: sentCount });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    await supabase.from("automation_logs").insert({ type: "task-reminders", status: "error", error: errorMessage });
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
