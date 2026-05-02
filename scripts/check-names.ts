import * as fs from "fs";
import * as path from "path";
import { createClient } from "@supabase/supabase-js";

const envPath = path.resolve(process.cwd(), ".env");
const envContent = fs.readFileSync(envPath, "utf-8");
const env: any = {};
for (const line of envContent.split("\n")) {
  const [key, ...val] = line.trim().split("=");
  if (key && val) env[key.trim()] = val.join("=").trim().replace(/^["']|["']$/g, "");
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const { data: profiles } = await supabase.from("profiles").select("full_name, email");
  const { data: tasks } = await supabase.from("tasks").select("owner_name").not("owner_name", "is", null);
  
  const uniqueExcelNames = Array.from(new Set(tasks?.map(t => t.owner_name))).filter(Boolean);
  
  console.log("--- Registered Profiles ---");
  profiles?.forEach(p => console.log(`- Name: "${p.full_name}" | Email: ${p.email}`));
  
  console.log("\n--- Top 10 Names from Excel (Tasks) ---");
  uniqueExcelNames.slice(0, 15).forEach(n => console.log(`- "${n}"`));
}

main();
