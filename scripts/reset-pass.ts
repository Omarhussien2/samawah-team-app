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
  const email = "omarsamawah@gmail.com";
  const newPassword = "Samawah2026!";
  
  const { data: { users } } = await supabase.auth.admin.listUsers();
  const user = users.find(u => u.email === email);
  
  if (user) {
    const { error } = await supabase.auth.admin.updateUserById(user.id, {
      password: newPassword
    });
    
    if (error) {
      console.error("Error resetting password:", error);
    } else {
      console.log(`✅ Password reset successfully for ${email}`);
      console.log(`New Password: ${newPassword}`);
    }
  } else {
    console.log(`User ${email} not found`);
  }
}

main();
