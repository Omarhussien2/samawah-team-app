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
  const extension = fileName.includes(".") ? fileName.split(".").pop() : "file";
  const safeName = fileName
    .replace(/\.[^/.]+$/, "")
    .replace(/[^\p{L}\p{N}-]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  return `projects/${projectId}/${crypto.randomUUID()}-${safeName || "document"}.${extension}`;
}
