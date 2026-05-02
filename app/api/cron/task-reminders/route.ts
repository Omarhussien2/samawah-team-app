import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/notifications/send-email";
import { taskReminderTemplate } from "@/lib/notifications/templates";
import { createNotification } from "@/lib/notifications/create-notification";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

export async function GET(request: NextRequest) {
  const secret = request.headers.get("authorization")?.replace("Bearer ", "");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const today = new Date().toISOString().split("T")[0];

  // Calculate 3 days from now for due-soon alerts
  const threeDaysLater = new Date();
  threeDaysLater.setDate(threeDaysLater.getDate() + 3);
  const threeDaysLaterStr = threeDaysLater.toISOString().split("T")[0];

  try {
    const { data: log } = await supabase
      .from("automation_logs")
      .insert({ type: "task-reminders", status: "running", payload: { date: today } })
      .select()
      .single();

    // Get all tasks due today, overdue, or due within 3 days (not done/cancelled)
    type TaskReminder = { id: string; title: string; due_date: string | null; project_id: string | null; owner_id: string | null; owner_name: string | null; project: { name: string } | null };
    const { data: tasks } = (await supabase
      .from("tasks")
      .select("id, title, due_date, project_id, owner_id, owner_name, project:projects(name)")
      .not("owner_id", "is", null)
      .lte("due_date", threeDaysLaterStr)
      .not("status", "in", '("Done","Cancelled")')) as unknown as { data: TaskReminder[] | null };

    if (!tasks || tasks.length === 0) {
      await supabase.from("automation_logs").update({ status: "success", payload: { sent: 0 } }).eq("id", log?.id ?? "");
      return NextResponse.json({ success: true, sent: 0 });
    }

    // --- Auto-escalate overdue tasks to High alert ---
    const overdueTasks = tasks.filter((t) => t.due_date && t.due_date < today);
    if (overdueTasks.length > 0) {
      const overdueIds = overdueTasks.map((t) => t.id);
      await supabase
        .from("tasks")
        .update({
          alert_level: "High",
          alert_message: "المهمة متأخرة عن موعدها",
        })
        .in("id", overdueIds)
        .is("alert_level", null);
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
      const userTasks = byOwner[profile.id] ?? [];
      const overdueForUser = userTasks.filter((t) => t.due_date && t.due_date < today);
      const dueSoon = userTasks.filter((t) => t.due_date && t.due_date >= today && t.due_date <= threeDaysLaterStr);

      // --- In-App Notification: Overdue ---
      if (overdueForUser.length > 0) {
        await createNotification({
          user_id: profile.id,
          type: "overdue",
          title: `لديك ${overdueForUser.length} مهمة متأخرة`,
          body: overdueForUser.map((t) => `• ${t.title}`).join("\n").substring(0, 200),
          sent_via: "in_app",
        });
      }

      // --- In-App Notification: Due Soon (within 3 days) ---
      if (dueSoon.length > 0) {
        await createNotification({
          user_id: profile.id,
          type: "reminder",
          title: `${dueSoon.length} مهمة تستحق خلال 3 أيام`,
          body: dueSoon.map((t) => `• ${t.title}`).join("\n").substring(0, 200),
          sent_via: "in_app",
        });
      }

      // --- Email ---
      if (profile.email) {
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
    }

    await supabase.from("automation_logs").update({ status: "success", payload: { sent: sentCount, overdueEscalated: overdueTasks.length } }).eq("id", log?.id ?? "");
    return NextResponse.json({ success: true, sent: sentCount, overdueEscalated: overdueTasks.length });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    await supabase.from("automation_logs").insert({ type: "task-reminders", status: "error", error: errorMessage });
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
