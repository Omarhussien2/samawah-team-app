import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const { type, data } = await request.json();
    const supabase = createServiceClient();

    let successCount = 0;
    let errorCount = 0;

    if (type === "projects") {
      for (const project of data) {
        if (project._errors?.length > 0) { errorCount++; continue; }
        const { error } = await supabase.from("projects").upsert({
          legacy_project_id: project.legacy_project_id || null,
          name: project.name,
          manager_name: project.manager_name || null,
          path: project.path || null,
          current_stage: project.current_stage || null,
          start_date: project.start_date || null,
          end_date: project.end_date || null,
          total_budget: project.total_budget || 0,
          description: project.description || null,
          status: "active",
        }, { onConflict: "legacy_project_id", ignoreDuplicates: false });
        if (error) errorCount++;
        else successCount++;
      }
    } else if (type === "tasks") {
      // Fetch projects for ID mapping
      const { data: projects } = await supabase.from("projects").select("id, legacy_project_id");
      const projectMap = new Map(projects?.map((p) => [p.legacy_project_id, p.id]) ?? []);

      for (const task of data) {
        if (task._errors?.length > 0) { errorCount++; continue; }
        const projectId = projectMap.get(task.legacy_project_id);
        if (!projectId) { errorCount++; continue; }

        const alertLevel = task.alert_level && ["Low","Medium","High","Critical"].includes(task.alert_level) ? task.alert_level : null;

        const { error } = await supabase.from("tasks").upsert({
          legacy_task_id: task.legacy_task_id || null,
          project_id: projectId,
          title: task.title,
          sub_task: task.sub_task || null,
          category: task.category || null,
          owner_name: task.owner_name || null,
          status: task.status,
          board_column: task.status,
          priority: "medium",
          start_date: task.start_date || null,
          due_date: task.due_date || null,
          cost: task.cost || null,
          quantity_total: task.quantity_total || null,
          quantity_done: task.quantity_done || null,
          progress: task.progress || 0,
          alert_level: alertLevel,
          alert_message: task.alert_message || null,
          alert_action: task.alert_action || null,
        }, { onConflict: "legacy_task_id", ignoreDuplicates: false });

        if (error) errorCount++;
        else successCount++;
      }
    }

    return NextResponse.json({ success: successCount, errors: errorCount });
  } catch {
    return NextResponse.json({ error: "فشل الاستيراد" }, { status: 500 });
  }
}
