"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ClipboardList, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import {
  DEFAULT_RECOMMENDATION_PRIORITY,
  isRecommendationTask,
  splitRecommendationBullets,
} from "@/lib/recommendations/tasks";
import { taskKeys, type TaskWithRelations } from "@/lib/queries/tasks";
import { cn, formatDateShort, formatRelativeAr, getPriorityColor, getPriorityLabel, getStatusColor, getStatusLabel } from "@/lib/utils";
import type { Profile, Project, Task } from "@/lib/supabase/types";

type RecommendationTask = TaskWithRelations;

interface Props {
  project: Project;
  tasks: TaskWithRelations[];
  profiles: Pick<Profile, "id" | "full_name" | "avatar_url">[];
  currentUser: Profile;
}

type RecommendationDraft = {
  text: string;
  status: Task["status"];
  owner_id: string;
  due_date: string;
  priority: Task["priority"];
  source_meeting_title: string;
  source_meeting_date: string;
  affects_project_progress: boolean;
};

const emptyDraft: RecommendationDraft = {
  text: "",
  status: "To Do",
  owner_id: "",
  due_date: "",
  priority: DEFAULT_RECOMMENDATION_PRIORITY,
  source_meeting_title: "",
  source_meeting_date: "",
  affects_project_progress: true,
};

