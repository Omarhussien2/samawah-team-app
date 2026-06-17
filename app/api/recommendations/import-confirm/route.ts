import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { createNotification } from "@/lib/notifications/create-notification";
import {
  DEFAULT_RECOMMENDATION_PRIORITY,
  DEFAULT_RECOMMENDATION_STATUS,
  RECOMMENDATION_CATEGORY,
  RECOMMENDATION_SOURCE_TYPE,
  buildRecommendationDedupeKey,
  getExistingRecommendationKeys,
} from "@/lib/recommendations/tasks";
import { computeProjectProgressFromTasks } from "@/lib/utils/recalc-progress";
import type { Database, Profile, Project, Task } from "@/lib/supabase/types";

type TaskInsert = Database["public"]["Tables"]["tasks"]["Insert"];
type ProjectAccess = Pick<Project, "id" | "manager_id" | "forms_owner_id">;

const confirmSchema = z.object({
  meeting_title: z.string().nullable().optional(),
  meeting_date: z.string().nullable().optional(),
  items: z.array(z.object({
    project_id: z.string().min(1),
    text: z.string().trim().min(1),
    owner_id: z.string().nullable().optional(),
    due_date: z.string().nullable().optional(),
    priority: z.enum(["low", "medium", "high", "critical"]).optional(),
    affects_project_progress: z.boolean().optional(),
  })).min(1),
});

export async function POST(request: NextRequest) {
  const { user, error: userError, status } = await getApiUser();
  if (!user) return NextResponse.json({ error: userError }, { status: status ?? 401 });

  const body = await request.json().catch(() => null);
  const parsed = confirmSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "بيانات الاستيراد غير صحيحة" }, { status: 400 });

  const projectIds = Array.from(new Set(parsed.data.items.map((item) => item.project_id)));
  const serviceClient = createServiceClient();
  const { data: projects, error: projectsError } = await serviceClient
    .from("projects")
    .select("id,manager_id,forms_owner_id")
    .in("id", projectIds);

  if (projectsError) return NextResponse.json({ error: projectsError.message }, { status: 500 });

  const projectMap = new Map((projects ?? []).map((project) => [project.id, project]));
  const missingProject = projectIds.find((projectId) => !projectMap.has(projectId));
  if (missingProject) return NextResponse.json({ error: "يوجد مشروع غير موجود في بيانات الاستيراد" }, { status: 404 });

  const unauthorizedProject = projectIds.find((projectId) => !canManageRecommendations(user, projectMap.get(projectId)!));
  if (unauthorizedProject) {
    return NextResponse.json({ error: "ليست لديك صلاحية إدارة توصيات أحد المشاريع المحددة" }, { status: 403 });
  }

  const ownerIds = parsed.data.items.map((item) => item.owner_id).filter((ownerId): ownerId is string => Boolean(ownerId));
  const [{ data: existingRecommendations }, profilesResult] = await Promise.all([
    serviceClient
      .from("tasks")
      .select("project_id,title,source_meeting_title,source_meeting_date")
      .in("project_id", projectIds)
      .eq("source_type", RECOMMENDATION_SOURCE_TYPE),
    ownerIds.length > 0
      ? serviceClient.from("profiles").select("id,full_name").in("id", ownerIds)
      : Promise.resolve({ data: [] }),
  ]);

  const existingKeys = getExistingRecommendationKeys((existingRecommendations ?? []) as Pick<Task, "project_id" | "title" | "source_meeting_title" | "source_meeting_date">[]);
  const profiles = profilesResult.data ?? [];
  const ownerNames = new Map((profiles ?? []).map((profile) => [profile.id, profile.full_name]));
  const payloads: TaskInsert[] = [];
  let skippedDuplicates = 0;

  for (const item of parsed.data.items) {
    const key = buildRecommendationDedupeKey({
      projectId: item.project_id,
      text: item.text,
      meetingTitle: parsed.data.meeting_title,
      meetingDate: parsed.data.meeting_date,
    });

    if (existingKeys.has(key)) {
      skippedDuplicates += 1;
      continue;
    }

    existingKeys.add(key);
    payloads.push({
      project_id: item.project_id,
      title: item.text,
      category: RECOMMENDATION_CATEGORY,
      owner_id: item.owner_id || null,
      owner_name: item.owner_id ? ownerNames.get(item.owner_id) ?? null : null,
      status: DEFAULT_RECOMMENDATION_STATUS,
      board_column: DEFAULT_RECOMMENDATION_STATUS,
      priority: item.priority ?? DEFAULT_RECOMMENDATION_PRIORITY,
      due_date: item.due_date || null,
      source_type: RECOMMENDATION_SOURCE_TYPE,
      source_meeting_title: parsed.data.meeting_title || null,
      source_meeting_date: parsed.data.meeting_date || null,
      source_created_by: user.id,
      affects_project_progress: item.affects_project_progress ?? true,
    });
  }

  if (payloads.length === 0) return NextResponse.json({ recommendations: [], skippedDuplicates });

  const { data: inserted, error: insertError } = await serviceClient
    .from("tasks")
    .insert(payloads)
    .select("*, owner:profiles(id,full_name,avatar_url), project:projects(id,name)");

  if (insertError) {
    return NextResponse.json({ error: `تعذر استيراد التوصيات: ${insertError.message}` }, { status: 500 });
  }

  await notifyAssignedOwners(inserted ?? [], user.id, serviceClient);
  await Promise.all(projectIds.map((projectId) => recalculateProjectProgress(serviceClient, projectId)));

  return NextResponse.json({ recommendations: inserted ?? [], skippedDuplicates }, { status: 201 });
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

async function notifyAssignedOwners(tasks: Task[], actorId: string, supabase: ReturnType<typeof createServiceClient>) {
  const assignedTasks = tasks.filter((task) => task.owner_id && task.owner_id !== actorId);
  if (assignedTasks.length === 0) return;

  const { data: actor } = await supabase.from("profiles").select("full_name").eq("id", actorId).maybeSingle();
  const actorName = actor?.full_name ?? "مستخدم";

  for (const task of assignedTasks) {
    await createNotification({
      user_id: task.owner_id as string,
      project_id: task.project_id,
      task_id: task.id,
      type: "task_assigned",
      title: "تم تعيينك على توصية",
      body: `قام ${actorName} بتعيينك على توصية "${task.title}"`,
    });
  }
}
