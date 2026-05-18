import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/notifications/send-email";
import { createNotification } from "@/lib/notifications/create-notification";
import {
  getOrCreateNotificationPreferences,
} from "@/lib/notifications/preferences";
import {
  getCronScheduleContext,
  isAllowedCronWeekday,
  taskUpdateReminderWeekdays,
} from "@/lib/notifications/cron-schedule";
import {
  getTaskUpdateReminderBody,
  taskUpdateReminderTemplate,
} from "@/lib/notifications/templates";

export async function GET(request: NextRequest) {
  const secret = request.headers.get("authorization")?.replace("Bearer ", "");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const schedule = getCronScheduleContext();

  try {
    const { data: log } = await supabase
      .from("automation_logs")
      .insert({
        type: "task-update-reminders",
        status: "running",
        payload: { date: schedule.date, weekday: schedule.weekday, timezone: schedule.timezone },
      })
      .select()
      .single();

    if (!isAllowedCronWeekday(schedule.weekday, taskUpdateReminderWeekdays)) {
      const payload = {
        date: schedule.date,
        weekday: schedule.weekday,
        timezone: schedule.timezone,
        skipped: true,
        reason: "outside_schedule",
        allowedWeekdays: taskUpdateReminderWeekdays,
      };

      await supabase.from("automation_logs").update({ status: "success", payload }).eq("id", log?.id ?? "");
      return NextResponse.json({ success: true, skipped: true, sent: 0, notified: 0 });
    }

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("active", true);

    let sentCount = 0;
    let notifiedCount = 0;
    const notificationBody = getTaskUpdateReminderBody();

    for (const profile of profiles ?? []) {
      const preferences = await getOrCreateNotificationPreferences(supabase, profile.id);
      const userName = profile.full_name ?? profile.email ?? "زميلنا العزيز";

      if (preferences.in_app_enabled) {
        await createNotification({
          user_id: profile.id,
          type: "task_update_reminder",
          category: "task",
          priority: "medium",
          title: "تذكير بتحديث المهام",
          body: notificationBody,
          action_url: "/my-tasks",
          dedupe_key: `task-update-reminder:${schedule.date}`,
          metadata: {
            schedule: "monday-wednesday",
            weekday: schedule.weekday,
            timezone: schedule.timezone,
          },
          sent_via: "in_app",
        });
        notifiedCount++;
      }

      if (profile.email && preferences.email_enabled) {
        const html = taskUpdateReminderTemplate({ userName });
        const { success } = await sendEmail({
          to: profile.email,
          subject: "تذكير بتحديث المهام - سماوة",
          html,
        });

        if (success) sentCount++;
      }
    }

    const payload = {
      date: schedule.date,
      weekday: schedule.weekday,
      timezone: schedule.timezone,
      sent: sentCount,
      notified: notifiedCount,
      recipientsChecked: profiles?.length ?? 0,
    };

    await supabase.from("automation_logs").update({ status: "success", payload }).eq("id", log?.id ?? "");
    return NextResponse.json({ success: true, sent: sentCount, notified: notifiedCount });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    await supabase.from("automation_logs").insert({
      type: "task-update-reminders",
      status: "error",
      error: errorMessage,
      payload: { date: schedule.date, weekday: schedule.weekday, timezone: schedule.timezone },
    });
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
