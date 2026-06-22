import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { normalizeMoney } from "@/lib/projects/budget";
import { mapProjectType } from "@/lib/utils";
import { isMissingProjectTypeColumn, saveProjectTypeOverride } from "@/lib/projects/project-type-store";
import { findUniqueProfileByName } from "@/lib/users/name-matching";
import type { Database, Profile } from "@/lib/supabase/types";

type ProjectInsert = Database["public"]["Tables"]["projects"]["Insert"];
type TaskInsert = Database["public"]["Tables"]["tasks"]["Insert"];

interface ImportProjectPayload {
  legacy_project_id?: string;
  name?: string;
  project_type?: string;
  manager_name?: string;
  path?: string;
  current_stage?: string;
  start_date?: string;
  end_date?: string;
  total_budget?: number | string;
  description?: string;
  _errors?: string[];
}

interface ImportTaskPayload {
  legacy_task_id?: string;
  legacy_project_id?: string;
  title?: string;
  sub_task?: string;
  category?: string;
  owner_name?: string;
  status?: string;
  start_date?: string;
  due_date?: string;
  cost?: number | string;
  quantity_total?: number | string;
  quantity_done?: number | string;
  progress?: number | string;
  alert_level?: string;
  alert_message?: string;
  alert_action?: string;
  _errors?: string[];
}

interface ImportBody {
  type?: "projects" | "tasks";
  data?: ImportProjectPayload[] | ImportTaskPayload[];
  targetProjectId?: string | null;
}

interface ImportProjectAccess {
  id: string;
  legacy_project_id: string | null;
  manager_id: string | null;
  forms_owner_id: string | null;
}

function clean(val: string | null | undefined): string | null {
  if (!val || val.trim() === "") return null;
  return val.trim();
}

function cleanNum(val: number | string | null | undefined): number | null {
  const n = typeof val === "string" ? parseFloat(val) : val;
  if (typeof n !== "number" || isNaN(n)) return null;
  return n;
}

function canImportIntoProject(user: Profile, project: ImportProjectAccess, memberProjectIds: Set<string>) {
  if (user.role === "admin" || user.role === "project_manager") return true;
  if (project.manager_id === user.id || project.forms_owner_id === user.id) return true;
  return memberProjectIds.has(project.id);
}

const TASK_STATUSES = ["Backlog", "To Do", "In Progress", "Review", "Done", "Cancelled"] as const;
type TaskStatus = (typeof TASK_STATUSES)[number];

