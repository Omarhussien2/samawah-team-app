import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { normalizeMoney } from "@/lib/projects/budget";
import { mapProjectType } from "@/lib/utils";
import { isMissingProjectTypeColumn, saveProjectTypeOverride } from "@/lib/projects/project-type-store";
import { findUniqueProfileByName } from "@/lib/users/name-matching";
import type { Database } from "@/lib/supabase/types";

type ProjectInsert = Database["public"]["Tables"]["projects"]["Insert"];
type TaskInsert = Database["public"]["Tables"]["tasks"]["Insert"];

function clean(val: string | null | undefined): string | null {
  if (!val || val.trim() === "") return null;
  return val.trim();
}

function cleanNum(val: number | string | null | undefined): number | null {
  const n = typeof val === "string" ? parseFloat(val) : val;
  if (typeof n !== "number" || isNaN(n)) return null;
  return n;
}

export async function POST(request: NextRequest) {
  try {
    const { type, data } = await request.json();
    const supabase = createServiceClient();
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
      for (const project of data) {
        if (project._errors?.length > 0) {
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
      const { data: projects, error: projectsError } = await supabase.from("projects").select("id, legacy_project_id");
      if (projectsError) throw projectsError;
      const projectMap = new Map(projects?.map((p) => [p.legacy_project_id, p.id]) ?? []);

      for (const task of data) {
        if (task._errors?.length > 0) {
          errorCount++;
          errorDetails.push(`مهمة "${task.title || task.legacy_task_id || "بدون اسم"}": ${task._errors.join("، ")}`);
          continue;
        }
        const projectId = projectMap.get(task.legacy_project_id);
        if (!projectId) {
          errorCount++;
          errorDetails.push(`مهمة "${task.title || task.legacy_task_id || "بدون اسم"}": لم يتم العثور على مشروع بالمعرف ${task.legacy_project_id || "الفارغ"}`);
          continue;
        }

        const alertLevel = task.alert_level && ["Low","Medium","High","Critical"].includes(task.alert_level) ? task.alert_level : null;
        const legacyTaskId = clean(task.legacy_task_id);
        const validStatuses = ["Backlog","To Do","In Progress","Review","Done","Cancelled"];
        const status = validStatuses.includes(task.status) ? task.status : "To Do";
        const ownerName = clean(task.owner_name);
        const ownerProfile = findUniqueProfileByName(ownerName, profileLookup);

        const row: TaskInsert = {
          ...(legacyTaskId ? { legacy_task_id: legacyTaskId } : {}),
          project_id: projectId,
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
            if (ownerProfile) await ensureProjectMember(projectId, ownerProfile.id, "member");
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
