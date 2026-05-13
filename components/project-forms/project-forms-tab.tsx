"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, FileText, Filter, Loader2, Plus, Search, Eye, Pencil } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { cn, formatRelativeAr } from "@/lib/utils";
import type { Profile, Project, ProjectFormTemplate } from "@/lib/supabase/types";
import { FORM_STATUS_COLORS, FORM_STATUS_LABELS, type ProjectFormStatus } from "@/lib/project-forms/schema";
import { mapInstanceToCard, type ProjectFormInstanceWithRelations, type ProjectFormTemplateWithInstance } from "@/lib/project-forms/types";
import { ProjectFormEditor } from "./project-form-editor";
import { ProjectFormPreview } from "./project-form-preview";
import { downloadFormDocx, downloadFormPdf } from "@/lib/project-forms/export";

interface Props {
  project: Project & { manager?: Pick<Profile, "id" | "full_name" | "avatar_url"> | null };
  profiles: Pick<Profile, "id" | "full_name" | "avatar_url">[];
  currentUser: Profile;
}

const BASIC_TEMPLATE_NAMES = ["ميثاق المشروع", "SLA اتفاقية مستوى الخدمة", "RACI Matrix"];
const STATUSES: Array<"all" | ProjectFormStatus> = ["all", "not_started", "draft", "completed"];
const STAGES = ["all", "بدء المشروع", "التخطيط", "التنفيذ", "الإغلاق"];
const CATEGORIES = ["all", "عام", "مصفوفة", "اتفاقية"];

function isTrainingTemplate(template: Pick<ProjectFormTemplate, "category" | "applies_to_path">) {
  return template.category === "تدريب" || template.applies_to_path === "training";
}

