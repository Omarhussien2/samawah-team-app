/**
 * Seed Script — fills Supabase with data from "مشاريع سماوة.xlsx"
 *
 * Usage:  npx tsx scripts/seed.ts
 *
 * Requires env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import * as XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";
import * as path from "path";
import * as crypto from "crypto";
import * as fs from "fs";

// ─── Load .env manually ───────────────────────────────────────────────
const envPath = path.resolve(__dirname, "../.env");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex > 0) {
      const key = trimmed.slice(0, eqIndex).trim();
      const val = trimmed.slice(eqIndex + 1).trim().replace(/^["']|["']$/g, "");
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

// ─── Supabase client (service role — bypasses RLS) ─────────────────────
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ─── Read Excel ────────────────────────────────────────────────────────
const filePath = path.resolve(__dirname, "../مشاريع سماوة.xlsx");
const workbook = XLSX.readFile(filePath);

function readSheet(name: string): Record<string, string>[] {
  const sheet = workbook.Sheets[name];
  if (!sheet) {
    console.log(`⚠️  Sheet "${name}" not found, skipping.`);
    return [];
  }
  return XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: "" });
}

// ─── Helpers ───────────────────────────────────────────────────────────
const statusMap: Record<string, string> = {
  "Execution": "active",
  "On Hold": "paused",
  "Completed": "completed",
  "Cancelled": "cancelled",
  "active": "active",
  "paused": "paused",
  "completed": "completed",
  "cancelled": "cancelled",
};

const taskStatusMap: Record<string, string> = {
  "مكتمل": "Done",
  "قيد التنفيذ": "In Progress",
  "لم يبدء": "To Do",
  "متأخر": "In Progress",
  "Done": "Done",
  "In Progress": "In Progress",
  "To Do": "To Do",
  "Backlog": "Backlog",
  "Review": "Review",
  "Cancelled": "Cancelled",
};

const priorityMap: Record<string, string> = {
  "high": "high",
  "medium": "medium",
  "low": "low",
  "critical": "critical",
};

const challengeStatusMap: Record<string, string> = {
  "Open": "open",
  "Resolved": "resolved",
  "Mitigated": "in_progress",
  "in_progress": "in_progress",
  "resolved": "resolved",
  "closed": "closed",
  "open": "open",
};

function parseDate(val: string | number | undefined): string | null {
  if (!val) return null;
  if (typeof val === "number") {
    // Excel serial date
    const d = XLSX.SSF.parse_date_code(val);
    if (!d) return null;
    return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  const s = String(val).trim();
  if (!s || s === "undefined" || s === "null") return null;
  // Handle M/D/YYYY format
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) {
    const [m, d, y] = s.split("/");
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  // Handle YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // Handle other date strings
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split("T")[0];
  }
  return null;
}

function parseNum(val: string | number | undefined): number | null {
  if (val === "" || val === undefined || val === null) return null;
  const n = Number(String(val).replace(/,/g, "").replace(/%/g, ""));
  return isNaN(n) ? null : n;
}

function parsePercent(val: string | number | undefined): number {
  if (val === "" || val === undefined || val === null) return 0;
  const s = String(val).replace(/%/g, "").replace(/,/g, "").trim();
  const n = parseFloat(s);
  if (isNaN(n)) return 0;
  return n > 1 ? n : Math.round(n * 100); // convert 0.5 -> 50
}

function generateUuid(): string {
  return crypto.randomUUID();
}

// Deterministic UUID from a seed string (for consistent IDs across runs)
function seededUuid(seed: string): string {
  const hash = crypto.createHash("sha256").update(seed).digest("hex"); // 64 hex chars
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    "4" + hash.slice(13, 16),
    "8" + hash.slice(17, 20), // variant 10xx = 8,9,a,b
    hash.slice(20, 32),
  ].join("-");
}

// ─── MAIN ──────────────────────────────────────────────────────────────
async function main() {
  console.log("🚀 Starting seed...\n");

  // ── 1. Users / Profiles ──────────────────────────────────────────────
  const usersSheet = readSheet("App_Users").filter((r) => r.Username?.trim());
  console.log(`📋 Found ${usersSheet.length} users`);

  // profiles.id has FK to auth.users — we can only insert profiles for existing auth users
  // For now, store the mapping with the name as key (owner_name field on tasks/projects)
  const userMap = new Map<string, string>(); // username -> name (for display)

  for (const row of usersSheet) {
    const username = row.Username.trim();
    const name = row.Name?.trim() || username;
    const role = (row.Role?.trim()?.toLowerCase() === "admin") ? "admin" : "member";
    userMap.set(username, name);
    console.log(`  ℹ️  User "${username}" (${role}) — will be linked when they sign up`);
  }
  console.log("  ⚠️  Profiles will be auto-created when users register via the app");
  console.log();

  // ── 2. Projects ──────────────────────────────────────────────────────
  const projectsSheet = readSheet("Projects").filter((r) => r.Project_ID?.trim());
  console.log(`📋 Found ${projectsSheet.length} projects`);

  const projectMap = new Map<string, string>();

  for (const row of projectsSheet) {
    const legacyId = row.Project_ID.trim();
    const id = seededUuid(`project:${legacyId}`);
    const status = statusMap[row.Current_Stage?.trim()] || "active";

    const { error } = await supabase.from("projects").upsert(
      {
        id,
        legacy_project_id: legacyId,
        name: row.Name?.trim() || legacyId,
        manager_id: null, // No auth users yet — will link later
        manager_name: row.Manager?.trim() || null,
        path: row.Project_Path?.trim() || null,
        current_stage: row.Current_Stage?.trim() || null,
        status,
        start_date: parseDate(row.Start_Date),
        end_date: parseDate(row.End_Date),
        total_budget: parseNum(row.Total_Budget) || 0,
        description: row.Description?.trim() || null,
        logo_url: row.Logo_URL?.trim() || null,
        progress: 0,
      },
      { onConflict: "id" }
    );

    if (error) {
      console.log(`  ❌ Project "${legacyId}": ${error.message}`);
    } else {
      projectMap.set(legacyId, id);
      console.log(`  ✅ Project "${row.Name?.trim()}" (${legacyId})`);
    }
  }
  console.log();

  // ── 3. Tasks ─────────────────────────────────────────────────────────
  const tasksSheet = readSheet("Tasks").filter(
    (r) => r.Task_ID?.trim() && r.Project_ID?.trim() && (r["Task"]?.trim() || r["Task Title"]?.trim())
  );
  console.log(`📋 Found ${tasksSheet.length} tasks`);

  let taskCount = 0;
  let taskErrors = 0;
  let taskSkipped = 0;

  // Process in batches of 50
  const BATCH_SIZE = 50;
  for (let i = 0; i < tasksSheet.length; i += BATCH_SIZE) {
    const batch = tasksSheet.slice(i, i + BATCH_SIZE);
    const rows = batch
      .map((row, idx) => {
        const legacyTaskId = row.Task_ID?.trim();
        const legacyProjectId = row.Project_ID?.trim();
        const ownerName = row.Owner?.trim();
        const rawStatus = row["Schedule_Status"]?.trim() || row["Status"]?.trim() || "";

        // Only include tasks whose project exists
        if (!projectMap.has(legacyProjectId)) return null;

        // Parse progress — Task_Progress is a decimal (0-1) or percentage
        let progress = 0;
        const tp = row["Task_Progress"];
        if (tp !== "" && tp !== undefined) {
          const n = Number(tp);
          if (!isNaN(n)) progress = n <= 1 ? Math.round(n * 100) : Math.round(n);
        }

        // Map alert level — only allow valid values from the CHECK constraint
        let alertLevel: string | null = null;
        const rawAlert = row["Alert_Level"]?.trim();
        if (rawAlert && ["Low", "Medium", "High", "Critical"].includes(rawAlert)) {
          alertLevel = rawAlert;
        }

        // Map status
        let status = taskStatusMap[rawStatus] || "To Do";

        return {
          id: seededUuid(`task:${legacyTaskId}`),
          legacy_task_id: legacyTaskId,
          project_id: projectMap.get(legacyProjectId)!,
          title: row["Task"]?.trim() || row["Task Title"]?.trim() || "مهمة بدون عنوان",
          sub_task: row["Sub_Task"]?.trim() || null,
          category: row["Category"]?.trim() || null,
          owner_id: null, // Can't link without auth users
          owner_name: ownerName || null,
          status,
          board_column: status,
          priority: "medium",
          start_date: parseDate(row.Start_Date),
          due_date: parseDate(row.End_Date || row["Auto_End_Date"]),
          cost: parseNum(row.Cost),
          quantity_total: parseNum(row.Quantity_Total),
          quantity_done: parseNum(row.Quantity_Done),
          progress,
          alert_level: alertLevel,
          alert_message: row["Alert_Message"]?.trim() || null,
          days_to_due: parseNum(row["Days_To_Due"]),
          sort_order: i + idx,
        };
      })
      .filter(Boolean);

    if (rows.length === 0) {
      taskSkipped += batch.length;
      continue;
    }

    const { error } = await supabase.from("tasks").upsert(rows, {
      onConflict: "id",
    });

    if (error) {
      console.log(`  ❌ Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${error.message}`);
      taskErrors += rows.length;
    } else {
      taskCount += rows.length;
      if ((Math.floor(i / BATCH_SIZE) + 1) % 4 === 0 || i + BATCH_SIZE >= tasksSheet.length) {
        console.log(`  ✅ Inserted ${taskCount}/${tasksSheet.length} tasks...`);
      }
    }
  }
  console.log(`  📊 Tasks: ${taskCount} inserted, ${taskErrors} errors, ${taskSkipped} skipped (no matching project)\n`);

  // ── 4. Challenges ────────────────────────────────────────────────────
  const challengesSheet = readSheet("Challenges").filter((r) => r.Challenge_ID?.trim());
  console.log(`📋 Found ${challengesSheet.length} challenges`);

  for (const row of challengesSheet) {
    const challengeId = row.Challenge_ID.trim();
    const legacyProjectId = row.Project_ID?.trim();
    const id = seededUuid(`challenge:${challengeId}`);

    const { error } = await supabase.from("challenges").upsert(
      {
        id,
        project_id: projectMap.get(legacyProjectId) || null,
        title: row.Description?.trim() || challengeId,
        description: row.Description?.trim() || null,
        status: challengeStatusMap[row.Status?.trim()] || "open",
        owner_id: null, // No auth users yet
        risk_impact: row.Risk_Impact?.trim() || null,
        risk_type: row.Risk_Type?.trim() || null,
        resolution: row.Resolution_Plan?.trim() || null,
      },
      { onConflict: "id" }
    );

    if (error) {
      console.log(`  ❌ Challenge "${challengeId}": ${error.message}`);
    } else {
      console.log(`  ✅ Challenge "${challengeId}"`);
    }
  }
  console.log();

  // ── 5. Update project manager_name ────────────────────────────────────
  console.log("📋 Updating project manager names...");
  for (const row of projectsSheet) {
    const legacyId = row.Project_ID?.trim();
    const managerName = row.Manager?.trim();
    const projectId = projectMap.get(legacyId);
    if (projectId && managerName) {
      await supabase.from("projects").update({ manager_name: managerName }).eq("id", projectId);
    }
  }
  console.log(`  ✅ Updated project manager names`);

  console.log("\n🎉 Seed complete!");
  console.log(`   Users: ${userMap.size}`);
  console.log(`   Projects: ${projectMap.size}`);
  console.log(`   Tasks: ${taskCount}`);
  console.log(`   Challenges: ${challengesSheet.length}`);
}

main().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
