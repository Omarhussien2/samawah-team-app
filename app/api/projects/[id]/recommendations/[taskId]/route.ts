import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { createNotification } from "@/lib/notifications/create-notification";
import { RECOMMENDATION_SOURCE_TYPE } from "@/lib/recommendations/tasks";
import { getStatusLabel } from "@/lib/utils";
import { computeProjectProgressFromTasks } from "@/lib/utils/recalc-progress";
import type { Database, Profile, Project, Task } from "@/lib/supabase/types";

type TaskUpdate = Database["public"]["Tables"]["tasks"]["Update"];
type ProjectAccess = Pick<Project, "id" | "manager_id" | "forms_owner_id">;

const updateRecommendationSchema = z.object({
  text: z.string().trim().min(1).optional(),
  status: z.enum(["Backlog", "To Do", "In Progress", "Review", "Done", "Cancelled"]).optional(),
  owner_id: z.string().nullable().optional(),
  due_date: z.string().nullable().optional(),
  priority: z.enum(["low", "medium", "high", "critical"]).optional(),
  source_meeting_title: z.string().nullable().optional(),
  source_meeting_date: z.string().nullable().optional(),
  affects_project_progress: z.boolean().optional(),
});

const managerOnlyFields = [
  "text",
  "owner_id",
  "due_date",
  "priority",
  "source_meeting_title",
  "source_meeting_date",
  "affects_project_progress",
];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  const { id, taskId } = await params;
  const { user, error: userError, status } = await getApiUser();
  if (!user) return NextResponse.json({ error: userError }, { status: status ?? 401 });

  const body = await request.json().catch(() => null);
  const parsed = updateRecommendationSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "بيانات التوصية غير صحيحة" }, { status: 400 });

  const serviceClient = createServiceClient();
  const [{ data: project }, { data: task }] = await Promise.all([
    serviceClient.from("projects").select("id,manager_id,forms_owner_id").eq("id", id).maybeSingle(),
    serviceClient
      .from("tasks")
      .select("*")
      .eq("id", taskId)
      .eq("project_id", id)
      .eq("source_type", RECOMMENDATION_SOURCE_TYPE)
      .maybeSingle(),
  ]);

  if (!project || !task) return NextResponse.json({ error: "لم يتم العثور على التوصية" }, { status: 404 });

  const canManage = canManageRecommendations(user, project);
  const isOwner = task.owner_id === user.id;
  if (!canManage && !isOwner) {
    return NextResponse.json({ error: "ليست لديك صلاحية تعديل هذه التوصية" }, { status: 403 });
  }

  if (!canManage && managerOnlyFields.some((field) => Object.prototype.hasOwnProperty.call(parsed.data, field))) {
    return NextResponse.json({ error: "يمكن لصاحب التوصية تحديث الحالة فقط" }, { status: 403 });
  }

  const payload: TaskUpdate = {};
  if (parsed.data.text !== undefined) payload.title = parsed.data.text;
  if (parsed.data.status !== undefined) {
    payload.status = parsed.data.status;
    payload.board_column = parsed.data.status;
    if (parsed.data.status === "Done") payload.progress = 100;
  }
  if (parsed.data.priority !== undefined) payload.priority = parsed.data.priority;
  if (parsed.data.due_date !== undefined) payload.due_date = parsed.data.due_date || null;
  if (parsed.data.source_meeting_title !== undefined) payload.source_meeting_title = parsed.data.source_meeting_title || null;
  if (parsed.data.source_meeting_date !== undefined) payload.source_meeting_date = parsed.data.source_meeting_date || null;
  if (parsed.data.affects_project_progress !== undefined) payload.affects_project_progress = parsed.data.affects_project_progress;

  if (parsed.data.owner_id !== undefined) {
    payload.owner_id = parsed.data.owner_id || null;
    if (parsed.data.owner_id) {
      const { data: owner } = await serviceClient
        .from("profiles")
        .select("full_name")
        .eq("id", parsed.data.owner_id)
        .maybeSingle();
      payload.owner_name = owner?.full_name ?? null;
    } else {
      payload.owner_name = null;
    }
  }

  const { data: updatedTask, error: updateError } = await serviceClient
    .from("tasks")
    .update(payload)
    .eq("id", taskId)
    .eq("project_id", id)
    .eq("source_type", RECOMMENDATION_SOURCE_TYPE)
    .select("*, owner:profiles(id,full_name,avatar_url), project:projects(id,name)")
    .single();

  if (updateError || !updatedTask) {
    return NextResponse.json({ error: `تعذر تحديث التوصية: ${updateError?.message ?? "خطأ غير معروف"}` }, { status: 500 });
  }

  await sendRecommendationNotifications({
    oldTask: task,
    updatedTask: updatedTask as Task,
    actorId: user.id,
    project,
    supabase: serviceClient,
  });
  await recalculateProjectProgress(serviceClient, id);

  return NextResponse.json({ recommendation: updatedTask });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  const { id, taskId } = await params;
  const { user, error: userError, status } = await getApiUser();
  if (!user) return NextResponse.json({ error: userError }, { status: status ?? 401 });

  const serviceClient = createServiceClient();
  const [{ data: project }, { data: task }] = await Promise.all([
    serviceClient.from("projects").select("id,manager_id,forms_owner_id").eq("id", id).maybeSingle(),
    serviceClient
      .from("tasks")
      .select("id")
      .eq("id", taskId)
      .eq("project_id", id)
      .eq("source_type", RECOMMENDATION_SOURCE_TYPE)
      .maybeSingle(),
  ]);

  if (!project || !task) return NextResponse.json({ error: "لم يتم العثور على التوصية" }, { status: 404 });
  if (!canManageRecommendations(user, project)) {
    return NextResponse.json({ error: "ليست لديك صلاحية حذف هذه التوصية" }, { status: 403 });
  }

  const { error: deleteError } = await serviceClient
    .from("tasks")
    .delete()
    .eq("id", taskId)
    .eq("project_id", id)
    .eq("source_type", RECOMMENDATION_SOURCE_TYPE);

  if (deleteError) {
    return NextResponse.json({ error: `تعذر حذف التوصية: ${deleteError.message}` }, { status: 500 });
  }

  await recalculateProjectProgress(serviceClient, id);
  return NextResponse.json({ success: true });
}

