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
  // Update the manager's name to match Arabic Excel names
  const { error } = await supabase
    .from("profiles")
    .update({ full_name: "عمر" })
    .eq("email", "omarsamawah@gmail.com");

  if (error) {
    console.error("Error updating profile:", error);
  } else {
    console.log("✅ Updated omarsamawah@gmail.com full_name to 'عمر'");
  }
}

main();
