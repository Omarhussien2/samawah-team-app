/**
 * Execute this script after users have signed up to link their profiles
 * to their imported projects and tasks based on their names.
 *
 * Usage: npx tsx scripts/link-users.ts
 */

import * as fs from "fs";
import * as path from "path";
import { createClient } from "@supabase/supabase-js";

// Load .env
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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  console.log("🔗 Starting User Linking Process...\n");

  // 1. Fetch all active profiles
  const { data: profiles, error: profileErr } = await supabase
    .from("profiles")
    .select("id, full_name, email");

  if (profileErr || !profiles) {
    console.error("❌ Failed to fetch profiles:", profileErr);
    process.exit(1);
  }

  console.log(`📋 Found ${profiles.length} registered users.`);
  if (profiles.length === 0) {
    console.log("⚠️ No users found. Users must sign up first before they can be linked.");
    process.exit(0);
  }

  // 2. Link Projects (manager_name -> manager_id)
  let linkedProjects = 0;
  for (const profile of profiles) {
    if (!profile.full_name) continue;

    const { data, error } = await supabase
      .from("projects")
      .update({ manager_id: profile.id })
      .eq("manager_name", profile.full_name)
      .is("manager_id", null)
      .select("id");

    if (!error && data) linkedProjects += data.length;
  }
  console.log(`✅ Linked ${linkedProjects} Projects to their managers.`);

  // 3. Link Tasks (owner_name -> owner_id)
  let linkedTasks = 0;
  for (const profile of profiles) {
    if (!profile.full_name) continue;

    const { data, error } = await supabase
      .from("tasks")
      .update({ owner_id: profile.id })
      .eq("owner_name", profile.full_name)
      .is("owner_id", null)
      .select("id");

    if (!error && data) linkedTasks += data.length;
  }
  console.log(`✅ Linked ${linkedTasks} Tasks to their owners.`);

  // 4. Link Project Members
  let linkedMembers = 0;
  for (const profile of profiles) {
    if (!profile.full_name) continue;

    // Find projects where the user owns tasks but isn't a project member
    const { data: userTasks } = await supabase
      .from("tasks")
      .select("project_id")
      .eq("owner_id", profile.id);

    if (userTasks && userTasks.length > 0) {
      const projectIds = [...new Set(userTasks.map(t => t.project_id))];

      for (const pId of projectIds) {
        const { error } = await supabase
          .from("project_members")
          .upsert(
            { project_id: pId, user_id: profile.id, role_in_project: "member" },
            { onConflict: "project_id,user_id" }
          );
        if (!error) linkedMembers++;
      }
    }
  }
  console.log(`✅ Added users as members to ${linkedMembers} Projects based on their tasks.`);

  console.log("\n🎉 Linking complete!");
}

main().catch(console.error);
