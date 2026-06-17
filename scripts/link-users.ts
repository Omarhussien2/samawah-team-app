/**
 * Link imported project/task owner text to real profiles.
 *
 * Usage: pnpm exec tsx scripts/link-users.ts
 */

import * as fs from "fs";
import * as path from "path";
import { createClient } from "@supabase/supabase-js";
import { findUniqueProfileByName } from "../lib/users/name-matching";

function loadEnv(fileName: string) {
  const envPath = path.resolve(__dirname, "..", fileName);
  if (!fs.existsSync(envPath)) return;

  const envContent = fs.readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex <= 0) continue;

    const key = trimmed.slice(0, eqIndex).trim();
    const val = trimmed.slice(eqIndex + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnv(".env.local");
loadEnv(".env");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  console.log("Starting user linking process...");

  const { data: profiles, error: profileErr } = await supabase
    .from("profiles")
    .select("id, full_name, email");

  if (profileErr || !profiles) {
    console.error("Failed to fetch profiles:", profileErr);
    process.exit(1);
  }

  console.log(`Found ${profiles.length} registered users.`);
  if (profiles.length === 0) {
    console.log("No users found. Users must sign up first before they can be linked.");
    process.exit(0);
  }

  const { data: projects, error: projectsErr } = await supabase
    .from("projects")
    .select("id, manager_name")
    .is("manager_id", null);

  if (projectsErr || !projects) {
    console.error("Failed to fetch projects:", projectsErr);
    process.exit(1);
  }

  let linkedProjects = 0;
  for (const project of projects) {
    const profile = findUniqueProfileByName(project.manager_name, profiles);
    if (!profile) continue;

    const { data, error } = await supabase
      .from("projects")
      .update({ manager_id: profile.id })
      .eq("id", project.id)
      .select("id");

    if (error || !data) continue;

    linkedProjects += data.length;
    await supabase
      .from("project_members")
      .upsert(
        { project_id: project.id, user_id: profile.id, role_in_project: "manager" },
        { onConflict: "project_id,user_id" }
      );
  }
  console.log(`Linked ${linkedProjects} projects to their managers.`);

  const { data: tasks, error: tasksErr } = await supabase
    .from("tasks")
    .select("id, owner_name")
    .is("owner_id", null);

  if (tasksErr || !tasks) {
    console.error("Failed to fetch tasks:", tasksErr);
    process.exit(1);
  }

  let linkedTasks = 0;
  for (const task of tasks) {
    const profile = findUniqueProfileByName(task.owner_name, profiles);
    if (!profile) continue;

    const { data, error } = await supabase
      .from("tasks")
      .update({ owner_id: profile.id })
      .eq("id", task.id)
      .select("id");

    if (!error && data) linkedTasks += data.length;
  }
  console.log(`Linked ${linkedTasks} tasks to their owners.`);

  let linkedMembers = 0;
  for (const profile of profiles) {
    const { data: userTasks } = await supabase
      .from("tasks")
      .select("project_id")
      .eq("owner_id", profile.id);

    if (!userTasks || userTasks.length === 0) continue;
    const projectIds = [...new Set(userTasks.map((task) => task.project_id))];

    for (const projectId of projectIds) {
      const { error } = await supabase
        .from("project_members")
        .upsert(
          { project_id: projectId, user_id: profile.id, role_in_project: "member" },
          { onConflict: "project_id,user_id", ignoreDuplicates: true }
        );

      if (!error) linkedMembers++;
    }
  }
  console.log(`Added users as members to ${linkedMembers} projects based on their tasks.`);
  console.log("Linking complete.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
