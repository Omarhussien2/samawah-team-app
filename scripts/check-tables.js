const fs = require("fs");
const { createClient } = require("@supabase/supabase-js");

const env = fs.readFileSync(".env", "utf8");
const vars = {};
env.split("\n").forEach((l) => {
  const m = l.match(/^([^#][^=]+)=(.*)$/);
  if (m) vars[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
});

const c = createClient(vars.NEXT_PUBLIC_SUPABASE_URL, vars.SUPABASE_SERVICE_ROLE_KEY);

Promise.all([
  c.from("profiles").select("id,full_name,role", { count: "exact" }).limit(5),
  c.from("projects").select("id,name", { count: "exact" }).limit(5),
  c.from("tasks").select("id", { count: "exact" }).limit(1),
  c.from("challenges").select("id", { count: "exact" }).limit(1),
]).then(([p, pr, t, ch]) => {
  console.log("Profiles:", p.count, "rows | error:", p.error?.message || "none");
  if (p.data?.length) p.data.forEach(u => console.log("  -", u.full_name, u.role));
  console.log("Projects:", pr.count, "rows | error:", pr.error?.message || "none");
  if (pr.data?.length) pr.data.forEach(p => console.log("  -", p.name));
  console.log("Tasks:", t.count, "rows | error:", t.error?.message || "none");
  console.log("Challenges:", ch.count, "rows | error:", ch.error?.message || "none");
});