async function getApiUser(): Promise<{ user: Profile | null; status?: number; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { user: null, status: 401, error: "غير مصرح" };

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  if (!profile) return { user: null, status: 401, error: "غير مصرح" };

  return { user: profile };
}

function canManageRecommendations(user: Profile, project: ProjectAccess) {
  return user.role === "admin" || project.manager_id === user.id || project.forms_owner_id === user.id;
}

async function recalculateProjectProgress(supabase: ReturnType<typeof createServiceClient>, projectId: string) {
  const { data: tasks } = await supabase
    .from("tasks")
    .select("status,affects_project_progress")
    .eq("project_id", projectId);

  if (!tasks) return;
  const progress = computeProjectProgressFromTasks(tasks);
  await supabase.from("projects").update({ progress }).eq("id", projectId);
}

async function sendRecommendationNotifications({
  oldTask,
  updatedTask,
  actorId,
  project,
  supabase,
}: {
  oldTask: Task;
  updatedTask: Task;
  actorId: string;
  project: ProjectAccess;
  supabase: ReturnType<typeof createServiceClient>;
}) {
  const { data: actor } = await supabase.from("profiles").select("full_name").eq("id", actorId).maybeSingle();
  const actorName = actor?.full_name ?? "مستخدم";

  if (updatedTask.owner_id && updatedTask.owner_id !== oldTask.owner_id && updatedTask.owner_id !== actorId) {
    await createNotification({
      user_id: updatedTask.owner_id,
      project_id: updatedTask.project_id,
      task_id: updatedTask.id,
      type: "task_assigned",
      title: "تم تعيينك على توصية",
      body: `قام ${actorName} بتعيينك على توصية "${updatedTask.title}"`,
    });
  }

  if (updatedTask.status !== oldTask.status) {
    const recipients = new Set<string>();
    if (updatedTask.owner_id && updatedTask.owner_id !== actorId) recipients.add(updatedTask.owner_id);
    if (project.manager_id && project.manager_id !== actorId) recipients.add(project.manager_id);
    if (project.forms_owner_id && project.forms_owner_id !== actorId) recipients.add(project.forms_owner_id);

    for (const userId of recipients) {
      await createNotification({
        user_id: userId,
        project_id: updatedTask.project_id,
        task_id: updatedTask.id,
        type: "task_status",
        title: "تغيير حالة توصية",
        body: `قام ${actorName} بتغيير حالة "${updatedTask.title}" إلى "${getStatusLabel(updatedTask.status)}"`,
      });
    }
  }
}
