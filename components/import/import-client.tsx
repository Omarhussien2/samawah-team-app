"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Papa from "papaparse";
import { toast } from "sonner";
import {
  AlertCircle,
  CheckCircle,
  Download,
  FileSpreadsheet,
  Loader2,
  Upload,
  X,
} from "lucide-react";
import { getProjectTypeLabel, mapArabicStatus, mapProjectType } from "@/lib/utils";
import { normalizeMoney } from "@/lib/projects/budget";
import type { Profile, Project } from "@/lib/supabase/types";

interface ParsedProject {
  legacy_project_id: string;
  name: string;
  project_type: "internal" | "external";
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

type ImportProject = Pick<Project, "id" | "name" | "legacy_project_id" | "manager_name" | "status">;

interface Props {
  currentUser: Profile;
  projects: ImportProject[];
}

type ImportStep = "upload" | "preview" | "importing" | "done";
type ImportType = "projects" | "tasks";
type TaskImportMode = "existing-project" | "multi-project";

const taskModeLabels: Record<TaskImportMode, string> = {
  "existing-project": "داخل مشروع موجود",
  "multi-project": "حسب Project_ID",
};

function getField(row: Record<string, string>, ...keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }

  return "";
}

export function ImportClient({ currentUser: _currentUser, projects }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<ImportStep>("upload");
  const [importType, setImportType] = useState<ImportType>("projects");
  const [taskImportMode, setTaskImportMode] = useState<TaskImportMode>("existing-project");
  const [selectedProjectId, setSelectedProjectId] = useState(projects[0]?.id ?? "");
  const [parsedProjects, setParsedProjects] = useState<ParsedProject[]>([]);
  const [parsedTasks, setParsedTasks] = useState<ParsedTask[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ success: number; errors: number; errorDetails?: string[] } | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId]
  );

  const templateLinks = [
    { label: "قالب المشاريع", href: "/api/import/templates?type=projects" },
    { label: "قالب مهام لمشروع موجود", href: "/api/import/templates?type=tasks-existing" },
    { label: "قالب مهام موزعة على مشاريع", href: "/api/import/templates?type=tasks-multi" },
  ];

  const resetParsedData = () => {
    setParsedProjects([]);
    setParsedTasks([]);
    setResult(null);
  };

  const parseProjectCSV = (data: Record<string, string>[]): ParsedProject[] => {
    return data.map((row) => {
      const errors: string[] = [];
      if (!getField(row, "Project_ID", "project_id")) errors.push("Project_ID مفقود");
      if (!getField(row, "Name", "name")) errors.push("اسم المشروع مفقود");

      return {
        legacy_project_id: getField(row, "Project_ID", "project_id"),
        name: getField(row, "Name", "name"),
        project_type: mapProjectType(getField(row, "Project_Type", "project_type", "Type", "type", "نوع المشروع")),
        manager_name: getField(row, "Manager", "manager"),
        path: getField(row, "Project_Path", "path"),
        current_stage: getField(row, "Current_Stage", "current_stage"),
        start_date: getField(row, "Start_Date", "start_date"),
        end_date: getField(row, "End_Date", "end_date"),
        total_budget: normalizeMoney(getField(row, "Total_Budget", "total_budget")),
        description: getField(row, "Description", "description"),
        _errors: errors,
      };
    });
  };

  const parseTaskCSV = (data: Record<string, string>[]): ParsedTask[] => {
    return data.map((row) => {
      const errors: string[] = [];
      if (!getField(row, "Task_ID", "task_id")) errors.push("Task_ID مفقود");
      if (!getField(row, "Task", "task", "title")) errors.push("اسم المهمة مفقود");
      if (taskImportMode === "multi-project" && !getField(row, "Project_ID", "project_id")) {
        errors.push("Project_ID مفقود");
      }

      const arabicStatus = getField(row, "Status", "status");
      const progress = parseFloat(getField(row, "Task_Progress", "progress") || "0") || 0;

      return {
        legacy_task_id: getField(row, "Task_ID", "task_id"),
        legacy_project_id: getField(row, "Project_ID", "project_id"),
        title: getField(row, "Task", "task", "title"),
        sub_task: getField(row, "Sub_Task", "sub_task"),
        category: getField(row, "Category", "category"),
        owner_name: getField(row, "Owner", "owner"),
        status: mapArabicStatus(arabicStatus),
        start_date: getField(row, "Start_Date", "start_date"),
        due_date: getField(row, "End_Date", "due_date"),
        cost: normalizeMoney(getField(row, "Cost", "cost")),
        quantity_total: parseFloat(getField(row, "Quantity_Total", "quantity_total") || "0") || 0,
        quantity_done: parseFloat(getField(row, "Quantity_Done", "quantity_done") || "0") || 0,
        progress: progress > 1 ? progress : progress * 100,
        alert_level: getField(row, "Alert_Level", "alert_level"),
        alert_message: getField(row, "Alert_Message", "alert_message"),
        alert_action: getField(row, "Alert_Action", "alert_action"),
        _errors: errors,
      };
    });
  };

  const processFile = (file: File) => {
    if (!file.name.endsWith(".csv")) {
      toast.error("يرجى رفع ملف CSV فقط");
      return;
    }

    if (importType === "tasks" && taskImportMode === "existing-project" && !selectedProjectId) {
      toast.error("اختر المشروع الذي ستضاف إليه المهام أولاً");
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
  };

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
    if (importType === "tasks" && taskImportMode === "existing-project" && !selectedProjectId) {
      toast.error("اختر المشروع قبل الاستيراد");
      return;
    }

    setImporting(true);
    try {
      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: importType,
          data: importType === "projects" ? parsedProjects : parsedTasks,
          targetProjectId: importType === "tasks" && taskImportMode === "existing-project" ? selectedProjectId : null,
        }),
      });
      const json = await res.json();

      if (res.ok) {
        setResult(json);
        setStep("done");
        router.refresh();
        toast.success(`تم استيراد ${json.success} سجل بنجاح`);
      } else {
        toast.error(json.error ?? "فشل الاستيراد");
      }
    } catch {
      toast.error("حدث خطأ أثناء الاستيراد");
    }
    setImporting(false);
  };

  const changeImportType = (type: ImportType) => {
    setImportType(type);
    resetParsedData();
  };

  const changeTaskMode = (mode: TaskImportMode) => {
    setTaskImportMode(mode);
    resetParsedData();
  };

  const errorCount = importType === "projects"
    ? parsedProjects.filter((p) => p._errors.length > 0).length
    : parsedTasks.filter((t) => t._errors.length > 0).length;
  const totalCount = importType === "projects" ? parsedProjects.length : parsedTasks.length;
  const validCount = totalCount - errorCount;
  const taskColumnsLabel = taskImportMode === "existing-project"
    ? "Task_ID, Task, Status, Owner"
    : "Task_ID, Project_ID, Task, Status, Owner";

  return (
    <div className="max-w-4xl mx-auto">
      <div className="section-header">
        <div>
          <h1 className="text-2xl font-bold text-foreground">استيراد البيانات</h1>
          <p className="text-muted-foreground text-sm mt-1">استيراد المشاريع أو المهام من ملف CSV مع قالب جاهز لكل حالة</p>
        </div>
      </div>

      {step === "upload" && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-border p-5">
            <h3 className="font-medium mb-3">نوع الاستيراد</h3>
            <div className="grid grid-cols-2 gap-3">
              {(["projects", "tasks"] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => changeImportType(type)}
                  className={`py-2.5 rounded-lg text-sm font-medium border transition-colors ${
                    importType === type ? "bg-primary text-white border-primary" : "border-border text-muted-foreground hover:bg-accent"
                  }`}
                >
                  {type === "projects" ? "مشاريع" : "مهام"}
                </button>
              ))}
            </div>
          </div>

          {importType === "tasks" && (
            <div className="bg-white rounded-xl border border-border p-5 space-y-4">
              <div>
                <h3 className="font-medium mb-3">طريقة ربط المهام</h3>
                <div className="grid grid-cols-2 gap-3">
                  {(["existing-project", "multi-project"] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => changeTaskMode(mode)}
                      className={`py-2.5 rounded-lg text-sm font-medium border transition-colors ${
                        taskImportMode === mode ? "bg-primary text-white border-primary" : "border-border text-muted-foreground hover:bg-accent"
                      }`}
                    >
                      {taskModeLabels[mode]}
                    </button>
                  ))}
                </div>
              </div>

              {taskImportMode === "existing-project" && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">المشروع المستهدف</label>
                  <select
                    value={selectedProjectId}
                    onChange={(event) => setSelectedProjectId(event.target.value)}
                    className="w-full h-11 rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                  >
                    {projects.length === 0 ? (
                      <option value="">لا توجد مشاريع متاحة</option>
                    ) : (
                      projects.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.name}{project.legacy_project_id ? ` - ${project.legacy_project_id}` : ""}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              )}
            </div>
          )}

          <div className="bg-white rounded-xl border border-border p-5">
            <div className="flex items-center gap-2 mb-3">
              <FileSpreadsheet size={18} className="text-primary" />
              <h3 className="font-medium">قوالب جاهزة</h3>
            </div>
            <div className="grid sm:grid-cols-3 gap-3">
              {templateLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium hover:bg-accent"
                >
                  <Download size={16} />
                  {link.label}
                </a>
              ))}
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
            <h3 className="font-semibold text-blue-800 mb-2">تعليمات الاستيراد</h3>
            <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
              <li>حمّل القالب المناسب واملأ البيانات، ثم احفظ ورقة البيانات بصيغة CSV.</li>
              <li>تأكد من وجود أعمدة: {importType === "projects" ? "Project_ID, Name, Project_Type, Manager, Start_Date, End_Date" : taskColumnsLabel}</li>
              {importType === "tasks" && taskImportMode === "existing-project" && (
                <li>كل المهام في الملف ستضاف إلى مشروع: {selectedProject?.name ?? "لم يتم اختيار مشروع"}</li>
              )}
              <li>ارفع الملف وراجع المعاينة قبل تنفيذ الاستيراد.</li>
            </ol>
          </div>

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

          {importType === "tasks" && taskImportMode === "existing-project" && selectedProject && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700">
              سيتم ربط كل المهام في هذا الملف بمشروع: <span className="font-semibold">{selectedProject.name}</span>
            </div>
          )}

          <div className="bg-white rounded-xl border border-border overflow-hidden">
            <div className="px-5 py-3 border-b border-border flex items-center justify-between">
              <h3 className="font-medium">معاينة البيانات (أول 10 سجلات)</h3>
              <button onClick={() => setStep("upload")} className="text-muted-foreground hover:text-foreground" aria-label="إغلاق المعاينة">
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
                      <th className="text-right px-3 py-2 font-medium">نوع المشروع</th>
                      <th className="text-right px-3 py-2 font-medium">المدير</th>
                      <th className="text-right px-3 py-2 font-medium">تاريخ الانتهاء</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {parsedProjects.slice(0, 10).map((project, index) => (
                      <tr key={`${project.legacy_project_id}-${index}`} className={project._errors.length > 0 ? "bg-red-50" : ""}>
                        <td className="px-3 py-2">
                          {project._errors.length > 0
                            ? <AlertCircle size={14} className="text-red-500" />
                            : <CheckCircle size={14} className="text-green-500" />}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">{project.legacy_project_id}</td>
                        <td className="px-3 py-2 font-medium">{project.name}</td>
                        <td className="px-3 py-2 text-muted-foreground">{getProjectTypeLabel(project.project_type)}</td>
                        <td className="px-3 py-2 text-muted-foreground">{project.manager_name}</td>
                        <td className="px-3 py-2 text-muted-foreground">{project.end_date}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <table className="w-full text-xs">
                  <thead className="bg-muted/40 border-b border-border">
                    <tr>
                      <th className="text-right px-3 py-2 font-medium">الحالة</th>
                      <th className="text-right px-3 py-2 font-medium">معرف المهمة</th>
                      {taskImportMode === "multi-project" && (
                        <th className="text-right px-3 py-2 font-medium">معرف المشروع</th>
                      )}
                      <th className="text-right px-3 py-2 font-medium">المهمة</th>
                      <th className="text-right px-3 py-2 font-medium">الحالة</th>
                      <th className="text-right px-3 py-2 font-medium">المسؤول</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {parsedTasks.slice(0, 10).map((task, index) => (
                      <tr key={`${task.legacy_task_id}-${index}`} className={task._errors.length > 0 ? "bg-red-50" : ""}>
                        <td className="px-3 py-2">
                          {task._errors.length > 0
                            ? <AlertCircle size={14} className="text-red-500" />
                            : <CheckCircle size={14} className="text-green-500" />}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">{task.legacy_task_id}</td>
                        {taskImportMode === "multi-project" && (
                          <td className="px-3 py-2 text-muted-foreground">{task.legacy_project_id}</td>
                        )}
                        <td className="px-3 py-2 font-medium">{task.title}</td>
                        <td className="px-3 py-2">{task.status}</td>
                        <td className="px-3 py-2 text-muted-foreground">{task.owner_name}</td>
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
          <p className="text-muted-foreground mb-2">
            تم استيراد <span className="font-bold text-green-600">{result.success}</span> سجل بنجاح
            {result.errors > 0 && (
              <span> وفشل استيراد <span className="font-bold text-red-600">{result.errors}</span> سجل</span>
            )}
          </p>
          {result.errorDetails && result.errorDetails.length > 0 && (
            <div className="mt-4 mb-6 bg-red-50 border border-red-200 rounded-xl p-4 text-right max-w-xl mx-auto">
              <h4 className="text-sm font-semibold text-red-700 mb-2">تفاصيل الأخطاء:</h4>
              <ul className="text-xs text-red-600 space-y-1 max-h-40 overflow-y-auto">
                {result.errorDetails.map((detail, index) => <li key={`${detail}-${index}`}>{detail}</li>)}
              </ul>
            </div>
          )}
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => { setStep("upload"); resetParsedData(); }}
              className="px-5 py-2.5 border border-border rounded-lg text-sm hover:bg-accent"
            >
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
