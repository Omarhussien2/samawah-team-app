import { getAllFields, type ProjectFormData, type ProjectFormField, type ProjectFormSchema } from "./schema";

function isFilledValue(value: unknown, field?: ProjectFormField): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "boolean") return value;
  if (Array.isArray(value)) {
    if (field?.type === "table" || field?.type === "repeater") {
      return value.some((row) => row && typeof row === "object" && Object.values(row).some((cell) => isFilledValue(cell)));
    }
    return value.length > 0;
  }
  if (typeof value === "object") return Object.values(value).some((child) => isFilledValue(child));
  return false;
}

export function calculateCompletionPercentage(schema: ProjectFormSchema, data: ProjectFormData) {
  const allFields = getAllFields(schema);
  const requiredFields = allFields.filter((field) => field.required);
  const fieldsToMeasure = requiredFields.length > 0 ? requiredFields : allFields;

  if (fieldsToMeasure.length === 0) return 0;

  const filled = fieldsToMeasure.filter((field) => isFilledValue(data[field.key], field)).length;
  return Math.round((filled / fieldsToMeasure.length) * 100);
}

export function inferFormStatus(schema: ProjectFormSchema, data: ProjectFormData, complete: boolean) {
  if (complete) return "completed" as const;
  const completion = calculateCompletionPercentage(schema, data);
  return completion > 0 ? ("draft" as const) : ("not_started" as const);
}
