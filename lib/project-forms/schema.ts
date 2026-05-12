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

const FIELD_TYPES: ProjectFormFieldType[] = [
  "text",
  "textarea",
  "date",
  "number",
  "select",
  "checkbox",
  "rating",
  "table",
  "people",
  "repeater",
];

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function normalizeKey(value: Record<string, unknown>, fallback: string) {
  return String(value.key ?? value.id ?? value.label ?? fallback);
}

function normalizeOptions(value: unknown): ProjectFormOption[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.map((option, index) => {
    const record = asRecord(option);
    const label = String(record.label ?? record.value ?? `Option ${index + 1}`);
    return { label, value: String(record.value ?? label) };
  });
}

function normalizeColumns(value: unknown): ProjectFormTableColumn[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.map((column, index) => {
    const record = asRecord(column);
    const rawType = String(record.type ?? "text");
    const type = FIELD_TYPES.includes(rawType as ProjectFormFieldType) ? rawType as ProjectFormFieldType : "text";
    return {
      key: normalizeKey(record, `column_${index + 1}`),
      label: String(record.label ?? record.key ?? record.id ?? `Column ${index + 1}`),
      type,
      options: normalizeOptions(record.options),
    };
  });
}

function normalizeFields(value: unknown): ProjectFormField[] {
  if (!Array.isArray(value)) return [];
  return value.map((field, index) => {
    const record = asRecord(field);
    const rawType = String(record.type ?? "text");
    const type = FIELD_TYPES.includes(rawType as ProjectFormFieldType) ? rawType as ProjectFormFieldType : "text";
    return {
      key: normalizeKey(record, `field_${index + 1}`),
      label: String(record.label ?? record.key ?? record.id ?? `Field ${index + 1}`),
      type,
      required: Boolean(record.required),
      prefill: record.prefill ? String(record.prefill) : undefined,
      placeholder: record.placeholder ? String(record.placeholder) : undefined,
      options: normalizeOptions(record.options),
      columns: normalizeColumns(record.columns),
    };
  });
}

export function parseFormSchema(schema: Json | null | undefined): ProjectFormSchema {
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) return { sections: [] };
  const sections = (schema as { sections?: unknown }).sections;
  if (!Array.isArray(sections)) return { sections: [] };
  return {
    sections: sections.map((section, index) => {
      const record = asRecord(section);
      return {
        key: normalizeKey(record, `section_${index + 1}`),
        title: String(record.title ?? record.key ?? record.id ?? `Section ${index + 1}`),
        description: record.description ? String(record.description) : undefined,
        fields: normalizeFields(record.fields),
      };
    }),
  };
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
