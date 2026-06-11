import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth/get-user";
import { MyTasksClient } from "@/components/tasks/my-tasks-client";
import { attachRelationProjectTypes } from "@/lib/projects/project-type-store";

export default async function MyTasksPage() {
  const { user } = await getUser();
  const supabase = await createClient();

  const { data: tasks } = await supabase
    .from("tasks")
    .select("*, project:projects(id,name), owner:profiles(id,full_name,avatar_url)")
    .eq("owner_id", user.id)
    .order("due_date", { ascending: true, nullsFirst: false });

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id,full_name,avatar_url")
    .eq("active", true);

  const tasksWithTypes = await attachRelationProjectTypes(tasks ?? []);

  return (
    <div className="page-container">
      <MyTasksClient tasks={tasksWithTypes} currentUser={user} profiles={profiles ?? []} />
    </div>
  );
}
