import type { Profile } from "@/lib/supabase/types";

type ProjectEditorReference = {
  manager_id: string | null;
};

export function canEditProject(user: Pick<Profile, "id" | "role">, project: ProjectEditorReference) {
  return user.role === "admin" || user.role === "project_manager" || project.manager_id === user.id;
}
