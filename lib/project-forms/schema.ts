import type { Json } from "@/lib/supabase/types";

export type ProjectFormStatus = "not_started" | "draft" | "completed";
export type ProjectFormFieldType =
  | "text"
  | "textarea"
  | "date"
  | "number"
  | "select"
  | "checkbox"
  | "rating"
  | "table"
  | "people"
  | "repeater";

export interface ProjectFormOption {
  label: string;
  value: string;
}

export interface ProjectFormTableColumn {
  key: string;
  label: string;
  type?: ProjectFormFieldType;
  options?: ProjectFormOption[];
}

export interface ProjectFormField {
  key: string;
  label: string;
  type: ProjectFormFieldType;
  required?: boolean;
  prefill?: string;
  placeholder?: string;
  options?: ProjectFormOption[];
  columns?: ProjectFormTableColumn[];
}

export interface ProjectFormSection {
  key: string;
  title: string;
  description?: string;
  fields: ProjectFormField[];
}

export interface ProjectFormSchema {
  sections: ProjectFormSection[];
}

export type ProjectFormData = Record<string, unknown>;

export function parseFormSchema(schema: Json | null | undefined): ProjectFormSchema {
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) return { sections: [] };
  const sections = (schema as { sections?: unknown }).sections;
  if (!Array.isArray(sections)) return { sections: [] };
  return { sections: sections as ProjectFormSection[] };
}

export function getAllFields(schema: ProjectFormSchema) {
  return schema.sections.flatMap((section) => section.fields);
}

export const FORM_STATUS_LABELS: Record<ProjectFormStatus, string> = {
  not_started: "لم يبدأ",
  draft: "مسودة",
  completed: "مكتمل",
};

export const FORM_STATUS_COLORS: Record<ProjectFormStatus, string> = {
  not_started: "bg-slate-100 text-slate-600 border-slate-200",
  draft: "bg-amber-50 text-amber-700 border-amber-100",
  completed: "bg-emerald-50 text-emerald-700 border-emerald-100",
};
