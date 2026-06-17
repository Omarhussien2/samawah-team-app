import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";
import { createNotification } from "@/lib/notifications/create-notification";
import { computeProjectProgressFromTasks } from "@/lib/utils/recalc-progress";

/**
 * POST /api/task-events
 * Handles task status changes and assignment notifications.
 * Called from TaskModal and KanbanBoard after a successful update.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  let body: {
    task_id: string;
    task_title: string;
    project_id: string;
    old_status?: string;
    new_status?: string;
    old_owner_id?: string | null;
    new_owner_id?: string | null;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "بيانات غير صحيحة" }, { status: 400 });
  }

  if (!body.task_id || !body.task_title) {
    return NextResponse.json({ error: "task_id و task_title مطلوبان" }, { status: 400 });
  }

  const serviceClient = createServiceClient();

  // Get current user's name
  const { data: currentUser } = await serviceClient
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .single();

  const actorName = currentUser?.full_name ?? "مستخدم";

  // --- Task Assignment Notification ---
  if (body.new_owner_id && body.new_owner_id !== body.old_owner_id && body.new_owner_id !== user.id) {
    await createNotification({
      user_id: body.new_owner_id,
      project_id: body.project_id,
      task_id: body.task_id,
      type: "task_assigned",
      title: "تم تعيينك على مهمة",
      body: `قام ${actorName} بتعيينك على مهمة "${body.task_title}"`,
    });
  }

  // --- Status Change Notification ---
  if (body.new_status && body.old_status && body.new_status !== body.old_status) {
    const statusLabels: Record<string, string> = {
      Backlog: "الأعمال المتراكمة",
      "To Do": "قيد الانتظار",
      "In Progress": "قيد التنفيذ",
      Review: "تحت المراجعة",
      Done: "مكتمل",
      Cancelled: "ملغي",
    };

    const newLabel = statusLabels[body.new_status] ?? body.new_status;
    const notifyUsers: string[] = [];

    // Notify task owner if not the person making the change
    const { data: task } = await serviceClient
      .from("tasks")
      .select("owner_id")
      .eq("id", body.task_id)
      .single();

    if (task?.owner_id && task.owner_id !== user.id) {
      notifyUsers.push(task.owner_id);
    }

    // Notify project manager
    if (body.project_id) {
      const { data: project } = await serviceClient
        .from("projects")
        .select("manager_id")
        .eq("id", body.project_id)
        .single();

      if (project?.manager_id && project.manager_id !== user.id && !notifyUsers.includes(project.manager_id)) {
        notifyUsers.push(project.manager_id);
      }
    }

    for (const userId of notifyUsers) {
      await createNotification({
        user_id: userId,
        project_id: body.project_id,
        task_id: body.task_id,
        type: "task_status",
        title: "تغيير حالة مهمة",
        body: `قام ${actorName} بتغيير حالة "${body.task_title}" إلى "${newLabel}"`,
      });
    }
  }

  // --- Recalculate project progress ---
  if (body.project_id && body.new_status && body.old_status && body.new_status !== body.old_status) {
    let { data: projTasks, error: projectTasksError } = await serviceClient
      .from("tasks")
      .select("status,affects_project_progress")
      .eq("project_id", body.project_id);

    if (projectTasksError && projectTasksError.message.includes("affects_project_progress")) {
      const retry = await serviceClient
        .from("tasks")
        .select("status")
        .eq("project_id", body.project_id);
      projTasks = retry.data?.map((task) => ({ ...task, affects_project_progress: true })) ?? null;
      projectTasksError = retry.error;
    }

    if (!projectTasksError && projTasks) {
      const newProgress = computeProjectProgressFromTasks(projTasks);
      await serviceClient.from("projects").update({ progress: newProgress }).eq("id", body.project_id);
    }
  }

  return NextResponse.json({ success: true });
}