export function ProjectFormsTab({ project, profiles, currentUser }: Props) {
  const [templates, setTemplates] = useState<ProjectFormTemplate[]>([]);
  const [instances, setInstances] = useState<ProjectFormInstanceWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | ProjectFormStatus>("all");
  const [stageFilter, setStageFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [manualTemplateId, setManualTemplateId] = useState("");
  const [editorForm, setEditorForm] = useState<ProjectFormTemplateWithInstance | null>(null);
  const [previewForm, setPreviewForm] = useState<ProjectFormTemplateWithInstance | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);

  const isManager = project.manager_id === currentUser.id;
  const canEdit = isManager;

  const fetchForms = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const [{ data: templateRows, error: templateError }, { data: instanceRows, error: instanceError }] = await Promise.all([
      supabase.from("project_form_templates").select("*").eq("active", true).order("sort_order"),
      supabase
        .from("project_form_instances")
        .select("*, template:project_form_templates(*), assigned_owner:profiles!project_form_instances_assigned_owner_id_fkey(id,full_name,avatar_url)")
        .eq("project_id", project.id)
        .order("updated_at", { ascending: false }),
    ]);

    if (templateError) toast.error(`تعذر تحميل قوالب النماذج: ${templateError.message}`);
    if (instanceError) toast.error(`تعذر تحميل نماذج المشروع: ${instanceError.message}`);

    setTemplates(((templateRows ?? []) as ProjectFormTemplate[]).filter((template) => !isTrainingTemplate(template)));
    setInstances((instanceRows ?? []) as ProjectFormInstanceWithRelations[]);
    setLoading(false);
  }, [project.id]);

  useEffect(() => {
    fetchForms();
  }, [fetchForms]);

  const forms = useMemo(() => {
    return instances
      .filter((instance) => instance.template && !isTrainingTemplate(instance.template as ProjectFormTemplate))
      .map((instance) => mapInstanceToCard(instance.template as ProjectFormTemplate, instance));
  }, [instances]);

  const filteredForms = useMemo(() => {
    return forms.filter((form) => {
      if (statusFilter !== "all" && form.status !== statusFilter) return false;
      if (stageFilter !== "all" && form.template.stage !== stageFilter) return false;
      if (categoryFilter !== "all" && form.template.category !== categoryFilter) return false;
      if (search && !form.template.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [forms, statusFilter, stageFilter, categoryFilter, search]);

  const summary = useMemo(() => {
    const total = forms.length;
    const completed = forms.filter((form) => form.status === "completed").length;
    const drafts = forms.filter((form) => form.status === "draft").length;
    const average = total ? Math.round(forms.reduce((sum, form) => sum + form.completion, 0) / total) : 0;
    return { total, completed, drafts, average };
  }, [forms]);

  const createInstances = async (templateNames: string[]) => {
    if (!canEdit) {
      toast.error("تعبئة نماذج المشروع متاحة لمدير المشروع فقط");
      return;
    }

    const selectedTemplates = templates.filter((template) => templateNames.includes(template.name));
    if (selectedTemplates.length === 0) {
      toast.error("لم يتم العثور على القوالب المطلوبة. تأكد من تشغيل seed.sql");
      return;
    }

    setSaving(true);
    const supabase = createClient();
    const payload = selectedTemplates.map((template) => ({
      project_id: project.id,
      template_id: template.id,
      assigned_owner_id: project.manager_id ?? currentUser.id,
      created_by: currentUser.id,
      updated_by: currentUser.id,
    }));

    const { error } = await supabase.from("project_form_instances").upsert(payload, { onConflict: "project_id,template_id" });
    if (error) toast.error(`ما نجحت إضافة النماذج: ${error.message}`);
    else {
      toast.success("تمت إضافة النماذج");
      fetchForms();
    }
    setSaving(false);
  };

  const createManualInstance = async () => {
    const template = templates.find((item) => item.id === manualTemplateId);
    if (!template) {
      toast.error("اختر نموذجًا أولًا");
      return;
    }
    await createInstances([template.name]);
    setManualTemplateId("");
  };

  const handleExport = async (form: ProjectFormTemplateWithInstance, format: "pdf" | "docx") => {
    const data = form.instance?.data_json && typeof form.instance.data_json === "object" && !Array.isArray(form.instance.data_json)
      ? form.instance.data_json as Record<string, unknown>
      : {};
    const exportKey = `${form.id}-${format}`;
    setExporting(exportKey);

    try {
      if (format === "pdf") await downloadFormPdf({ project, form, data, profiles });
      else await downloadFormDocx({ project, form, data, profiles });
      toast.success(format === "pdf" ? "تم تحميل ملف PDF" : "تم تحميل ملف Word");
    } catch (error) {
      toast.error(`تعذر تصدير النموذج: ${error instanceof Error ? error.message : "خطأ غير معروف"}`);
    } finally {
      setExporting(null);
    }
  };
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-xl font-black text-slate-900">نماذج المشروع</h2>
            <p className="mt-1 text-sm text-slate-500">إدارة وتعبئة النماذج المرتبطة بهذا المشروع</p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                <div>
                  <p className="text-[11px] font-bold text-slate-400">صلاحية التعبئة</p>
                  <p className="text-sm font-bold text-slate-700">{project.manager?.full_name ?? "مدير المشروع"}</p>
                </div>
              </div>
              {!canEdit && <span className="text-xs font-bold text-amber-600">يمكنك العرض فقط. التعبئة متاحة لمدير المشروع.</span>}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => createInstances(BASIC_TEMPLATE_NAMES)} disabled={saving || !canEdit} className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-60">
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Plus size={16} />}
              إضافة النماذج الأساسية
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        {[
          ["إجمالي النماذج", summary.total],
          ["نماذج مكتملة", summary.completed],
          ["نماذج قيد التعبئة", summary.drafts],
          ["متوسط نسبة الإكمال", `${summary.average}%`],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-bold text-slate-400">{label}</p>
            <p className="mt-2 text-2xl font-black text-slate-900">{value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[1fr_160px_160px_160px_240px]">
          <div className="relative">
            <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث باسم النموذج" className="w-full rounded-lg border border-slate-200 py-2 pl-3 pr-9 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as "all" | ProjectFormStatus)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
            {STATUSES.map((status) => <option key={status} value={status}>{status === "all" ? "كل الحالات" : FORM_STATUS_LABELS[status]}</option>)}
          </select>
          <select value={stageFilter} onChange={(e) => setStageFilter(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
            {STAGES.map((stage) => <option key={stage} value={stage}>{stage === "all" ? "كل المراحل" : stage}</option>)}
          </select>
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
            {CATEGORIES.map((category) => <option key={category} value={category}>{category === "all" ? "كل الأنواع" : category}</option>)}
          </select>
          <div className="flex gap-2">
            <select value={manualTemplateId} onChange={(e) => setManualTemplateId(e.target.value)} className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
              <option value="">إضافة نموذج</option>
              {templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
            </select>
            <button onClick={createManualInstance} disabled={!manualTemplateId || !canEdit} className="rounded-lg bg-slate-900 px-3 py-2 text-white disabled:opacity-50" title="إضافة">
              <Filter size={15} />
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center rounded-2xl border border-slate-200 bg-white py-16 text-slate-400">
          <Loader2 className="animate-spin" />
        </div>
      ) : forms.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center">
          <FileText className="mx-auto mb-4 text-slate-300" size={42} />
          <h3 className="font-black text-slate-800">لم تتم إضافة نماذج لهذا المشروع بعد</h3>
          <p className="mt-1 text-sm text-slate-500">ابدأ بالنماذج الأساسية أو اختر نموذجًا محددًا من القائمة.</p>
          <button onClick={() => createInstances(BASIC_TEMPLATE_NAMES)} disabled={!canEdit} className="mt-5 rounded-lg bg-indigo-600 px-5 py-2 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-60">
            إضافة النماذج الأساسية
          </button>
        </div>
      ) : filteredForms.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white py-12 text-center text-slate-500">لا توجد نماذج مطابقة للفلاتر</div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {filteredForms.map((form) => (
            <div key={form.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-indigo-200 hover:shadow-md">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-black text-slate-900">{form.template.name}</h3>
                  <p className="mt-1 text-xs text-slate-500">{form.template.category} - {form.template.stage}</p>
                </div>
                <span className={cn("rounded-full border px-2.5 py-1 text-xs font-bold", FORM_STATUS_COLORS[form.status])}>{form.statusLabel}</span>
              </div>
              <div className="mb-4">
                <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
                  <span>نسبة الإكمال</span>
                  <span>{form.completion}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-indigo-600" style={{ width: `${form.completion}%` }} />
                </div>
              </div>
              <div className="mb-4 grid gap-2 text-xs text-slate-500 sm:grid-cols-2">
                <span>مدير المشروع: {project.manager?.full_name ?? "-"}</span>
                <span>آخر تحديث: {form.updatedAt ? formatRelativeAr(form.updatedAt) : "-"}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setEditorForm(form)} className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-700">
                  <Pencil size={14} />
                  {canEdit ? "فتح / تعديل" : "فتح"}
                </button>
                <button onClick={() => setPreviewForm(form)} className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50">
                  <Eye size={14} />
                  معاينة
                </button>
                <button onClick={() => handleExport(form, "pdf")} disabled={exporting === `${form.id}-pdf`} className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-60">
                  {exporting === `${form.id}-pdf` ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                  PDF
                </button>
                <button onClick={() => handleExport(form, "docx")} disabled={exporting === `${form.id}-docx`} className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-60">
                  {exporting === `${form.id}-docx` ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                  Word
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ProjectFormEditor
        open={!!editorForm}
        project={project}
        form={editorForm}
        profiles={profiles}
        currentUser={currentUser}
        canEdit={canEdit}
        onClose={() => setEditorForm(null)}
        onSaved={fetchForms}
      />
      <ProjectFormPreview
        project={project}
        form={previewForm as ProjectFormTemplateWithInstance}
        data={(previewForm?.instance?.data_json && typeof previewForm.instance.data_json === "object" && !Array.isArray(previewForm.instance.data_json) ? previewForm.instance.data_json : {}) as Record<string, unknown>}
        profiles={profiles}
        open={!!previewForm}
        onClose={() => setPreviewForm(null)}
      />
    </div>
  );
}
