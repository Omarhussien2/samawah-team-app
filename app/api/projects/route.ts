import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { normalizeMoney } from "@/lib/projects/budget";
import { isMissingProjectTypeColumn, saveProjectTypeOverride } from "@/lib/projects/project-type-store";
import type { Database, Profile, Project } from "@/lib/supabase/types";

type ProjectInsert = Database["public"]["Tables"]["projects"]["Insert"];

const budgetFieldSchema = z.preprocess(
  (value) => {
    const numericValue = Number(value);
    return value === "" || value === undefined || Number.isNaN(numericValue) ? 0 : numericValue;
  },
  z.number().min(0).default(0)
);

const createProjectSchema = z.object({
  name: z.string().trim().min(1),
  project_type: z.enum(["external", "internal"]).default("internal"),
  manager_id: z.string().nullable().optional(),
  current_stage: z.string().nullable().optional(),
  start_date: z.string().nullable().optional(),
  end_date: z.string().nullable().optional(),
  total_budget: budgetFieldSchema,
  description: z.string().nullable().optional(),
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

function withoutProjectType(payload: ProjectInsert): Omit<ProjectInsert, "project_type"> {
  const rest = { ...payload };
  delete rest.project_type;
  return rest;
}

export async function POST(request: NextRequest) {
  const { user, error: userError, status } = await getApiUser();
  if (!user) return NextResponse.json({ error: userError }, { status: status ?? 401 });

  if (!["admin", "project_manager"].includes(user.role)) {
    return NextResponse.json(
      { error: "إنشاء المشاريع متاح لمدير النظام أو مدير المشاريع فقط" },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = createProjectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "بيانات المشروع غير صحيحة" }, { status: 400 });
  }

  const data = parsed.data;
  const supabase = createServiceClient();
  const managerId = user.role === "project_manager" ? user.id : data.manager_id || null;
  const { data: manager } = managerId
    ? await supabase.from("profiles").select("full_name").eq("id", managerId).maybeSingle()
    : { data: null };

  const payload: ProjectInsert = {
    name: data.name,
    project_type: data.project_type,
    manager_id: managerId,
    manager_name: manager?.full_name ?? null,
    current_stage: data.current_stage || null,
    start_date: data.start_date || null,
    end_date: data.end_date || null,
    total_budget: normalizeMoney(data.total_budget),
    description: data.description || null,
    status: "active",
  };

  let usedFallbackStorage = false;
  let { data: project, error } = await supabase
    .from("projects")
    .insert(payload)
    .select("*")
    .single();

  if (isMissingProjectTypeColumn(error)) {
    usedFallbackStorage = true;
    const retry = await supabase
      .from("projects")
      .insert(withoutProjectType(payload))
      .select("*")
      .single();
    project = retry.data as Project | null;
    error = retry.error;
  }

  if (error || !project) {
    return NextResponse.json(
      { error: `فشل إنشاء المشروع: ${error?.message ?? "خطأ غير معروف"}` },
      { status: 500 }
    );
  }

  try {
    await saveProjectTypeOverride(project.id, data.project_type, user.id);
  } catch (metadataError) {
    if (usedFallbackStorage) {
      await supabase.from("projects").delete().eq("id", project.id);
      const message = metadataError instanceof Error ? metadataError.message : "تعذر حفظ نوع المشروع";
      return NextResponse.json({ error: `فشل حفظ نوع المشروع: ${message}` }, { status: 500 });
    }
  }

  return NextResponse.json(
    { project: { ...project, project_type: data.project_type } },
    { status: 201 }
  );
}