export function ProjectRecommendationsTab({ project, tasks, profiles, currentUser }: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<RecommendationTask | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [draft, setDraft] = useState<RecommendationDraft>(emptyDraft);
  const [bulkText, setBulkText] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [statusSavingId, setStatusSavingId] = useState<string | null>(null);

  const initialRecommendations = useMemo(
    () => tasks.filter((task) => isRecommendationTask(task)),
    [tasks]
  );
  const localCanManage = currentUser.role === "admin" || project.manager_id === currentUser.id || project.forms_owner_id === currentUser.id;

  const { data = { recommendations: initialRecommendations, canManage: localCanManage }, refetch } = useQuery({
    queryKey: ["project-recommendations", project.id],
    queryFn: async () => {
      const response = await fetch(`/api/projects/${project.id}/recommendations`, { cache: "no-store" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? "تعذر تحميل التوصيات");
      return {
        recommendations: (result.recommendations ?? []) as RecommendationTask[],
        canManage: Boolean(result.canManage),
      };
    },
    initialData: { recommendations: initialRecommendations, canManage: localCanManage },
  });

  const recommendations = data.recommendations;
  const canManage = data.canManage;
  const today = new Date().toISOString().slice(0, 10);
  const summary = useMemo(() => {
    const open = recommendations.filter((task) => !["Done", "Cancelled"].includes(task.status)).length;
    const completed = recommendations.filter((task) => task.status === "Done").length;
    const overdue = recommendations.filter((task) => task.due_date && task.due_date < today && !["Done", "Cancelled"].includes(task.status)).length;
    const affecting = recommendations.filter((task) => task.affects_project_progress !== false).length;
    return { total: recommendations.length, open, completed, overdue, affecting };
  }, [recommendations, today]);

  const bulkRecommendations = useMemo(() => splitRecommendationBullets(bulkText), [bulkText]);

  const openCreateForm = () => {
    setEditing(null);
    setDraft(emptyDraft);
    setFormOpen(true);
  };

  const openEditForm = (recommendation: RecommendationTask) => {
    setEditing(recommendation);
    setDraft({
      text: recommendation.title,
      status: recommendation.status,
      owner_id: recommendation.owner_id ?? "",
      due_date: recommendation.due_date ?? "",
      priority: recommendation.priority,
      source_meeting_title: recommendation.source_meeting_title ?? "",
      source_meeting_date: recommendation.source_meeting_date ?? "",
      affects_project_progress: recommendation.affects_project_progress !== false,
    });
    setFormOpen(true);
  };

  const refreshAfterMutation = async () => {
    await Promise.all([
      refetch(),
      queryClient.invalidateQueries({ queryKey: taskKeys.byProject(project.id) }),
      queryClient.invalidateQueries({ queryKey: taskKeys.all }),
    ]);
    router.refresh();
  };

  const saveRecommendation = async () => {
    if (!draft.text.trim()) {
      toast.error("نص التوصية مطلوب");
      return;
    }

    setSaving(true);
    const payload = {
      text: draft.text.trim(),
      status: draft.status,
      owner_id: draft.owner_id || null,
      due_date: draft.due_date || null,
      priority: draft.priority,
      source_meeting_title: draft.source_meeting_title || null,
      source_meeting_date: draft.source_meeting_date || null,
      affects_project_progress: draft.affects_project_progress,
    };
    const url = editing
      ? `/api/projects/${project.id}/recommendations/${editing.id}`
      : `/api/projects/${project.id}/recommendations`;
    const response = await fetch(url, {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      toast.error(result.error ?? "تعذر حفظ التوصية");
      setSaving(false);
      return;
    }

    toast.success(editing ? "تم تحديث التوصية" : result.skippedDuplicates ? "التوصية موجودة مسبقًا" : "تمت إضافة التوصية");
    setFormOpen(false);
    setEditing(null);
    setDraft(emptyDraft);
    await refreshAfterMutation();
    setSaving(false);
  };

  const createBulkRecommendations = async () => {
    if (bulkRecommendations.length === 0) {
      toast.error("ألصق توصية واحدة على الأقل");
      return;
    }

    setSaving(true);
    const response = await fetch(`/api/projects/${project.id}/recommendations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source_meeting_title: draft.source_meeting_title || null,
        source_meeting_date: draft.source_meeting_date || null,
        recommendations: bulkRecommendations.map((text) => ({
          text,
          owner_id: draft.owner_id || null,
          due_date: draft.due_date || null,
          priority: draft.priority,
          affects_project_progress: draft.affects_project_progress,
        })),
      }),
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      toast.error(result.error ?? "تعذر إضافة التوصيات");
      setSaving(false);
      return;
    }

    toast.success(`تمت إضافة ${result.recommendations?.length ?? 0} توصية${result.skippedDuplicates ? ` وتجاوز ${result.skippedDuplicates} مكررة` : ""}`);
    setBulkText("");
    setBulkOpen(false);
    setDraft(emptyDraft);
    await refreshAfterMutation();
    setSaving(false);
  };

  const updateStatus = async (recommendation: RecommendationTask, status: Task["status"]) => {
    if (recommendation.status === status) return;
    setStatusSavingId(recommendation.id);
    const response = await fetch(`/api/projects/${project.id}/recommendations/${recommendation.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      toast.error(result.error ?? "تعذر تحديث حالة التوصية");
    } else {
      toast.success(status === "Done" ? "تم تحديد التوصية كمكتملة" : "تم تحديث الحالة");
      await refreshAfterMutation();
    }
    setStatusSavingId(null);
  };

  const deleteRecommendation = async (recommendation: RecommendationTask) => {
    if (!window.confirm(`هل تريد حذف التوصية "${recommendation.title}"؟`)) return;
    setDeletingId(recommendation.id);
    const response = await fetch(`/api/projects/${project.id}/recommendations/${recommendation.id}`, { method: "DELETE" });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      toast.error(result.error ?? "تعذر حذف التوصية");
    } else {
      toast.success("تم حذف التوصية");
      await refreshAfterMutation();
    }
    setDeletingId(null);
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-xl font-black text-slate-900">التوصيات</h2>
            <p className="mt-1 text-sm text-slate-500">متابعة التوصيات الصادرة من اجتماعات الإدارة كمهمات تنفيذية داخل المشروع</p>
            {!canManage && <p className="mt-3 text-xs font-bold text-amber-600">يمكنك تحديث حالة التوصيات المسندة لك فقط.</p>}
          </div>
          {canManage && (
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setBulkOpen((open) => !open)} className="flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">
                <ClipboardList size={16} />
                لصق جماعي
              </button>
              <button onClick={openCreateForm} className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700">
                <Plus size={16} />
                توصية جديدة
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-5">
        <SummaryCard label="إجمالي التوصيات" value={summary.total} />
        <SummaryCard label="مفتوحة" value={summary.open} />
        <SummaryCard label="متأخرة" value={summary.overdue} tone={summary.overdue > 0 ? "danger" : "default"} />
        <SummaryCard label="مكتملة" value={summary.completed} tone="success" />
        <SummaryCard label="تؤثر على الإنجاز" value={summary.affecting} />
      </div>

      {bulkOpen && canManage && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="اسم الاجتماع">
              <input value={draft.source_meeting_title} onChange={(event) => setDraft({ ...draft, source_meeting_title: event.target.value })} className={fieldClass} placeholder="مثال: اجتماع إدارة المشاريع الأسبوعي" />
            </Field>
            <Field label="تاريخ الاجتماع">
              <input type="date" value={draft.source_meeting_date} onChange={(event) => setDraft({ ...draft, source_meeting_date: event.target.value })} className={fieldClass} />
            </Field>
            <Field label="المسؤول الافتراضي">
              <select value={draft.owner_id} onChange={(event) => setDraft({ ...draft, owner_id: event.target.value })} className={fieldClass}>
                <option value="">غير مخصص</option>
                {profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.full_name}</option>)}
              </select>
            </Field>
            <Field label="تاريخ الاستحقاق الافتراضي">
              <input type="date" value={draft.due_date} onChange={(event) => setDraft({ ...draft, due_date: event.target.value })} className={fieldClass} />
            </Field>
          </div>
          <div className="mt-3">
            <Field label="التوصيات">
              <textarea value={bulkText} onChange={(event) => setBulkText(event.target.value)} rows={6} className={fieldClass} placeholder="ألصق التوصيات هنا، وكل سطر أو bullet سيصبح مهمة مستقلة" />
            </Field>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
              <input type="checkbox" checked={draft.affects_project_progress} onChange={(event) => setDraft({ ...draft, affects_project_progress: event.target.checked })} className="accent-indigo-600" />
              تؤثر على نسبة إنجاز المشروع
            </label>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500">{bulkRecommendations.length} توصية جاهزة</span>
              <button onClick={() => setBulkOpen(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50">إلغاء</button>
              <button onClick={createBulkRecommendations} disabled={saving || bulkRecommendations.length === 0} className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-60">
                {saving && <Loader2 size={15} className="animate-spin" />}
                إضافة الدفعة
              </button>
            </div>
          </div>
        </div>
      )}

      {recommendations.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center">
          <ClipboardList className="mx-auto mb-4 text-slate-300" size={42} />
          <h3 className="font-black text-slate-800">لا توجد توصيات لهذا المشروع بعد</h3>
          {canManage && <p className="mt-1 text-sm text-slate-500">أضف توصية فردية أو الصق توصيات الاجتماع دفعة واحدة.</p>}
        </div>
      ) : (
        <div className="space-y-3">
          {recommendations.map((recommendation) => {
            const canUpdateStatus = canManage || recommendation.owner_id === currentUser.id;
            const isDone = recommendation.status === "Done";
            return (
              <div key={recommendation.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className={cn("rounded-full px-2.5 py-1 text-xs font-bold", getStatusColor(recommendation.status))}>{getStatusLabel(recommendation.status)}</span>
                      <span className={cn("rounded-full px-2.5 py-1 text-xs font-bold", getPriorityColor(recommendation.priority))}>{getPriorityLabel(recommendation.priority)}</span>
                      <span className={cn("rounded-full border px-2.5 py-1 text-xs font-bold", recommendation.affects_project_progress !== false ? "border-indigo-100 bg-indigo-50 text-indigo-700" : "border-slate-200 bg-slate-50 text-slate-500")}>
                        {recommendation.affects_project_progress !== false ? "تؤثر على الإنجاز" : "لا تؤثر على الإنجاز"}
                      </span>
                    </div>
                    <h3 className="text-base font-black leading-7 text-slate-900">{recommendation.title}</h3>
                    <div className="mt-3 flex flex-wrap gap-3 text-xs font-semibold text-slate-500">
                      <span>المسؤول: {recommendation.owner?.full_name ?? recommendation.owner_name ?? "غير مخصص"}</span>
                      <span>الاستحقاق: {formatDateShort(recommendation.due_date)}</span>
                      <span>آخر تحديث: {formatRelativeAr(recommendation.updated_at ?? recommendation.created_at)}</span>
                      {recommendation.source_meeting_title && <span>المصدر: {recommendation.source_meeting_title}</span>}
                      {recommendation.source_meeting_date && <span>تاريخ الاجتماع: {formatDateShort(recommendation.source_meeting_date)}</span>}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {canUpdateStatus && !isDone && (
                      <button onClick={() => updateStatus(recommendation, "Done")} disabled={statusSavingId === recommendation.id} className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-60">
                        {statusSavingId === recommendation.id ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                        مكتملة
                      </button>
                    )}
                    {canUpdateStatus && (
                      <select value={recommendation.status} onChange={(event) => updateStatus(recommendation, event.target.value as Task["status"])} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700">
                        <option value="Backlog">الأعمال المتراكمة</option>
                        <option value="To Do">قيد الانتظار</option>
                        <option value="In Progress">قيد التنفيذ</option>
                        <option value="Review">تحت المراجعة</option>
                        <option value="Done">مكتملة</option>
                        <option value="Cancelled">ملغاة</option>
                      </select>
                    )}
                    {canManage && (
                      <>
                        <button onClick={() => openEditForm(recommendation)} className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50" title="تعديل">
                          <Pencil size={16} />
                        </button>
                        <button onClick={() => deleteRecommendation(recommendation)} disabled={deletingId === recommendation.id} className="rounded-lg border border-red-100 p-2 text-red-600 hover:bg-red-50 disabled:opacity-60" title="حذف">
                          {deletingId === recommendation.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {formOpen && (
        <RecommendationFormModal
          draft={draft}
          editing={editing}
          profiles={profiles}
          saving={saving}
          onChange={(patch) => setDraft((current) => ({ ...current, ...patch }))}
          onClose={() => {
            setFormOpen(false);
            setEditing(null);
            setDraft(emptyDraft);
          }}
          onSave={saveRecommendation}
        />
      )}
    </div>
  );
}

function RecommendationFormModal({
  draft,
  editing,
  profiles,
  saving,
  onChange,
  onClose,
  onSave,
}: {
  draft: RecommendationDraft;
  editing: RecommendationTask | null;
  profiles: Pick<Profile, "id" | "full_name" | "avatar_url">[];
  saving: boolean;
  onChange: (patch: Partial<RecommendationDraft>) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-black text-slate-900">{editing ? "تعديل التوصية" : "توصية جديدة"}</h2>
          <button onClick={onClose} className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50" title="إغلاق">
            <X size={18} />
          </button>
        </div>
        <div className="max-h-[70vh] space-y-4 overflow-y-auto p-5">
          <Field label="نص التوصية *">
            <textarea value={draft.text} onChange={(event) => onChange({ text: event.target.value })} rows={4} className={fieldClass} placeholder="اكتب التوصية الصادرة من الاجتماع" autoFocus />
          </Field>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="الحالة">
              <select value={draft.status} onChange={(event) => onChange({ status: event.target.value as Task["status"] })} className={fieldClass}>
                <option value="Backlog">الأعمال المتراكمة</option>
                <option value="To Do">قيد الانتظار</option>
                <option value="In Progress">قيد التنفيذ</option>
                <option value="Review">تحت المراجعة</option>
                <option value="Done">مكتملة</option>
                <option value="Cancelled">ملغاة</option>
              </select>
            </Field>
            <Field label="الأولوية">
              <select value={draft.priority} onChange={(event) => onChange({ priority: event.target.value as Task["priority"] })} className={fieldClass}>
                <option value="critical">حرجة</option>
                <option value="high">عالية</option>
                <option value="medium">متوسطة</option>
                <option value="low">منخفضة</option>
              </select>
            </Field>
            <Field label="المسؤول">
              <select value={draft.owner_id} onChange={(event) => onChange({ owner_id: event.target.value })} className={fieldClass}>
                <option value="">غير مخصص</option>
                {profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.full_name}</option>)}
              </select>
            </Field>
            <Field label="تاريخ الاستحقاق">
              <input type="date" value={draft.due_date} onChange={(event) => onChange({ due_date: event.target.value })} className={fieldClass} />
            </Field>
            <Field label="اسم الاجتماع">
              <input value={draft.source_meeting_title} onChange={(event) => onChange({ source_meeting_title: event.target.value })} className={fieldClass} placeholder="مصدر التوصية" />
            </Field>
            <Field label="تاريخ الاجتماع">
              <input type="date" value={draft.source_meeting_date} onChange={(event) => onChange({ source_meeting_date: event.target.value })} className={fieldClass} />
            </Field>
          </div>
          <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700">
            <input type="checkbox" checked={draft.affects_project_progress} onChange={(event) => onChange({ affects_project_progress: event.target.checked })} className="accent-indigo-600" />
            تؤثر على نسبة إنجاز المشروع
          </label>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
          <button onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50">إلغاء</button>
          <button onClick={onSave} disabled={saving} className="flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-60">
            {saving && <Loader2 size={15} className="animate-spin" />}
            حفظ
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold text-slate-500">{label}</span>
      {children}
    </label>
  );
}

function SummaryCard({ label, value, tone = "default" }: { label: string; value: number; tone?: "default" | "danger" | "success" }) {
  return (
    <div className={cn("rounded-2xl border bg-white p-4 shadow-sm", tone === "danger" ? "border-red-100" : tone === "success" ? "border-emerald-100" : "border-slate-200")}>
      <p className="text-xs font-bold text-slate-400">{label}</p>
      <p className={cn("mt-2 text-2xl font-black", tone === "danger" ? "text-red-600" : tone === "success" ? "text-emerald-600" : "text-slate-900")}>{value}</p>
    </div>
  );
}

const fieldClass = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100";
