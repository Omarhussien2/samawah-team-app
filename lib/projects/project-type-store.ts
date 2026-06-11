import { createServiceClient } from "@/lib/supabase/server";
import { getProjectType, inferProjectTypeFromName, isValidProjectType } from "@/lib/utils";
import type { Json, ProjectType } from "@/lib/supabase/types";

export const PROJECT_TYPE_METADATA_TEMPLATE_NAME = "__samawah_project_type_metadata";
const PROJECT_TYPE_METADATA_PATH = "__system/project-type";

export type ProjectTypeReference = {
  id?: string | null;
  name?: string | null;
  project_type?: string | null;
};

export function isMissingProjectTypeColumn(error: { message?: string; code?: string } | null): boolean {
  const message = error?.message ?? "";
  return (
    error?.code === "PGRST204" ||
    error?.code === "42703" ||
    (message.includes("project_type") && (message.includes("schema cache") || message.includes("does not exist")))
  );
}

function getProjectTypeFromJson(value: Json | null | undefined): ProjectType | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const type = value.project_type;
  return typeof type === "string" && isValidProjectType(type) ? type : null;
}

async function getProjectTypeTemplateId(): Promise<string | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("project_form_templates")
    .select("id")
    .eq("name", PROJECT_TYPE_METADATA_TEMPLATE_NAME)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data?.id ?? null;
}

async function ensureProjectTypeTemplateId(): Promise<string> {
  const existingId = await getProjectTypeTemplateId();
  if (existingId) return existingId;

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("project_form_templates")
    .insert({
      name: PROJECT_TYPE_METADATA_TEMPLATE_NAME,
      description: "System metadata for project type fallback storage.",
      category: "system",
      stage: "system",
      applies_to_path: PROJECT_TYPE_METADATA_PATH,
      template_kind: "form",
      schema_json: { system: true, fields: [] } as Json,
      active: false,
      sort_order: -999,
    })
    .select("id")
    .single();

  if (error) throw error;
  return data.id;
}

export async function loadProjectTypeOverrides(projectIds: string[]): Promise<Map<string, ProjectType>> {
  const uniqueIds = Array.from(new Set(projectIds.filter(Boolean)));
  const overrides = new Map<string, ProjectType>();
  if (uniqueIds.length === 0) return overrides;

  const templateId = await getProjectTypeTemplateId();
  if (!templateId) return overrides;

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("project_form_instances")
    .select("project_id,data_json")
    .eq("template_id", templateId)
    .in("project_id", uniqueIds);

  if (error) throw error;

  for (const row of data ?? []) {
    const type = getProjectTypeFromJson(row.data_json);
    if (type) overrides.set(row.project_id, type);
  }

  return overrides;
}

async function loadProjectTypesFromProjectsColumn(projectIds: string[]): Promise<Map<string, ProjectType>> {
  const uniqueIds = Array.from(new Set(projectIds.filter(Boolean)));
  const types = new Map<string, ProjectType>();
  if (uniqueIds.length === 0) return types;

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("projects")
    .select("id,project_type")
    .in("id", uniqueIds);

  if (isMissingProjectTypeColumn(error)) return types;
  if (error) throw error;

  for (const row of data ?? []) {
    if (isValidProjectType(row.project_type)) types.set(row.id, row.project_type);
  }

  return types;
}

export async function saveProjectTypeOverride(
  projectId: string,
  projectType: ProjectType,
  userId?: string | null
): Promise<void> {
  const templateId = await ensureProjectTypeTemplateId();
  const supabase = createServiceClient();
  const now = new Date().toISOString();
  const payload = {
    project_id: projectId,
    template_id: templateId,
    status: "completed" as const,
    data_json: {
      project_type: projectType,
      source: "project_type_fallback",
      saved_at: now,
    } as Json,
    completion_percentage: 100,
    created_by: userId ?? null,
    updated_by: userId ?? null,
    completed_at: now,
  };

  const { error } = await supabase
    .from("project_form_instances")
    .upsert(payload, { onConflict: "project_id,template_id" });

  if (error) throw error;
}

export async function saveProjectTypeOverrides(
  records: Array<{ projectId: string; projectType: ProjectType; userId?: string | null }>
): Promise<void> {
  if (records.length === 0) return;
  const templateId = await ensureProjectTypeTemplateId();
  const supabase = createServiceClient();
  const now = new Date().toISOString();

  const payload = records.map((record) => ({
    project_id: record.projectId,
    template_id: templateId,
    status: "completed" as const,
    data_json: {
      project_type: record.projectType,
      source: "project_type_fallback",
      saved_at: now,
    } as Json,
    completion_percentage: 100,
    created_by: record.userId ?? null,
    updated_by: record.userId ?? null,
    completed_at: now,
  }));

  const { error } = await supabase
    .from("project_form_instances")
    .upsert(payload, { onConflict: "project_id,template_id" });

  if (error) throw error;
}

export async function getProjectTypeMapForProjects(projects: ProjectTypeReference[]): Promise<Map<string, ProjectType>> {
  const map = new Map<string, ProjectType>();
  const missingProjects = projects.filter((project) => project.id && !isValidProjectType(project.project_type));

  for (const project of projects) {
    if (project.id && isValidProjectType(project.project_type)) {
      map.set(project.id, project.project_type);
    }
  }

  const columnTypes = await loadProjectTypesFromProjectsColumn(missingProjects.map((project) => project.id as string));
  for (const [projectId, projectType] of columnTypes) {
    map.set(projectId, projectType);
  }

  const stillMissingProjects = missingProjects.filter((project) => project.id && !map.has(project.id));
  const overrides = await loadProjectTypeOverrides(stillMissingProjects.map((project) => project.id as string));
  for (const project of stillMissingProjects) {
    if (!project.id) continue;
    map.set(project.id, overrides.get(project.id) ?? inferProjectTypeFromName(project.name));
  }

  return map;
}

export async function attachProjectTypes<T extends ProjectTypeReference>(
  projects: T[]
): Promise<Array<T & { project_type: ProjectType }>> {
  const typeMap = await getProjectTypeMapForProjects(projects);
  return projects.map((project) => ({
    ...project,
    project_type: project.id ? typeMap.get(project.id) ?? getProjectType(project) : getProjectType(project),
  }));
}

export async function attachRelationProjectTypes<T extends { project?: ProjectTypeReference | null }>(
  rows: T[]
): Promise<T[]> {
  const projects = rows.map((row) => row.project).filter((project): project is ProjectTypeReference => Boolean(project?.id));
  const typeMap = await getProjectTypeMapForProjects(projects);

  return rows.map((row) => {
    if (!row.project?.id) return row;
    return {
      ...row,
      project: {
        ...row.project,
        project_type: typeMap.get(row.project.id) ?? getProjectType(row.project),
      },
    };
  });
}
