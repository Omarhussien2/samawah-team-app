export const DOCUMENT_TYPES = ["تقرير", "عقد", "خطة", "تصميم", "مرجع", "أخرى"] as const;

export const DOCUMENT_STAGES = [
  "بدء المشروع",
  "التخطيط",
  "التنفيذ",
  "التسويق",
  "الإغلاق",
] as const;

export const DOCUMENT_BUCKET = "documents";

export function formatFileSize(size: number | null | undefined) {
  if (!size || size <= 0) return "غير محدد";
  const units = ["بايت", "KB", "MB", "GB"];
  let value = size;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const displayValue = Number.isInteger(value) || value >= 10 || unitIndex === 0
    ? value.toFixed(0)
    : value.toFixed(1);

  return `${displayValue} ${units[unitIndex]}`;
}

export function buildDocumentStoragePath(projectId: string, fileName: string) {
  const rawExtension = fileName.includes(".") ? fileName.split(".").pop() : "";
  const extension = (rawExtension ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 12) || "file";

  return `projects/${projectId}/${crypto.randomUUID()}-document.${extension}`;
}
