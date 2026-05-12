"use client";

import { useMemo, useState } from "react";
import { Loader2, X, Eye, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { Json, Profile, Project } from "@/lib/supabase/types";
import { calculateCompletionPercentage, inferFormStatus } from "@/lib/project-forms/completion";
import { parseFormSchema, type ProjectFormData } from "@/lib/project-forms/schema";
import type { ProjectFormTemplateWithInstance } from "@/lib/project-forms/types";
import { DynamicFormRenderer } from "./dynamic-form-renderer";
import { ProjectFormPreview } from "./project-form-preview";

interface Props {
  open: boolean;
  project: Project;
  form: ProjectFormTemplateWithInstance | null;
  profiles: Pick<Profile, "id" | "full_name" | "avatar_url">[];
  currentUser: Profile;
  canEdit: boolean;
  onClose: () => void;
  onSaved: () => void;
}

function getPrefillValue(prefill: string | undefined, project: Project) {
  if (!prefill) return undefined;
  const map: Record<string, unknown> = {
    "project.name": project.name,
    "project.start_date": project.start_date,
    "project.end_date": project.end_date,
    "project.total_budget": project.total_budget,
    "project.manager_name": project.manager_name,
    "project.current_stage": project.current_stage,
  };
  return map[prefill];
}

function withPrefills(form: ProjectFormTemplateWithInstance, project: Project): ProjectFormData {
  const schema = parseFormSchema(form.template.schema_json);
  const existing = (form.instance?.data_json && typeof form.instance.data_json === "object" && !Array.isArray(form.instance.data_json))
    ? form.instance.data_json as ProjectFormData
    : {};
  const next: ProjectFormData = { ...existing };

  for (const section of schema.sections) {
    for (const field of section.fields) {
      if (next[field.key] !== undefined && next[field.key] !== null && next[field.key] !== "") continue;
      const prefill = getPrefillValue(field.prefill, project);
      if (prefill !== undefined && prefill !== null) next[field.key] = prefill;
    }
  }

  return next;
}

export function ProjectFormEditor({ open, project, form, profiles, currentUser, canEdit, onClose, onSaved }: Props) {
  const [saving, setSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [data, setData] = useState<ProjectFormData>(() => form ? withPrefills(form, project) : {});

  const schema = useMemo(() => form ? parseFormSchema(form.template.schema_json) : { sections: [] }, [form]);
  const completion = useMemo(() => calculateCompletionPercentage(schema, data), [schema, data]);

  if (!open || !form) return null;

  const persist = async (complete: boolean, closeAfterSave: boolean) => {
    if (!canEdit) {
      toast.error("ليست لديك صلاحية تعديل هذا النموذج");
      return;
    }

    setSaving(true);
    const supabase = createClient();
    const status = inferFormStatus(schema, data, complete);
    const payload = {
      project_id: project.id,
      template_id: form.template.id,
      assigned_owner_id: project.manager_id ?? currentUser.id,
      data_json: data as Json,
      completion_percentage: status === "completed" ? 100 : completion,
      status,
      updated_by: currentUser.id,
      completed_at: status === "completed" ? new Date().toISOString() : null,
      created_by: form.instance?.created_by ?? currentUser.id,
    };

    const { error } = await supabase
      .from("project_form_instances")
      .upsert(payload, { onConflict: "project_id,template_id" });

    if (error) toast.error(`ما نجح حفظ النموذج: ${error.message}`);
    else {
      toast.success(status === "completed" ? "تم تحديد النموذج كمكتمل" : "تم حفظ النموذج");
      onSaved();
      if (closeAfterSave) onClose();
    }
    setSaving(false);
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-slate-950/50 p-4 backdrop-blur-sm">
        <div className="mx-auto flex h-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-slate-50 shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
            <div>
              <h2 className="text-lg font-black text-slate-900">{form.template.name}</h2>
              <p className="text-xs text-slate-500">{form.template.category} - {form.template.stage} - الإكمال {completion}%</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setPreviewOpen(true)} className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50" title="معاينة">
                <Eye size={18} />
              </button>
              <button onClick={onClose} className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50" title="إغلاق">
                <X size={18} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-5">
            {!canEdit && (
              <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-700">
                يمكنك عرض النموذج فقط. تعبئة النماذج متاحة لمدير المشروع.
              </div>
            )}
            <DynamicFormRenderer schema={schema} data={data} profiles={profiles} readOnly={!canEdit} onChange={setData} />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white px-5 py-4">
            <div className="h-2 w-48 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-indigo-600 transition-all" style={{ width: `${completion}%` }} />
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50">إلغاء</button>
              <button onClick={() => persist(false, false)} disabled={saving || !canEdit} className="flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-bold text-indigo-700 hover:bg-indigo-100 disabled:opacity-60">
                {saving && <Loader2 size={15} className="animate-spin" />}
                حفظ كمسودة
              </button>
              <button onClick={() => persist(false, true)} disabled={saving || !canEdit} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-60">حفظ وإغلاق</button>
              <button onClick={() => persist(true, true)} disabled={saving || !canEdit} className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60">
                <CheckCircle2 size={16} />
                تحديد كمكتمل
              </button>
            </div>
          </div>
        </div>
      </div>

      <ProjectFormPreview project={project} form={{ ...form, completion }} data={data} open={previewOpen} onClose={() => setPreviewOpen(false)} />
    </>
  );
}
