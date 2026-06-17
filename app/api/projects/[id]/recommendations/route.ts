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

const recommendationSchema = z.object({
  text: z.string().trim().min(1),
  owner_id: z.string().nullable().optional(),
  due_date: z.string().nullable().optional(),
  priority: z.enum(["low", "medium", "high", "critical"]).optional(),
  source_meeting_title: z.string().nullable().optional(),
  source_meeting_date: z.string().nullable().optional(),
  affects_project_progress: z.boolean().optional(),
});

const bulkRecommendationSchema = z.object({
  recommendations: z.array(recommendationSchema).min(1),
  source_meeting_title: z.string().nullable().optional(),
  source_meeting_date: z.string().nullable().optional(),
});

type ParsedRecommendation = z.infer<typeof recommendationSchema> & {
  source_meeting_title?: string | null;
  source_meeting_date?: string | null;
};

type ProjectAccess = Pick<Project, "id" | "manager_id" | "forms_owner_id">;

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user, error, status } = await getApiUser();
  if (!user) return NextResponse.json({ error }, { status: status ?? 401 });

  const { data: project } = await supabase
    .from("projects")
    .select("id,manager_id,forms_owner_id")
    .eq("id", id)
    .maybeSingle();

  if (!project) return NextResponse.json({ error: "لم يتم العثور على المشروع" }, { status: 404 });

  const { data: recommendations, error: recommendationsError } = await supabase
    .from("tasks")
    .select("*, owner:profiles(id,full_name,avatar_url), project:projects(id,name)")
    .eq("project_id", id)
    .eq("source_type", RECOMMENDATION_SOURCE_TYPE)
    .order("created_at", { ascending: false });

  if (recommendationsError) {
    return NextResponse.json({ error: recommendationsError.message }, { status: 500 });
  }

  return NextResponse.json({
    recommendations: recommendations ?? [],
    canManage: canManageRecommendations(user, project),
  });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, error: userError, status } = await getApiUser();
  if (!user) return NextResponse.json({ error: userError }, { status: status ?? 401 });

  const body = await request.json().catch(() => null);
  const single = recommendationSchema.safeParse(body);
  const bulk = bulkRecommendationSchema.safeParse(body);
  if (!single.success && !bulk.success) {
    return NextResponse.json({ error: "بيانات التوصيات غير صحيحة" }, { status: 400 });
  }

  const serviceClient = createServiceClient();
  const { data: project } = await serviceClient
    .from("projects")
    .select("id,manager_id,forms_owner_id")
    .eq("id", id)
    .maybeSingle();

  if (!project) return NextResponse.json({ error: "لم يتم العثور على المشروع" }, { status: 404 });
  if (!canManageRecommendations(user, project)) {
    return NextResponse.json({ error: "ليست لديك صلاحية إدارة توصيات هذا المشروع" }, { status: 403 });
  }

  const parsedRecommendations: ParsedRecommendation[] = bulk.success
    ? bulk.data.recommendations.map((item) => ({
        ...item,
        source_meeting_title: item.source_meeting_title ?? bulk.data.source_meeting_title ?? null,
        source_meeting_date: item.source_meeting_date ?? bulk.data.source_meeting_date ?? null,
      }))
    : single.success
      ? [single.data]
      : [];

  const ownerIds = parsedRecommendations.map((item) => item.owner_id).filter((ownerId): ownerId is string => Boolean(ownerId));
  const [{ data: existingRecommendations }, profilesResult] = await Promise.all([
    serviceClient
      .from("tasks")
      .select("project_id,title,source_meeting_title,source_meeting_date")
      .eq("project_id", id)
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

  for (const recommendation of parsedRecommendations) {
    const key = buildRecommendationDedupeKey({
      projectId: id,
      text: recommendation.text,
      meetingTitle: recommendation.source_meeting_title,
      meetingDate: recommendation.source_meeting_date,
    });

    if (existingKeys.has(key)) {
      skippedDuplicates += 1;
      continue;
    }

    existingKeys.add(key);
    payloads.push({
      project_id: id,
      title: recommendation.text,
      category: RECOMMENDATION_CATEGORY,
      owner_id: recommendation.owner_id || null,
      owner_name: recommendation.owner_id ? ownerNames.get(recommendation.owner_id) ?? null : null,
      status: DEFAULT_RECOMMENDATION_STATUS,
      board_column: DEFAULT_RECOMMENDATION_STATUS,
      priority: recommendation.priority ?? DEFAULT_RECOMMENDATION_PRIORITY,
      due_date: recommendation.due_date || null,
      source_type: RECOMMENDATION_SOURCE_TYPE,
      source_meeting_title: recommendation.source_meeting_title || null,
      source_meeting_date: recommendation.source_meeting_date || null,
      source_created_by: user.id,
      affects_project_progress: recommendation.affects_project_progress ?? true,
    });
  }

  if (payloads.length === 0) {
    return NextResponse.json({ recommendations: [], skippedDuplicates });
  }

  const { data: inserted, error: insertError } = await serviceClient
    .from("tasks")
    .insert(payloads)
    .select("*, owner:profiles(id,full_name,avatar_url), project:projects(id,name)");

  if (insertError) {
    return NextResponse.json({ error: `تعذر إضافة التوصيات: ${insertError.message}` }, { status: 500 });
  }

  await notifyAssignedOwners(inserted ?? [], user.id, serviceClient);
  await recalculateProjectProgress(serviceClient, id);

  return NextResponse.json({ recommendations: inserted ?? [], skippedDuplicates }, { status: 201 });
}

async function getApiUser(): Promise<{
  supabase: Awaited<ReturnType<typeof createClient>>;
  user: Profile | null;
  status?: number;
  error?: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { supabase, user: null, status: 401, error: "غير مصرح" };

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  if (!profile) return { supabase, user: null, status: 401, error: "غير مصرح" };

  return { supabase, user: profile };
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
