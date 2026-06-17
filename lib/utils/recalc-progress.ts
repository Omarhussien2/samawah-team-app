import { createClient } from "@/lib/supabase/client";

export async function recalcProjectProgress(projectId: string) {
  const supabase = createClient();
  let { data: tasks, error } = await supabase
    .from("tasks")
    .select("status,affects_project_progress")
    .eq("project_id", projectId);

  if (error && error.message.includes("affects_project_progress")) {
    const retry = await supabase
      .from("tasks")
      .select("status")
      .eq("project_id", projectId);
    tasks = retry.data?.map((task) => ({ ...task, affects_project_progress: true })) ?? null;
    error = retry.error;
  }

  if (error || !tasks) return;

  const progress = computeProjectProgressFromTasks(tasks);

  await supabase.from("projects").update({ progress }).eq("id", projectId);
}

// Pure helper for tests: compute project progress from a list of tasks
export function computeProjectProgressFromTasks(tasks: { status: string; affects_project_progress?: boolean | null }[]): number {
  const scopedTasks = tasks.filter((task) => task.affects_project_progress !== false);
  const total = scopedTasks.length;
  if (total === 0) return 0;
  const done = scopedTasks.filter((t) => t.status === "Done").length;
  return Math.round((done / total) * 100);
}
