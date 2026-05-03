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
