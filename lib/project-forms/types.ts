import type { Profile, ProjectFormInstance, ProjectFormTemplate, ProjectFormShare } from "@/lib/supabase/types";
import { FORM_STATUS_LABELS, type ProjectFormStatus } from "./schema";

export type ProjectFormInstanceWithRelations = ProjectFormInstance & {
  template?: ProjectFormTemplate | null;
  assigned_owner?: Pick<Profile, "id" | "full_name" | "avatar_url"> | null;
};

export type ProjectFormShareWithUser = ProjectFormShare & {
  shared_with?: Pick<Profile, "id" | "full_name" | "avatar_url"> | null;
};

export interface ProjectFormTemplateWithInstance {
  id: string;
  template: ProjectFormTemplate;
  instance: ProjectFormInstance | null;
  owner: Pick<Profile, "id" | "full_name" | "avatar_url"> | null;
  status: ProjectFormStatus;
  statusLabel: string;
  completion: number;
  updatedAt: string | null;
}

export function mapInstanceToCard(
  template: ProjectFormTemplate,
  instance?: ProjectFormInstanceWithRelations | null
): ProjectFormTemplateWithInstance {
  const status = (instance?.status ?? "not_started") as ProjectFormStatus;
  return {
    id: instance?.id ?? template.id,
    template,
    instance: instance ?? null,
    owner: instance?.assigned_owner ?? null,
    status,
    statusLabel: FORM_STATUS_LABELS[status],
    completion: Math.round(instance?.completion_percentage ?? 0),
    updatedAt: instance?.updated_at ?? null,
  };
}
