import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth/get-user";
import { DocumentsPageClient } from "@/components/documents/documents-page-client";

export default async function DocumentsPage() {
  const { user } = await getUser();
  const supabase = await createClient();

  const [{ data: documents }, { data: projects }] = await Promise.all([
    supabase.from("documents").select("*, creator:profiles(id,full_name), project:projects(id,name,project_type)").order("created_at", { ascending: false }),
    supabase.from("projects").select("id,name,project_type").eq("status", "active"),
  ]);

  return (
    <div className="page-container">
      <DocumentsPageClient documents={documents ?? []} projects={projects ?? []} currentUser={user} />
    </div>
  );
}
