import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/notifications/send-email";
import { dailyDigestTemplate } from "@/lib/notifications/templates";
import { createNotification } from "@/lib/notifications/create-notification";
import { runManagerFollowups } from "@/lib/notifications/manager-followups";
import {
  getOrCreateNotificationPreferences,
  shouldSendImportantEmail,
} from "@/lib/notifications/preferences";
import type { Json } from "@/lib/supabase/types";
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
    // Log start
    const { data: log } = await supabase
      .from("automation_logs")
      .insert({ type: "daily-digest", status: "running", payload: { date: today } })
      .select()
      .single();

    // Get all project managers
    const { data: managers } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("role", "project_manager")
      .eq("active", true);

    if (!managers || managers.length === 0) {
      await supabase.from("automation_logs").update({ status: "success", payload: { message: "No managers found" } }).eq("id", log?.id ?? "");
      return NextResponse.json({ success: true, sent: 0 });
    }

    let sentCount = 0;

    for (const manager of managers) {
      // Get projects managed by this manager
      const { data: projects } = await supabase
        .from("projects")
        .select("id, name")
        .eq("manager_id", manager.id)
        .eq("status", "active");

      if (!projects || projects.length === 0) continue;

      const projectIds = projects.map((p) => p.id);
      const projectMap = new Map(projects.map((p) => [p.id, p.name]));

      // Get overdue tasks
      const { data: overdueTasks } = await supabase
        .from("tasks")
        .select("id, title, project_id, due_date")
        .in("project_id", projectIds)
        .lt("due_date", today)
        .not("status", "in", '("Done","Cancelled")');

      // Get today's tasks
      const { data: todayTasks } = await supabase
        .from("tasks")
        .select("id, title, project_id")
        .in("project_id", projectIds)
        .eq("due_date", today)
        .not("status", "in", '("Done","Cancelled")');

      // Get open challenges
      const { data: challenges } = await supabase
        .from("challenges")
        .select("id, title, project_id")
        .in("project_id", projectIds)
        .eq("status", "open");

      const overdueCount = overdueTasks?.length ?? 0;
      const todayCount = todayTasks?.length ?? 0;
      const openChallengeCount = challenges?.length ?? 0;
      const preferences = await getOrCreateNotificationPreferences(supabase, manager.id);
      const hasImportantItems = overdueCount > 0 || openChallengeCount > 0;

      // --- In-App Notification ---
      if (preferences.in_app_enabled && preferences.daily_digest_enabled) {
        await createNotification({
          user_id: manager.id,
          type: "daily_digest",
          category: "digest",
          priority: hasImportantItems ? "high" : "medium",
          title: "ملخصك اليومي",
          body: `لديك ${overdueCount} مهمة متأخرة و ${todayCount} مهمة مستحقة اليوم`,
          action_url: "/notifications?tab=summaries",
          sent_via: "in_app",
        });
      }

      // --- Email (important only by default) ---
      if (manager.email && preferences.daily_digest_enabled && shouldSendImportantEmail(preferences, hasImportantItems)) {
        const html = dailyDigestTemplate({
          managerName: manager.full_name ?? manager.email,
          overdueTasks: (overdueTasks ?? []).map((t) => ({
            title: t.title,
            project: projectMap.get(t.project_id) ?? "—",
            dueDate: t.due_date ? format(new Date(t.due_date), "d MMMM", { locale: ar }) : "—",
          })),
          todayTasks: (todayTasks ?? []).map((t) => ({
            title: t.title,
            project: projectMap.get(t.project_id) ?? "—",
          })),
          openChallenges: (challenges ?? []).map((c) => ({
            title: c.title,
            project: projectMap.get(c.project_id) ?? "—",
          })),
        });

        const { success } = await sendEmail({
          to: manager.email,
          subject: `ملخص مهم - سماوة | ${format(new Date(), "d MMMM yyyy", { locale: ar })}`,
          html,
        });

        if (success) sentCount++;
      }
    }

    const managerFollowups = await runManagerFollowups(supabase);
    const payload: Json = {
      sent: sentCount,
      date: today,
      managerFollowups: {
        managersChecked: managerFollowups.managersChecked,
        notificationsCreated: managerFollowups.notificationsCreated,
        findingsCreated: managerFollowups.findingsCreated,
      },
    };

    await supabase.from("automation_logs").update({ status: "success", payload }).eq("id", log?.id ?? "");
    return NextResponse.json({ success: true, sent: sentCount, managerFollowups });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    await supabase.from("automation_logs").insert({ type: "daily-digest", status: "error", error: errorMessage });
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
