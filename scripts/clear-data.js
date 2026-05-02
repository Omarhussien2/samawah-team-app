const fs = require("fs");
const { createClient } = require("@supabase/supabase-js");
const env = fs.readFileSync(".env", "utf8");
const v = {};
env.split("\n").forEach((l) => {
  const m = l.match(/^([^#][^=]+)=(.*)$/);
  if (m) v[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
});
const c = createClient(v.NEXT_PUBLIC_SUPABASE_URL, v.SUPABASE_SERVICE_ROLE_KEY);

async function clear() {
  await c.from("tasks").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  const t = await c.from("tasks").select("id", { count: "exact", head: true });
  console.log("Tasks cleared. Remaining:", t.count);
}
clear();
