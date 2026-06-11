import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth/get-user";
import { KanbanBoard } from "@/components/board/kanban-board";

export default async function BoardPage() {
  await getUser();
  const supabase = await createClient();

  const [{ data: tasks }, { data: profiles }] = await Promise.all([
    supabase.from("tasks").select("*, owner:profiles(id,full_name,avatar_url), project:projects(id,name,project_type)").order("sort_order"),
    supabase.from("profiles").select("id,full_name,avatar_url").eq("active", true),
  ]);

  return (
    <div className="page-container">
      <div className="section-header">
        <h1 className="text-2xl font-bold text-foreground">لوحة المهام</h1>
        <p className="text-muted-foreground text-sm">{tasks?.length ?? 0} مهمة</p>
      </div>
      <KanbanBoard tasks={tasks ?? []} projectId="" profiles={profiles ?? []} />
    </div>
  );
}
