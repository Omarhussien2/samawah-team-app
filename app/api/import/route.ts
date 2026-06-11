import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { normalizeMoney } from "@/lib/projects/budget";
import { mapProjectType } from "@/lib/utils";
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

function isMissingProjectTypeColumn(error: { message?: string; code?: string } | null): boolean {
  const message = error?.message ?? "";
  return error?.code === "PGRST204" || (message.includes("project_type") && message.includes("schema cache"));
}

export async function POST(request: NextRequest) {
  try {
    const { type, data } = await request.json();
    const supabase = createServiceClient();

    let successCount = 0;
    let errorCount = 0;
    const errorDetails: string[] = [];

    if (type === "projects") {
      for (const project of data) {
        if (project._errors?.length > 0) { errorCount++; continue; }
        const legacyId = clean(project.legacy_project_id);
        const row: ProjectInsert = {
          ...(legacyId ? { legacy_project_id: legacyId } : {}),
          name: project.name,
          project_type: mapProjectType(project.project_type),
          manager_name: clean(project.manager_name),
          path: clean(project.path),
          current_stage: clean(project.current_stage),
          start_date: clean(project.start_date),
          end_date: clean(project.end_date),
          total_budget: normalizeMoney(project.total_budget),
          description: clean(project.description),
          status: "active",
        };

        let { error } = await supabase.from("projects").upsert(row, {
          ...(legacyId ? { onConflict: "legacy_project_id" } : {}),
          ignoreDuplicates: false,
        });

        if (isMissingProjectTypeColumn(error)) {
          const rowWithoutType: Omit<ProjectInsert, "project_type"> = {
            ...(legacyId ? { legacy_project_id: legacyId } : {}),
            name: row.name,
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
          });
          error = retry.error;
        }
        if (error) {
          errorCount++;
          errorDetails.push(`مشروع "${project.name}": ${error.message}`);
        } else {
          successCount++;
        }
      }
    } else if (type === "tasks") {
      const { data: projects } = await supabase.from("projects").select("id, legacy_project_id");
      const projectMap = new Map(projects?.map((p) => [p.legacy_project_id, p.id]) ?? []);

      for (const task of data) {
        if (task._errors?.length > 0) { errorCount++; continue; }
        const projectId = projectMap.get(task.legacy_project_id);
        if (!projectId) { errorCount++; continue; }

        const alertLevel = task.alert_level && ["Low","Medium","High","Critical"].includes(task.alert_level) ? task.alert_level : null;
        const legacyTaskId = clean(task.legacy_task_id);
        const validStatuses = ["Backlog","To Do","In Progress","Review","Done","Cancelled"];
        const status = validStatuses.includes(task.status) ? task.status : "To Do";

        const row: TaskInsert = {
          ...(legacyTaskId ? { legacy_task_id: legacyTaskId } : {}),
          project_id: projectId,
          title: task.title,
          sub_task: clean(task.sub_task),
          category: clean(task.category),
          owner_name: clean(task.owner_name),
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
          successCount++;
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
