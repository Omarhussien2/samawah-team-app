"use client";

import { Download, Loader2, Printer, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { Profile, Project } from "@/lib/supabase/types";
import { DynamicFormRenderer } from "./dynamic-form-renderer";
import { buildPrintableHtml, downloadFormDocx, downloadFormPdf } from "@/lib/project-forms/export";
import { parseFormSchema, type ProjectFormData } from "@/lib/project-forms/schema";
import type { ProjectFormTemplateWithInstance } from "@/lib/project-forms/types";
import { getProjectTypeLabel } from "@/lib/utils";

interface Props {
  project: Project;
  form: ProjectFormTemplateWithInstance;
  data: ProjectFormData;
  profiles?: Pick<Profile, "id" | "full_name" | "avatar_url">[];
  open: boolean;
  onClose: () => void;
}

export function ProjectFormPreview({ project, form, data, profiles = [], open, onClose }: Props) {
  const [exporting, setExporting] = useState<"pdf" | "docx" | null>(null);

  if (!open) return null;

  const schema = parseFormSchema(form.template.schema_json);
  const printableHtml = () => buildPrintableHtml(project, form, data, profiles);

  const handlePrint = () => {
    const printWindow = window.open("", "_blank", "noopener,noreferrer");
    if (!printWindow) return;
    printWindow.document.write(printableHtml());
    printWindow.document.close();
    printWindow.focus();
  };

  const handleExport = async (format: "pdf" | "docx") => {
    setExporting(format);
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
    <div className="fixed inset-0 z-50 bg-slate-950/50 p-4 backdrop-blur-sm">
      <div className="mx-auto flex h-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-lg font-black text-slate-900">{form.template.name}</h2>
            <p className="text-xs text-slate-500">معاينة قابلة للطباعة - {project.name} - {getProjectTypeLabel(project.project_type)}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => handleExport("pdf")} disabled={exporting === "pdf"} className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 disabled:opacity-60" title="تحميل PDF">
              {exporting === "pdf" ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
            </button>
            <button onClick={() => handleExport("docx")} disabled={exporting === "docx"} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-60" title="تحميل Word">
              {exporting === "docx" ? <Loader2 size={16} className="animate-spin" /> : "Word"}
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
            <div className="grid gap-3 text-sm md:grid-cols-5">
              <div><span className="text-slate-400">المشروع</span><p className="font-bold text-slate-800">{project.name}</p></div>
              <div><span className="text-slate-400">نوع المشروع</span><p className="font-bold text-slate-800">{getProjectTypeLabel(project.project_type)}</p></div>
              <div><span className="text-slate-400">الحالة</span><p className="font-bold text-slate-800">{form.statusLabel}</p></div>
              <div><span className="text-slate-400">الإكمال</span><p className="font-bold text-slate-800">{form.completion}%</p></div>
              <div><span className="text-slate-400">آخر تحديث</span><p className="font-bold text-slate-800">{form.updatedAt ? new Date(form.updatedAt).toLocaleDateString("ar") : "-"}</p></div>
            </div>
          </div>
          <DynamicFormRenderer schema={schema} data={data} profiles={profiles} readOnly />
        </div>
      </div>
    </div>
  );
}
