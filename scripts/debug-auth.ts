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
  const { data: { users }, error } = await supabase.auth.admin.listUsers();
  
  if (error) {
    console.error("Error listing users:", error);
    return;
  }

  console.log("--- Supabase Auth Users ---");
  users.forEach(u => {
    console.log(`- Email: ${u.email}`);
    console.log(`  Confirmed: ${!!u.email_confirmed_at}`);
    console.log(`  Last Sign In: ${u.last_sign_in_at || "Never"}`);
    console.log(`  Created At: ${u.created_at}`);
    console.log("---------------------------");
  });
}

main();
