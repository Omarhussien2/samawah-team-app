/**
 * Execute SQL against Supabase using the REST API
 */
import * as fs from "fs";
import * as path from "path";

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
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function executeSQL(sql: string) {
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({ query: sql }),
  });

  if (!response.ok) {
    const text = await response.text();
    // RPC doesn't exist — use management API instead
    console.log(`RPC not available (${response.status}), trying direct approach...`);
    return false;
  }
  return true;
}

// Alternative: use the Supabase SQL endpoint
async function executeSQLViaManagement(sql: string) {
  // We can't use management API without the project ref token
  // Instead, let's create tables one by one via the REST API
  console.log("Using table creation via direct insert approach...");
  return false;
}

async function main() {
  console.log("🔧 Setting up Supabase tables...\n");
  
  // Try the RPC approach first
  const schemaSQL = fs.readFileSync(
    path.resolve(__dirname, "../supabase/schema.sql"),
    "utf-8"
  );

  const success = await executeSQL(schemaSQL);
  if (!success) {
    console.log("\n⚠️  Cannot execute SQL automatically.");
    console.log("📋 You need to run the schema SQL manually in Supabase Dashboard:\n");
    console.log("   1. Go to: https://supabase.com/dashboard");
    console.log("   2. Select your project");
    console.log("   3. Go to: SQL Editor");
    console.log("   4. Copy and paste the contents of: supabase/schema.sql");
    console.log("   5. Click: Run\n");
    console.log("   Then run: npx tsx scripts/seed.ts\n");
    process.exit(1);
  }

  console.log("✅ Tables created successfully!");
  console.log("Now run: npx tsx scripts/seed.ts");
}

main();
