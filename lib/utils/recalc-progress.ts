import { createClient } from "@/lib/supabase/client";

export async function recalcProjectProgress(projectId: string) {
  const supabase = createClient();
  const { data: tasks } = await supabase
    .from("tasks")
    .select("status")
    .eq("project_id", projectId);

  if (!tasks || tasks.length === 0) return;

  const total = tasks.length;
  const done = tasks.filter((t) => t.status === "Done").length;
  const progress = Math.round((done / total) * 100);

  await supabase.from("projects").update({ progress }).eq("id", projectId);
}

// Pure helper for tests: compute project progress from a list of tasks
export function computeProjectProgressFromTasks(tasks: { status: string }[]): number {
  const total = tasks.length;
  if (total === 0) return 0;
  const done = tasks.filter((t) => t.status === "Done").length;
  return Math.round((done / total) * 100);
}
