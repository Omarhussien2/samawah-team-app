import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth/get-user";
import { MyTasksClient } from "@/components/tasks/my-tasks-client";

export default async function MyTasksPage() {
  const { user } = await getUser();
  const supabase = await createClient();

  const { data: tasks } = await supabase
    .from("tasks")
    .select("*, project:projects(id,name,project_type), owner:profiles(id,full_name,avatar_url)")
    .eq("owner_id", user.id)
    .order("due_date", { ascending: true, nullsFirst: false });

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id,full_name,avatar_url")
    .eq("active", true);

  return (
    <div className="page-container">
      <MyTasksClient tasks={tasks ?? []} currentUser={user} profiles={profiles ?? []} />
    </div>
  );
}
