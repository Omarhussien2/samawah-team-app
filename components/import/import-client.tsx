"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Papa from "papaparse";
import { toast } from "sonner";
import { Upload, CheckCircle, AlertCircle, Loader2, X } from "lucide-react";
import { mapArabicStatus } from "@/lib/utils";
import type { Profile } from "@/lib/supabase/types";

interface ParsedProject {
  legacy_project_id: string;
  name: string;
  manager_name: string;
  path: string;
  current_stage: string;
  start_date: string;
  end_date: string;
  total_budget: number;
  description: string;
  _errors: string[];
}

interface ParsedTask {
  legacy_task_id: string;
  legacy_project_id: string;
  title: string;
  sub_task: string;
  category: string;
  owner_name: string;
  status: string;
  start_date: string;
  due_date: string;
  cost: number;
  quantity_total: number;
  quantity_done: number;
  progress: number;
  alert_level: string;
  alert_message: string;
  alert_action: string;
  _errors: string[];
}

interface Props {
  currentUser: Profile;
}

type ImportStep = "upload" | "preview" | "importing" | "done";

export function ImportClient({ currentUser: _currentUser }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<ImportStep>("upload");
  const [importType, setImportType] = useState<"projects" | "tasks">("projects");
  const [parsedProjects, setParsedProjects] = useState<ParsedProject[]>([]);
  const [parsedTasks, setParsedTasks] = useState<ParsedTask[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ success: number; errors: number } | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const parseProjectCSV = (data: Record<string, string>[]): ParsedProject[] => {
    return data.map((row) => {
      const errors: string[] = [];
      if (!row["Project_ID"] && !row["project_id"]) errors.push("Project_ID مفقود");
      if (!row["Name"] && !row["name"]) errors.push("الاسم مفقود");
      return {
        legacy_project_id: row["Project_ID"] ?? row["project_id"] ?? "",
        name: row["Name"] ?? row["name"] ?? "",
        manager_name: row["Manager"] ?? row["manager"] ?? "",
        path: row["Project_Path"] ?? row["path"] ?? "",
        current_stage: row["Current_Stage"] ?? row["current_stage"] ?? "",
        start_date: row["Start_Date"] ?? row["start_date"] ?? "",
        end_date: row["End_Date"] ?? row["end_date"] ?? "",
        total_budget: parseFloat(row["Total_Budget"] ?? row["total_budget"] ?? "0") || 0,
        description: row["Description"] ?? row["description"] ?? "",
        _errors: errors,
      };
    });
  };

  const parseTaskCSV = (data: Record<string, string>[]): ParsedTask[] => {
    return data.map((row) => {
      const errors: string[] = [];
      if (!row["Task_ID"] && !row["task_id"]) errors.push("Task_ID مفقود");
      if (!row["Task"] && !row["task"] && !row["title"]) errors.push("اسم المهمة مفقود");
      const arabicStatus = row["Status"] ?? row["status"] ?? "";
      const progress = parseFloat(row["Task_Progress"] ?? row["progress"] ?? "0") || 0;
      return {
        legacy_task_id: row["Task_ID"] ?? row["task_id"] ?? "",
        legacy_project_id: row["Project_ID"] ?? row["project_id"] ?? "",
        title: row["Task"] ?? row["task"] ?? row["title"] ?? "",
        sub_task: row["Sub_Task"] ?? row["sub_task"] ?? "",
        category: row["Category"] ?? row["category"] ?? "",
        owner_name: row["Owner"] ?? row["owner"] ?? "",
        status: mapArabicStatus(arabicStatus),
        start_date: row["Start_Date"] ?? row["start_date"] ?? "",
        due_date: row["End_Date"] ?? row["due_date"] ?? "",
        cost: parseFloat(row["Cost"] ?? row["cost"] ?? "0") || 0,
        quantity_total: parseFloat(row["Quantity_Total"] ?? row["quantity_total"] ?? "0") || 0,
        quantity_done: parseFloat(row["Quantity_Done"] ?? row["quantity_done"] ?? "0") || 0,
        progress: progress > 1 ? progress : progress * 100,
        alert_level: row["Alert_Level"] ?? row["alert_level"] ?? "",
        alert_message: row["Alert_Message"] ?? row["alert_message"] ?? "",
        alert_action: row["Alert_Action"] ?? row["alert_action"] ?? "",
        _errors: errors,
      };
    });
  };

  const processFile = useCallback((file: File) => {
    if (!file.name.endsWith(".csv")) {
      toast.error("يرجى رفع ملف CSV فقط");
      return;
    }
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (importType === "projects") {
          setParsedProjects(parseProjectCSV(results.data));
        } else {
          setParsedTasks(parseTaskCSV(results.data));
        }
        setStep("preview");
      },
      error: () => toast.error("فشل قراءة الملف"),
    });
  }, [importType]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  const handleImport = async () => {
    setImporting(true);
    try {
      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: importType,
          data: importType === "projects" ? parsedProjects : parsedTasks,
        }),
      });
      const json = await res.json();
      if (res.ok) {
        setResult(json);
        setStep("done");
        toast.success(`تم استيراد ${json.success} سجل بنجاح`);
      } else {
        toast.error(json.error ?? "فشل الاستيراد");
      }
    } catch {
      toast.error("حدث خطأ أثناء الاستيراد");
    }
    setImporting(false);
  };

  const errorCount = importType === "projects"
    ? parsedProjects.filter((p) => p._errors.length > 0).length
    : parsedTasks.filter((t) => t._errors.length > 0).length;
  const totalCount = importType === "projects" ? parsedProjects.length : parsedTasks.length;
  const validCount = totalCount - errorCount;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="section-header">
        <div>
          <h1 className="text-2xl font-bold text-foreground">استيراد البيانات</h1>
          <p className="text-muted-foreground text-sm mt-1">استيراد بيانات من Google Sheet (CSV)</p>
        </div>
      </div>

      {step === "upload" && (
        <div className="space-y-6">
          {/* Import Type */}
          <div className="bg-white rounded-xl border border-border p-5">
            <h3 className="font-medium mb-3">نوع الاستيراد</h3>
            <div className="flex gap-3">
              {(["projects", "tasks"] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setImportType(type)}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition-colors ${
                    importType === type ? "bg-primary text-white border-primary" : "border-border text-muted-foreground hover:bg-accent"
                  }`}
                >
                  {type === "projects" ? "مشاريع" : "مهام"}
                </button>
              ))}
            </div>
          </div>

          {/* Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
            <h3 className="font-semibold text-blue-800 mb-2">تعليمات الاستيراد</h3>
            <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
              <li>افتح Google Sheet واذهب إلى ملف &gt; تنزيل &gt; CSV</li>
              <li>تأكد من وجود أعمدة: {importType === "projects" ? "Project_ID, Name, Manager, Start_Date, End_Date" : "Task_ID, Project_ID, Task, Status, Owner"}</li>
              <li>ارفع الملف أدناه</li>
              <li>راجع البيانات قبل الاستيراد</li>
            </ol>
          </div>

          {/* Upload Zone */}
          <div
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors ${
              dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
            }`}
          >
            <Upload size={32} className="mx-auto text-muted-foreground mb-3" />
            <p className="font-medium text-foreground mb-1">اسحب ملف CSV هنا</p>
            <p className="text-sm text-muted-foreground mb-4">أو</p>
            <label className="px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary/90 cursor-pointer font-medium">
              اختر ملفاً
              <input type="file" accept=".csv" onChange={handleFileChange} className="sr-only" />
            </label>
          </div>
        </div>
      )}

      {step === "preview" && (
        <div className="space-y-5">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-border p-4 text-center">
              <p className="text-2xl font-bold text-foreground">{totalCount}</p>
              <p className="text-xs text-muted-foreground mt-1">إجمالي السجلات</p>
            </div>
            <div className="bg-green-50 rounded-xl border border-green-200 p-4 text-center">
              <p className="text-2xl font-bold text-green-700">{validCount}</p>
              <p className="text-xs text-green-600 mt-1">سجلات صالحة</p>
            </div>
            <div className="bg-red-50 rounded-xl border border-red-200 p-4 text-center">
              <p className="text-2xl font-bold text-red-700">{errorCount}</p>
              <p className="text-xs text-red-600 mt-1">سجلات بأخطاء</p>
            </div>
          </div>

          {/* Preview Table */}
          <div className="bg-white rounded-xl border border-border overflow-hidden">
            <div className="px-5 py-3 border-b border-border flex items-center justify-between">
              <h3 className="font-medium">معاينة البيانات (أول 10 سجلات)</h3>
              <button onClick={() => setStep("upload")} className="text-muted-foreground hover:text-foreground">
                <X size={18} />
              </button>
            </div>
            <div className="overflow-x-auto">
              {importType === "projects" ? (
                <table className="w-full text-xs">
                  <thead className="bg-muted/40 border-b border-border">
                    <tr>
                      <th className="text-right px-3 py-2 font-medium">الحالة</th>
                      <th className="text-right px-3 py-2 font-medium">المعرف</th>
                      <th className="text-right px-3 py-2 font-medium">الاسم</th>
                      <th className="text-right px-3 py-2 font-medium">المدير</th>
                      <th className="text-right px-3 py-2 font-medium">تاريخ الانتهاء</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {parsedProjects.slice(0, 10).map((p, i) => (
                      <tr key={i} className={p._errors.length > 0 ? "bg-red-50" : ""}>
                        <td className="px-3 py-2">
                          {p._errors.length > 0
                            ? <AlertCircle size={14} className="text-red-500" />
                            : <CheckCircle size={14} className="text-green-500" />}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">{p.legacy_project_id}</td>
                        <td className="px-3 py-2 font-medium">{p.name}</td>
                        <td className="px-3 py-2 text-muted-foreground">{p.manager_name}</td>
                        <td className="px-3 py-2 text-muted-foreground">{p.end_date}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <table className="w-full text-xs">
                  <thead className="bg-muted/40 border-b border-border">
                    <tr>
                      <th className="text-right px-3 py-2 font-medium">الحالة</th>
                      <th className="text-right px-3 py-2 font-medium">المعرف</th>
                      <th className="text-right px-3 py-2 font-medium">المهمة</th>
                      <th className="text-right px-3 py-2 font-medium">الحالة</th>
                      <th className="text-right px-3 py-2 font-medium">المسؤول</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {parsedTasks.slice(0, 10).map((t, i) => (
                      <tr key={i} className={t._errors.length > 0 ? "bg-red-50" : ""}>
                        <td className="px-3 py-2">
                          {t._errors.length > 0
                            ? <AlertCircle size={14} className="text-red-500" />
                            : <CheckCircle size={14} className="text-green-500" />}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">{t.legacy_task_id}</td>
                        <td className="px-3 py-2 font-medium">{t.title}</td>
                        <td className="px-3 py-2">{t.status}</td>
                        <td className="px-3 py-2 text-muted-foreground">{t.owner_name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep("upload")} className="flex-1 py-2.5 border border-border rounded-lg text-sm hover:bg-accent">
              رجوع
            </button>
            <button
              onClick={handleImport}
              disabled={importing || validCount === 0}
              className="flex-1 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {importing && <Loader2 size={15} className="animate-spin" />}
              {importing ? "جارٍ الاستيراد..." : `استيراد ${validCount} سجل`}
            </button>
          </div>
        </div>
      )}

      {step === "done" && result && (
        <div className="text-center py-12">
          <CheckCircle size={48} className="text-green-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-foreground mb-2">اكتمل الاستيراد</h2>
          <p className="text-muted-foreground mb-6">
            تم استيراد <span className="font-bold text-green-600">{result.success}</span> سجل بنجاح
            {result.errors > 0 && (
              <span> وفشل استيراد <span className="font-bold text-red-600">{result.errors}</span> سجل</span>
            )}
          </p>
          <div className="flex gap-3 justify-center">
            <button onClick={() => { setStep("upload"); setParsedProjects([]); setParsedTasks([]); setResult(null); }}
              className="px-5 py-2.5 border border-border rounded-lg text-sm hover:bg-accent">
              استيراد آخر
            </button>
            <button onClick={() => router.push("/projects")} className="px-5 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90">
              عرض المشاريع
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
