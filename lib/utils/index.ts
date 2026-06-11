import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, formatDistanceToNow, isBefore, startOfDay } from "date-fns";
import { ar } from "date-fns/locale";
import type { ProjectType } from "@/lib/supabase/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDateAr(date: string | Date | null | undefined): string {
  if (!date) return "—";
  return format(new Date(date), "d MMMM yyyy", { locale: ar });
}

export function formatDateShort(date: string | Date | null | undefined): string {
  if (!date) return "—";
  return format(new Date(date), "dd/MM/yyyy", { locale: ar });
}

export function formatRelativeAr(date: string | Date | null | undefined): string {
  if (!date) return "—";
  return formatDistanceToNow(new Date(date), { locale: ar, addSuffix: true });
}

export function isOverdue(dueDate: string | null | undefined, status: string): boolean {
  if (!dueDate) return false;
  if (["Done", "Cancelled"].includes(status)) return false;
  return isBefore(new Date(dueDate), startOfDay(new Date()));
}

export function isDueToday(dueDate: string | null | undefined): boolean {
  if (!dueDate) return false;
  const today = startOfDay(new Date());
  const due = startOfDay(new Date(dueDate));
  return today.getTime() === due.getTime();
}

export function getStatusLabel(status: string): string {
  const map: Record<string, string> = {
    "Backlog": "متراكم",
    "To Do": "يُنتظر",
    "In Progress": "جاري العمل",
    "Review": "تحت المراجعة",
    "Done": "مخلّص",
    "Cancelled": "ملغي",
  };
  return map[status] ?? status;
}

export function getPriorityLabel(priority: string): string {
  const map: Record<string, string> = {
    low: "منخفضة",
    medium: "متوسطة",
    high: "عالية",
    critical: "حرجة",
  };
  return map[priority] ?? priority;
}

export function getProjectStatusLabel(status: string): string {
  const map: Record<string, string> = {
    active: "نشط",
    paused: "متوقف",
    completed: "مكتمل",
    cancelled: "ملغي",
  };
  return map[status] ?? status;
}

export const PROJECT_TYPE_OPTIONS: Array<{ value: ProjectType; label: string }> = [
  { value: "internal", label: "مشروع داخلي" },
  { value: "external", label: "مشروع خارجي" },
];

function normalizeProjectName(name: string | null | undefined): string {
  return (name ?? "")
    .trim()
    .replace(/[أإآ]/g, "ا")
    .replace(/[،,\-_]/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export function isValidProjectType(type: string | null | undefined): type is ProjectType {
  return type === "internal" || type === "external";
}

export function inferProjectTypeFromName(name: string | null | undefined): ProjectType {
  const normalized = normalizeProjectName(name);

  if (
    normalized.includes("خارجي") ||
    normalized.includes("اكو") ||
    normalized.includes("البنك المركزي") ||
    normalized.includes("الجفالي") ||
    normalized.includes("مبرة منى") ||
    (normalized.includes("رصد") && normalized.includes("هداية")) ||
    (normalized.includes("هاكاثون") && normalized.includes("هداية"))
  ) {
    return "external";
  }

  return "internal";
}

export function getProjectType(project: { name?: string | null; project_type?: string | null } | null | undefined): ProjectType {
  return isValidProjectType(project?.project_type) ? project.project_type : inferProjectTypeFromName(project?.name);
}

export function getProjectTypeLabel(type: string | null | undefined): string {
  const map: Record<string, string> = {
    internal: "مشروع داخلي",
    external: "مشروع خارجي",
  };
  return type ? (map[type] ?? getProjectTypeLabel(inferProjectTypeFromName(type))) : map.internal;
}

export function getProjectTypeBadgeClass(type: string | null | undefined): string {
  const map: Record<string, string> = {
    internal: "border-emerald-100 bg-emerald-50 text-emerald-700",
    external: "border-sky-100 bg-sky-50 text-sky-700",
  };
  if (isValidProjectType(type)) return map[type];
  return type ? map[inferProjectTypeFromName(type)] : map.internal;
}

export function mapProjectType(value: string | null | undefined): ProjectType {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return "internal";

  if (["internal", "داخلية", "داخلي", "مشروع داخلي"].includes(normalized)) {
    return "internal";
  }

  if (["external", "خارجية", "خارجي", "مشروع خارجي"].includes(normalized)) {
    return "external";
  }

  return "internal";
}

export function getChallengeStatusLabel(status: string): string {
  const map: Record<string, string> = {
    open: "مفتوح",
    in_progress: "جاري المعالجة",
    resolved: "تم الحل",
    closed: "مغلق",
  };
  return map[status] ?? status;
}

export function getAlertLevelColor(level: string | null): string {
  const map: Record<string, string> = {
    Low: "text-green-600 bg-green-50",
    Medium: "text-amber-600 bg-amber-50",
    High: "text-red-600 bg-red-50",
    Critical: "text-red-900 bg-red-100 font-bold",
  };
  return level ? (map[level] ?? "") : "";
}

export function getStatusColor(status: string): string {
  const map: Record<string, string> = {
    "Backlog": "bg-purple-100 text-purple-700",
    "To Do": "bg-gray-100 text-gray-600",
    "In Progress": "bg-blue-100 text-blue-700",
    "Review": "bg-amber-100 text-amber-700",
    "Done": "bg-green-100 text-green-700",
    "Cancelled": "bg-gray-100 text-gray-400",
  };
  return map[status] ?? "bg-gray-100 text-gray-600";
}

export function getPriorityColor(priority: string): string {
  const map: Record<string, string> = {
    low: "bg-blue-50 text-blue-600",
    medium: "bg-amber-50 text-amber-600",
    high: "bg-orange-50 text-orange-600",
    critical: "bg-red-50 text-red-700 font-semibold",
  };
  return map[priority] ?? "";
}

export function mapArabicStatus(arabicStatus: string): string {
  const status = arabicStatus.trim();
  if (["مخلّص", "مخلّصة", "مكتمل", "مكتملة"].includes(status)) return "Done";
  if (["جاري العمل", "جارى العمل", "قيد التنفيذ", "جارى التنفيذ"].includes(status)) return "In Progress";
  if (["لم يبدء", "لم يبدأ", "لم تبدء", "لم تبدأ"].includes(status)) return "To Do";
  if (["متأخر", "متأخرة"].includes(status)) return "In Progress";
  if (["ملغي", "ملغاة", "ملغى"].includes(status)) return "Cancelled";
  return "Backlog";
}

export function avatarFallback(name: string | null | undefined): string {
  if (!name) return "؟";
  const words = name.trim().split(" ");
  if (words.length >= 2) return words[0][0] + words[1][0];
  return name[0];
}

export function getAvatarUrl(name: string | null | undefined): string {
  const n = name ?? "مستخدم";
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(n)}&background=4f46e5&color=fff&size=128`;
}
