const fs = require("fs");
const { createClient } = require("@supabase/supabase-js");
const env = fs.readFileSync(".env", "utf8");
const v = {};
env.split("\n").forEach((l) => { const m = l.match(/^([^#][^=]+)=(.*)$/); if (m) v[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, ""); });
const c = createClient(v.NEXT_PUBLIC_SUPABASE_URL, v.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  // 1. Check bad dates
  const { data: tasks } = await c.from("tasks").select("id, legacy_task_id, title, start_date, due_date, progress, status").limit(20);
  
  console.log("=== DATE ISSUES ===");
  const badDates = tasks.filter(t => {
    const sd = t.start_date || "";
    const dd = t.due_date || "";
    return sd.startsWith("1900") || dd.startsWith("1900") || sd.startsWith("1899") || dd.startsWith("1899");
  });
  console.log("Bad date tasks (sample of 20):", badDates.length);
  badDates.forEach(t => console.log(`  ${t.legacy_task_id}: start=${t.start_date} due=${t.due_date} - ${t.title}`));
  
  // 2. Count ALL bad dates
  const { data: allTasks } = await c.from("tasks").select("id, legacy_task_id, start_date, due_date");
  const allBad = allTasks.filter(t => {
    const sd = t.start_date || "";
    const dd = t.due_date || "";
    return sd.startsWith("1900") || dd.startsWith("1900") || sd.startsWith("1899") || dd.startsWith("1899");
  });
  console.log(`\nTotal tasks with bad dates: ${allBad.length} out of ${allTasks.length}`);
  
  // Check patterns
  const startBad = allTasks.filter(t => (t.start_date||"").startsWith("1900") || (t.start_date||"").startsWith("1899"));
  const dueBad = allTasks.filter(t => (t.due_date||"").startsWith("1900") || (t.due_date||"").startsWith("1899"));
  console.log(`  Bad start_date: ${startBad.length}`);
  console.log(`  Bad due_date: ${dueBad.length}`);

  // Show some examples of what year they should be
  if (badDates.length > 0) {
    console.log("\nExamples:");
    badDates.slice(0, 5).forEach(t => {
      const sd = t.start_date || "";
      const dd = t.due_date || "";
      const fixSd = sd ? sd.replace(/^18\d{2}|^19\d{2}/, "2026") : sd;
      const fixDd = dd ? dd.replace(/^18\d{2}|^19\d{2}/, "2026") : dd;
      console.log(`  ${t.legacy_task_id}: ${sd} → ${fixSd} | ${dd} → ${fixDd}`);
    });
  }

  // 3. Check progress
  console.log("\n=== PROGRESS ISSUES ===");
  const { data: progressTasks } = await c.from("tasks").select("id, legacy_task_id, title, progress, status, quantity_total, quantity_done").limit(15);
  progressTasks.forEach(t => {
    if (t.progress > 0 || t.quantity_total > 0) {
      console.log(`  ${t.legacy_task_id}: progress=${t.progress}% qty=${t.quantity_done}/${t.quantity_total} status=${t.status} - ${t.title}`);
    }
  });

  // Check projects progress
  console.log("\n=== PROJECT PROGRESS ===");
  const { data: projects } = await c.from("projects").select("id, name, progress, status");
  projects.forEach(p => {
    console.log(`  ${p.name}: progress=${p.progress}% status=${p.status}`);
  });

  // Check if calc_task_progress trigger works
  console.log("\n=== TRIGGER TEST ===");
  const testTask = tasks.find(t => t.quantity_total && t.quantity_total > 0 && t.quantity_done !== null);
  if (testTask) {
    const expectedProgress = Math.round((testTask.quantity_done / testTask.quantity_total) * 100);
    console.log(`  Task ${testTask.legacy_task_id}: qty_done=${testTask.quantity_done}/${testTask.quantity_total} → expected=${expectedProgress}% actual=${testTask.progress}%`);
    if (testTask.progress !== expectedProgress) {
      console.log("  ⚠️ TRIGGER NOT WORKING - progress mismatch!");
    } else {
      console.log("  ✅ Trigger working correctly");
    }
  }
}

check();
