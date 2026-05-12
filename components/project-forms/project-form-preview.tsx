"use client";

import { Printer, X, Download } from "lucide-react";
import type { Project } from "@/lib/supabase/types";
import { DynamicFormRenderer } from "./dynamic-form-renderer";
import { buildPrintableHtml, downloadHtml } from "@/lib/project-forms/export";
import { parseFormSchema, type ProjectFormData } from "@/lib/project-forms/schema";
import type { ProjectFormTemplateWithInstance } from "@/lib/project-forms/types";

interface Props {
  project: Project;
  form: ProjectFormTemplateWithInstance;
  data: ProjectFormData;
  open: boolean;
  onClose: () => void;
}

export function ProjectFormPreview({ project, form, data, open, onClose }: Props) {
  if (!open) return null;

  const schema = parseFormSchema(form.template.schema_json);
  const printableHtml = () => buildPrintableHtml(project, form, data);

  const handlePrint = () => {
    const printWindow = window.open("", "_blank", "noopener,noreferrer");
    if (!printWindow) return;
    printWindow.document.write(printableHtml());
    printWindow.document.close();
    printWindow.focus();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/50 p-4 backdrop-blur-sm">
      <div className="mx-auto flex h-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-lg font-black text-slate-900">{form.template.name}</h2>
            <p className="text-xs text-slate-500">معاينة قابلة للطباعة - {project.name}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => downloadHtml(`${form.template.name}.html`, printableHtml())} className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50" title="تحميل HTML">
              <Download size={18} />
            </button>
            <button onClick={handlePrint} className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50" title="طباعة">
              <Printer size={18} />
            </button>
            <button onClick={onClose} className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50" title="إغلاق">
              <X size={18} />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto bg-slate-50 p-5">
          <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-5">
            <div className="grid gap-3 text-sm md:grid-cols-4">
              <div><span className="text-slate-400">المشروع</span><p className="font-bold text-slate-800">{project.name}</p></div>
              <div><span className="text-slate-400">الحالة</span><p className="font-bold text-slate-800">{form.statusLabel}</p></div>
              <div><span className="text-slate-400">الإكمال</span><p className="font-bold text-slate-800">{form.completion}%</p></div>
              <div><span className="text-slate-400">آخر تحديث</span><p className="font-bold text-slate-800">{form.updatedAt ? new Date(form.updatedAt).toLocaleDateString("ar") : "-"}</p></div>
            </div>
          </div>
          <DynamicFormRenderer schema={schema} data={data} profiles={[]} readOnly />
        </div>
      </div>
    </div>
  );
}
