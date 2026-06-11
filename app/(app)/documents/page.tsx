import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth/get-user";
import { DocumentsPageClient } from "@/components/documents/documents-page-client";
import { attachProjectTypes, attachRelationProjectTypes } from "@/lib/projects/project-type-store";

export default async function DocumentsPage() {
  const { user } = await getUser();
  const supabase = await createClient();

  const [{ data: documents }, { data: projects }] = await Promise.all([
    supabase.from("documents").select("*, creator:profiles(id,full_name), project:projects(id,name)").order("created_at", { ascending: false }),
    supabase.from("projects").select("id,name").eq("status", "active"),
  ]);

  const [documentsWithTypes, projectsWithTypes] = await Promise.all([
    attachRelationProjectTypes(documents ?? []),
    attachProjectTypes(projects ?? []),
  ]);

  return (
    <div className="page-container">
      <DocumentsPageClient documents={documentsWithTypes} projects={projectsWithTypes} currentUser={user} />
    </div>
  );
}
