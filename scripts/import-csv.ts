/**
 * سكريبت استيراد CSV من سطر الأوامر
 * الاستخدام:
 *   npx tsx scripts/import-csv.ts --type projects --file ./data/projects.csv
 *   npx tsx scripts/import-csv.ts --type tasks --file ./data/tasks.csv
 */

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";
import Papa from "papaparse";
import { normalizeMoney } from "../lib/projects/budget";

// تحقق من المتغيرات
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("❌ يجب تعيين NEXT_PUBLIC_SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY في .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

function mapArabicStatus(status: string): string {
  const s = status.trim();
  if (["مكتمل", "مكتملة"].includes(s)) return "Done";
  if (["قيد التنفيذ", "جارى التنفيذ"].includes(s)) return "In Progress";
  if (["لم يبدء", "لم يبدأ"].includes(s)) return "To Do";
  if (["متأخر", "متأخرة"].includes(s)) return "In Progress";
  if (["ملغي", "ملغاة"].includes(s)) return "Cancelled";
  return "Backlog";
}

function mapProjectType(type: string | null | undefined): "internal" | "external" {
  const normalized = type?.trim().toLowerCase();
  if (normalized && ["internal", "داخلية", "داخلي", "مشروع داخلي"].includes(normalized)) return "internal";
  return "external";
}

async function importProjects(filePath: string) {
  console.log(`📂 قراءة ملف المشاريع: ${filePath}`);
  const content = fs.readFileSync(filePath, "utf-8");
  const { data } = Papa.parse<Record<string, string>>(content, { header: true, skipEmptyLines: true });

  let success = 0;
  let errors = 0;

  for (const row of data) {
    const projectId = row["Project_ID"] ?? row["project_id"];
    const name = row["Name"] ?? row["name"];

    if (!projectId || !name) {
      console.warn(`⚠️ صف مخطوء - Project_ID أو Name مفقود`);
      errors++;
      continue;
    }

    const { error } = await supabase.from("projects").upsert({
      legacy_project_id: projectId,
      name,
      project_type: mapProjectType(row["Project_Type"] ?? row["project_type"] ?? row["Type"] ?? row["type"] ?? row["نوع المشروع"]),
      manager_name: row["Manager"] ?? null,
      path: row["Project_Path"] ?? null,
      current_stage: row["Current_Stage"] ?? null,
      start_date: row["Start_Date"] || null,
      end_date: row["End_Date"] || null,
      total_budget: normalizeMoney(row["Total_Budget"]),
      description: row["Description"] ?? null,
      logo_url: row["Logo_URL"] ?? null,
      status: "active",
    }, { onConflict: "legacy_project_id" });

    if (error) {
      console.error(`❌ فشل استيراد المشروع "${name}":`, error.message);
      errors++;
    } else {
      console.log(`✅ تم استيراد: ${name}`);
      success++;
    }
  }

  console.log(`\n📊 النتيجة: ${success} ناجح، ${errors} فاشل`);
}

async function importTasks(filePath: string) {
  console.log(`📂 قراءة ملف المهام: ${filePath}`);
  const content = fs.readFileSync(filePath, "utf-8");
  const { data } = Papa.parse<Record<string, string>>(content, { header: true, skipEmptyLines: true });

  // جلب خريطة المشاريع
  const { data: projects } = await supabase.from("projects").select("id, legacy_project_id");
  const projectMap = new Map(projects?.map((p) => [p.legacy_project_id, p.id]) ?? []);

  let success = 0;
  let errors = 0;

  for (const row of data) {
    const taskId = row["Task_ID"] ?? row["task_id"];
    const legacyProjectId = row["Project_ID"] ?? row["project_id"];
    const title = row["Task"] ?? row["task"] ?? row["title"];

    if (!taskId || !title) { errors++; continue; }

    const projectId = projectMap.get(legacyProjectId);
    if (!projectId) {
      console.warn(`⚠️ المشروع "${legacyProjectId}" غير موجود - المهمة: ${title}`);
      errors++;
      continue;
    }

    const arabicStatus = row["Status"] ?? row["status"] ?? "";
    const progress = parseFloat(row["Task_Progress"] ?? row["progress"] ?? "0") || 0;
    const alertLevel = row["Alert_Level"];
    const validAlertLevels = ["Low", "Medium", "High", "Critical"];

    const { error } = await supabase.from("tasks").upsert({
      legacy_task_id: taskId,
      project_id: projectId,
      title,
      sub_task: row["Sub_Task"] ?? null,
      category: row["Category"] ?? null,
      owner_name: row["Owner"] ?? null,
      status: mapArabicStatus(arabicStatus),
      board_column: mapArabicStatus(arabicStatus),
      priority: "medium",
      start_date: row["Start_Date"] || null,
      due_date: row["End_Date"] ?? (row["Due_Date"] || null),
      cost: normalizeMoney(row["Cost"]),
      quantity_total: parseFloat(row["Quantity_Total"] ?? "0") || null,
      quantity_done: parseFloat(row["Quantity_Done"] ?? "0") || null,
      progress: progress > 1 ? progress : progress * 100,
      alert_level: validAlertLevels.includes(alertLevel) ? alertLevel : null,
      alert_message: row["Alert_Message"] ?? null,
      alert_action: row["Alert_Action"] ?? null,
    }, { onConflict: "legacy_task_id" });

    if (error) {
      console.error(`❌ فشل استيراد المهمة "${title}":`, error.message);
      errors++;
    } else {
      console.log(`✅ تم استيراد: ${title}`);
      success++;
    }
  }

  console.log(`\n📊 النتيجة: ${success} ناجح، ${errors} فاشل`);
}

// تشغيل السكريبت
const args = process.argv.slice(2);
const typeIdx = args.indexOf("--type");
const fileIdx = args.indexOf("--file");

if (typeIdx === -1 || fileIdx === -1) {
  console.log("الاستخدام:");
  console.log("  npx tsx scripts/import-csv.ts --type projects --file ./data/projects.csv");
  console.log("  npx tsx scripts/import-csv.ts --type tasks --file ./data/tasks.csv");
  process.exit(1);
}

const type = args[typeIdx + 1];
const file = path.resolve(args[fileIdx + 1]);

if (!fs.existsSync(file)) {
  console.error(`❌ الملف غير موجود: ${file}`);
  process.exit(1);
}

if (type === "projects") {
  importProjects(file).catch(console.error);
} else if (type === "tasks") {
  importTasks(file).catch(console.error);
} else {
  console.error("❌ النوع يجب أن يكون projects أو tasks");
  process.exit(1);
}
