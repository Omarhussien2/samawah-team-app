import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/notifications/send-email";
import { taskReminderTemplate } from "@/lib/notifications/templates";
import { createNotification } from "@/lib/notifications/create-notification";
import {
  getOrCreateNotificationPreferences,
  shouldSendImportantEmail,
} from "@/lib/notifications/preferences";
import {
  getCronScheduleContext,
  isAllowedCronWeekday,
  overdueTaskReminderWeekdays,
} from "@/lib/notifications/cron-schedule";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

export async function GET(request: NextRequest) {
  const secret = request.headers.get("authorization")?.replace("Bearer ", "");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const schedule = getCronScheduleContext();
  const today = schedule.date;

  try {
    const { data: log } = await supabase
      .from("automation_logs")
      .insert({
        type: "task-reminders",
        status: "running",
        payload: { date: today, weekday: schedule.weekday, timezone: schedule.timezone },
      })
      .select()
      .single();

    if (!isAllowedCronWeekday(schedule.weekday, overdueTaskReminderWeekdays)) {
      const payload = {
        date: today,
        weekday: schedule.weekday,
        timezone: schedule.timezone,
        skipped: true,
        reason: "outside_schedule",
        allowedWeekdays: overdueTaskReminderWeekdays,
      };

      await supabase.from("automation_logs").update({ status: "success", payload }).eq("id", log?.id ?? "");
      return NextResponse.json({ success: true, skipped: true, sent: 0, overdueEscalated: 0 });
    }

    // Get overdue tasks only (not done/cancelled). Schedule: Sunday, Tuesday, Thursday.
    type TaskReminder = { id: string; title: string; due_date: string | null; project_id: string | null; owner_id: string | null; owner_name: string | null; project: { name: string } | null };
    const { data: tasks } = (await supabase
      .from("tasks")
      .select("id, title, due_date, project_id, owner_id, owner_name, project:projects(name)")
      .not("owner_id", "is", null)
      .lt("due_date", today)
      .not("status", "in", '("Done","Cancelled")')) as unknown as { data: TaskReminder[] | null };

    if (!tasks || tasks.length === 0) {
      await supabase
        .from("automation_logs")
        .update({ status: "success", payload: { sent: 0, overdueEscalated: 0, date: today } })
        .eq("id", log?.id ?? "");
      return NextResponse.json({ success: true, sent: 0 });
    }

    // --- Auto-escalate overdue tasks to High alert ---
    const overdueTasks = tasks;
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
      const overdueForUser = userTasks;
      const preferences = await getOrCreateNotificationPreferences(supabase, profile.id);

      // --- In-App Notification: Overdue ---
      if (preferences.in_app_enabled && overdueForUser.length > 0) {
        await createNotification({
          user_id: profile.id,
          type: "overdue",
          category: "task",
          priority: "high",
          title: `لديك ${overdueForUser.length} مهمة متأخرة`,
          body: overdueForUser.map((t) => `• ${t.title}`).join("\n").substring(0, 200),
          action_url: "/my-tasks",
          dedupe_key: `overdue-tasks:${schedule.date}`,
          metadata: {
            schedule: "sunday-tuesday-thursday",
            overdueCount: overdueForUser.length,
            weekday: schedule.weekday,
            timezone: schedule.timezone,
          },
          sent_via: "in_app",
        });
      }

      // --- Email: important only by default ---
      if (profile.email && shouldSendImportantEmail(preferences, overdueForUser.length > 0)) {
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
          subject: `تنبيه بالمهام المتأخرة - سماوة`,
          html,
        });

        if (success) sentCount++;
      }
    }

    await supabase
      .from("automation_logs")
      .update({
        status: "success",
        payload: {
          sent: sentCount,
          overdueEscalated: overdueTasks.length,
          date: today,
          weekday: schedule.weekday,
          timezone: schedule.timezone,
        },
      })
      .eq("id", log?.id ?? "");
    return NextResponse.json({ success: true, sent: sentCount, overdueEscalated: overdueTasks.length });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    await supabase.from("automation_logs").insert({
      type: "task-reminders",
      status: "error",
      error: errorMessage,
      payload: { date: today, weekday: schedule.weekday, timezone: schedule.timezone },
    });
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
