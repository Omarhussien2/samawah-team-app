import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { normalizeMoney } from "@/lib/projects/budget";
import { canEditProject } from "@/lib/projects/project-permissions";
import { isMissingProjectTypeColumn, saveProjectTypeOverride } from "@/lib/projects/project-type-store";
import type { Database, Profile, Project } from "@/lib/supabase/types";

type ProjectUpdate = Database["public"]["Tables"]["projects"]["Update"];

const budgetFieldSchema = z.preprocess(
  (value) => {
    const numericValue = Number(value);
    return value === "" || value === undefined || Number.isNaN(numericValue) ? 0 : numericValue;
  },
  z.number().min(0).default(0)
);

const updateProjectSchema = z.object({
  name: z.string().trim().min(1),
  project_type: z.enum(["external", "internal"]),
  status: z.enum(["active", "paused", "completed", "cancelled"]),
  manager_id: z.string().nullable().optional(),
  current_stage: z.string().nullable().optional(),
  start_date: z.string().nullable().optional(),
  end_date: z.string().nullable().optional(),
  total_budget: budgetFieldSchema,
  description: z.string().nullable().optional(),
  forms_owner_id: z.string().nullable().optional(),
});

async function getApiUser(): Promise<{ user: Profile | null; status?: number; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { user: null, status: 401, error: "غير مصرح" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) return { user: null, status: 401, error: "غير مصرح" };
  return { user: profile };
}

function withoutProjectType(payload: ProjectUpdate): Omit<ProjectUpdate, "project_type"> {
  const rest = { ...payload };
  delete rest.project_type;
  return rest;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { user, error: userError, status } = await getApiUser();
  if (!user) return NextResponse.json({ error: userError }, { status: status ?? 401 });

  const body = await request.json().catch(() => null);
  const parsed = updateProjectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "بيانات المشروع غير صحيحة" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data: existingProject, error: fetchError } = await supabase
    .from("projects")
    .select("id,manager_id")
    .eq("id", id)
    .single();

  if (fetchError || !existingProject) {
    return NextResponse.json({ error: "لم يتم العثور على المشروع" }, { status: 404 });
  }

  if (!canEditProject(user, existingProject)) {
    return NextResponse.json({ error: "ليست لديك صلاحية تعديل هذا المشروع" }, { status: 403 });
  }

  const data = parsed.data;
  const managerId = data.manager_id || null;
  const { data: manager } = managerId
    ? await supabase.from("profiles").select("full_name").eq("id", managerId).maybeSingle()
    : { data: null };

  const payload: ProjectUpdate = {
    name: data.name,
    project_type: data.project_type,
    status: data.status,
    current_stage: data.current_stage || null,
    start_date: data.start_date || null,
    end_date: data.end_date || null,
    total_budget: normalizeMoney(data.total_budget),
    description: data.description || null,
    forms_owner_id: data.forms_owner_id || null,
    manager_id: managerId,
    manager_name: manager?.full_name ?? null,
  };

  let usedFallbackStorage = false;
  let { data: project, error } = await supabase
    .from("projects")
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();

  if (isMissingProjectTypeColumn(error)) {
    usedFallbackStorage = true;
    const retry = await supabase
      .from("projects")
      .update(withoutProjectType(payload))
      .eq("id", id)
      .select("*")
      .single();
    project = retry.data as Project | null;
    error = retry.error;
  }

  if (error || !project) {
    return NextResponse.json(
      { error: `فشل تحديث المشروع: ${error?.message ?? "خطأ غير معروف"}` },
      { status: 500 }
    );
  }

  try {
    await saveProjectTypeOverride(id, data.project_type, user.id);
  } catch (metadataError) {
    if (usedFallbackStorage) {
      const message = metadataError instanceof Error ? metadataError.message : "تعذر حفظ نوع المشروع";
      return NextResponse.json({ error: `فشل حفظ نوع المشروع: ${message}` }, { status: 500 });
    }
  }

  return NextResponse.json({ project: { ...project, project_type: data.project_type } });
}
