const fs = require("fs");
const { createClient } = require("@supabase/supabase-js");
const env = fs.readFileSync(".env", "utf8");
const v = {};
env.split("\n").forEach((l) => { const m = l.match(/^([^#][^=]+)=(.*)$/); if (m) v[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, ""); });
const c = createClient(v.NEXT_PUBLIC_SUPABASE_URL, v.SUPABASE_SERVICE_ROLE_KEY);

async function fix() {
  // 1. Fix bad dates (1900 → 2026)
  const { data: allTasks } = await c.from("tasks").select("id, legacy_task_id, title, start_date, due_date");
  const badTasks = allTasks.filter(t => {
    const sd = t.start_date || "";
    const dd = t.due_date || "";
    return sd.startsWith("1900") || dd.startsWith("1900") || sd.startsWith("1899") || dd.startsWith("1899");
  });

  console.log(`Found ${badTasks.length} tasks with bad dates. Fixing...`);
  for (const t of badTasks) {
    const fixDate = (d) => {
      if (!d) return null;
      if (d.startsWith("1900")) return d.replace("1900", "2026");
      if (d.startsWith("1899")) return d.replace("1899", "2026");
      return d;
    };
    const newStart = fixDate(t.start_date);
    const newDue = fixDate(t.due_date);
    const { error } = await c.from("tasks").update({ start_date: newStart, due_date: newDue }).eq("id", t.id);
    if (error) console.log(`  ❌ ${t.legacy_task_id}: ${error.message}`);
    else console.log(`  ✅ ${t.legacy_task_id}: ${t.start_date}→${newStart} | ${t.due_date}→${newDue} - ${t.title}`);
  }

  // 2. Recalculate all project progress based on tasks
  console.log("\n=== Recalculating project progress ===");
  const { data: projects } = await c.from("projects").select("id, name");
  
  for (const project of projects) {
    const { data: tasks } = await c.from("tasks").select("id, status, progress").eq("project_id", project.id);
    if (!tasks || tasks.length === 0) continue;
    
    const totalTasks = tasks.length;
    const doneTasks = tasks.filter(t => t.status === "Done").length;
    const avgProgress = Math.round(tasks.reduce((sum, t) => sum + (t.progress || 0), 0) / totalTasks);
    
    // Use weighted: average of task progress
    const { error } = await c.from("projects").update({ progress: avgProgress }).eq("id", project.id);
    if (error) console.log(`  ❌ ${project.name}: ${error.message}`);
    else console.log(`  ✅ ${project.name}: ${doneTasks}/${totalTasks} done, avg progress=${avgProgress}%`);
  }

  // 3. Fix tasks with null progress but status=Done → set 100%
  const { data: doneNoProgress } = await c.from("tasks").select("id, legacy_task_id, title").eq("status", "Done").lt("progress", 100);
  console.log(`\n=== Fixing ${doneNoProgress?.length || 0} Done tasks with <100% progress ===`);
  if (doneNoProgress && doneNoProgress.length > 0) {
    const { error } = await c.from("tasks").update({ progress: 100 }).eq("status", "Done").lt("progress", 100);
    if (error) console.log(`  ❌ ${error.message}`);
    else console.log(`  ✅ Updated ${doneNoProgress.length} tasks to 100%`);
  }

  // 4. Fix tasks where quantity shows as 0.7 instead of 70%
  const { data: badQty } = await c.from("tasks").select("id, legacy_task_id, progress, quantity_total, quantity_done").gt("quantity_total", 0);
  if (badQty && badQty.length > 0) {
    console.log(`\n=== Checking ${badQty.length} tasks with quantity data ===`);
    for (const t of badQty) {
      if (t.quantity_total > 0) {
        const expectedProgress = Math.round(((t.quantity_done || 0) / t.quantity_total) * 100);
        if (t.progress !== expectedProgress) {
          await c.from("tasks").update({ progress: expectedProgress }).eq("id", t.id);
          console.log(`  ✅ ${t.legacy_task_id}: ${t.quantity_done}/${t.quantity_total} → ${expectedProgress}% (was ${t.progress}%)`);
        }
      }
    }
  }

  console.log("\n✅ All fixes applied!");
}

fix();
