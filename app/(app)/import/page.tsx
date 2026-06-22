import { getUser } from "@/lib/auth/get-user";
import { ImportClient } from "@/components/import/import-client";
import { createClient } from "@/lib/supabase/server";

export default async function ImportPage() {
  const { user } = await getUser();
  const supabase = await createClient();
  const { data: projects } = await supabase
    .from("projects")
    .select("id,name,legacy_project_id,manager_name,status")
    .order("name");

  return (
    <div className="page-container">
      <ImportClient currentUser={user} projects={projects ?? []} />
    </div>
  );
}