function isTaskStatus(status: string | undefined): status is TaskStatus {
  return TASK_STATUSES.includes(status as TaskStatus);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as ImportBody;
    const { type, data, targetProjectId } = body;

    if (type !== "projects" && type !== "tasks") {
      return NextResponse.json({ error: "نوع الاستيراد غير صحيح" }, { status: 400 });
    }

    if (!Array.isArray(data)) {
      return NextResponse.json({ error: "بيانات الاستيراد غير صحيحة" }, { status: 400 });
    }

    const userClient = await createClient();
    const { data: authData } = await userClient.auth.getUser();
    if (!authData.user) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const supabase = createServiceClient();
    const { data: currentUser, error: currentUserError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", authData.user.id)
      .maybeSingle();

    if (currentUserError) throw currentUserError;
    if (!currentUser) {
      return NextResponse.json({ error: "لم يتم العثور على ملف المستخدم" }, { status: 403 });
    }

    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id,full_name,email");

    if (profilesError) throw profilesError;
    const profileLookup = profiles ?? [];

    async function ensureProjectMember(projectId: string, userId: string, role: "manager" | "member", overwriteRole = false) {
      const { error } = await supabase.from("project_members").upsert(
        { project_id: projectId, user_id: userId, role_in_project: role },
        { onConflict: "project_id,user_id", ignoreDuplicates: !overwriteRole }
      );

      if (error) throw error;
    }

    let successCount = 0;
    let errorCount = 0;
    const errorDetails: string[] = [];

    if (type === "projects") {
      if (currentUser.role !== "admin" && currentUser.role !== "project_manager") {
        return NextResponse.json({ error: "ليس لديك صلاحية استيراد المشاريع" }, { status: 403 });
      }

      for (const project of data as ImportProjectPayload[]) {
        if (project._errors?.length) {
          errorCount++;
          errorDetails.push(`مشروع "${project.name || project.legacy_project_id || "بدون اسم"}": ${project._errors.join("، ")}`);
          continue;
        }

        const legacyId = clean(project.legacy_project_id);
        const projectType = mapProjectType(project.project_type);
        const managerName = clean(project.manager_name);
        const managerProfile = findUniqueProfileByName(managerName, profileLookup);
        const row: ProjectInsert = {
          ...(legacyId ? { legacy_project_id: legacyId } : {}),
          name: project.name,
          project_type: projectType,
          ...(managerProfile ? { manager_id: managerProfile.id } : {}),
          manager_name: managerName,
          path: clean(project.path),
          current_stage: clean(project.current_stage),
          start_date: clean(project.start_date),
          end_date: clean(project.end_date),
          total_budget: normalizeMoney(project.total_budget),
          description: clean(project.description),
          status: "active",
        };

        let { data: savedProject, error } = await supabase.from("projects").upsert(row, {
          ...(legacyId ? { onConflict: "legacy_project_id" } : {}),
          ignoreDuplicates: false,
        }).select("id").maybeSingle();

        if (isMissingProjectTypeColumn(error)) {
          const rowWithoutType: Omit<ProjectInsert, "project_type"> = {
            ...(legacyId ? { legacy_project_id: legacyId } : {}),
            name: row.name,
            ...(managerProfile ? { manager_id: managerProfile.id } : {}),
            manager_name: row.manager_name,
            path: row.path,
            current_stage: row.current_stage,
            start_date: row.start_date,
            end_date: row.end_date,
            total_budget: row.total_budget,
            description: row.description,
            status: row.status,
          };
          const retry = await supabase.from("projects").upsert(rowWithoutType, {
            ...(legacyId ? { onConflict: "legacy_project_id" } : {}),
            ignoreDuplicates: false,
          }).select("id").maybeSingle();
          savedProject = retry.data;
          error = retry.error;
        }

        if (error) {
          errorCount++;
          errorDetails.push(`مشروع "${project.name}": ${error.message}`);
        } else {
          try {
            if (!savedProject?.id) throw new Error("لم يتم إرجاع رقم المشروع بعد الحفظ");
            await saveProjectTypeOverride(savedProject.id, projectType);
            if (managerProfile) await ensureProjectMember(savedProject.id, managerProfile.id, "manager", true);
            successCount++;
          } catch (metadataError) {
            errorCount++;
            const message = metadataError instanceof Error ? metadataError.message : "تعذر حفظ نوع المشروع";
            errorDetails.push(`مشروع "${project.name}": ${message}`);
          }
        }
      }
    } else if (type === "tasks") {
      const { data: memberships, error: membershipsError } = await supabase
        .from("project_members")
        .select("project_id")
        .eq("user_id", currentUser.id);
      if (membershipsError) throw membershipsError;

      const memberProjectIds = new Set((memberships ?? []).map((membership) => membership.project_id));
      let fixedProject: ImportProjectAccess | null = null;
      let projectMap = new Map<string, ImportProjectAccess>();

      if (targetProjectId) {
        const { data: project, error: projectError } = await supabase
          .from("projects")
          .select("id, legacy_project_id, manager_id, forms_owner_id")
          .eq("id", targetProjectId)
          .maybeSingle();
        if (projectError) throw projectError;

        if (!project || !canImportIntoProject(currentUser, project, memberProjectIds)) {
          return NextResponse.json({ error: "ليس لديك صلاحية استيراد مهام داخل هذا المشروع" }, { status: 403 });
        }

        fixedProject = project;
      } else {
        const { data: projects, error: projectsError } = await supabase
          .from("projects")
          .select("id, legacy_project_id, manager_id, forms_owner_id");
        if (projectsError) throw projectsError;

        projectMap = new Map(
          (projects ?? [])
            .filter((project) => project.legacy_project_id)
            .map((project) => [project.legacy_project_id as string, project])
        );
      }

      for (const task of data as ImportTaskPayload[]) {
        if (task._errors?.length) {
          errorCount++;
          errorDetails.push(`مهمة "${task.title || task.legacy_task_id || "بدون اسم"}": ${task._errors.join("، ")}`);
          continue;
        }

        const project = fixedProject ?? projectMap.get(task.legacy_project_id ?? "");
        if (!project) {
          errorCount++;
          errorDetails.push(`مهمة "${task.title || task.legacy_task_id || "بدون اسم"}": لم يتم العثور على مشروع بالمعرف ${task.legacy_project_id || "الفارغ"}`);
          continue;
        }

        if (!canImportIntoProject(currentUser, project, memberProjectIds)) {
          errorCount++;
          errorDetails.push(`مهمة "${task.title || task.legacy_task_id || "بدون اسم"}": ليس لديك صلاحية الاستيراد داخل المشروع المرتبط`);
          continue;
        }

        const alertLevel = task.alert_level && ["Low", "Medium", "High", "Critical"].includes(task.alert_level) ? task.alert_level : null;
        const legacyTaskId = clean(task.legacy_task_id);
        const status = isTaskStatus(task.status) ? task.status : "To Do";
        const ownerName = clean(task.owner_name);
        const ownerProfile = findUniqueProfileByName(ownerName, profileLookup);

        const row: TaskInsert = {
          ...(legacyTaskId ? { legacy_task_id: legacyTaskId } : {}),
          project_id: project.id,
          title: task.title,
          sub_task: clean(task.sub_task),
          category: clean(task.category),
          ...(ownerProfile ? { owner_id: ownerProfile.id } : {}),
          owner_name: ownerName,
          status,
          board_column: status,
          priority: "medium",
          start_date: clean(task.start_date),
          due_date: clean(task.due_date),
          cost: normalizeMoney(task.cost),
          quantity_total: cleanNum(task.quantity_total),
          quantity_done: cleanNum(task.quantity_done),
          progress: cleanNum(task.progress) ?? 0,
          alert_level: alertLevel as TaskInsert["alert_level"],
          alert_message: clean(task.alert_message),
          alert_action: clean(task.alert_action),
        };

        const { error } = await supabase.from("tasks").upsert(row, {
          ...(legacyTaskId ? { onConflict: "legacy_task_id" } : {}),
          ignoreDuplicates: false,
        });

        if (error) {
          errorCount++;
          errorDetails.push(`مهمة "${task.title}": ${error.message}`);
        } else {
          try {
            if (ownerProfile) await ensureProjectMember(project.id, ownerProfile.id, "member");
            successCount++;
          } catch (memberError) {
            errorCount++;
            const message = memberError instanceof Error ? memberError.message : "تعذر ربط صاحب المهمة بالمشروع";
            errorDetails.push(`مهمة "${task.title}": تم حفظها لكن ${message}`);
          }
        }
      }
    }

    return NextResponse.json({
      success: successCount,
      errors: errorCount,
      ...(errorDetails.length > 0 ? { errorDetails } : {}),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "فشل الاستيراد";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
