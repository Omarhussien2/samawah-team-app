import { KpiCenterClient } from "@/components/kpis/kpi-center-client";
import { getCurrentKpiPeriod } from "@/lib/kpis/periods";
import { getUser } from "@/lib/auth/get-user";
import { createClient } from "@/lib/supabase/server";

const SAFE_SHARE_LINK_SELECT = "id,name,active,expires_at,created_by,last_viewed_at,views_count,created_at,updated_at";

export default async function KpisPage() {
  const { user } = await getUser();
  const supabase = await createClient();
  const initialPeriod = getCurrentKpiPeriod("monthly");

  const [{ data: definitions }, { data: values }, { data: shareLinks }, { data: products }, { data: projects }, { data: projectUpdates }] = await Promise.all([
    supabase
      .from("kpi_definitions")
      .select("*")
      .eq("active", true)
      .order("sort_order", { ascending: true }),
    supabase
      .from("kpi_values")
      .select("*")
      .eq("period_type", initialPeriod.periodType)
      .eq("period_start", initialPeriod.periodStart)
      .eq("period_end", initialPeriod.periodEnd),
    user.role === "admin"
      ? supabase
          .from("kpi_share_links")
          .select(SAFE_SHARE_LINK_SELECT)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    supabase
      .from("indicator_products")
      .select("*")
      .order("updated_at", { ascending: false }),
    supabase
      .from("projects")
      .select("id,name,manager_id,total_budget,progress")
      .neq("status", "cancelled")
      .order("name", { ascending: true }),
    supabase
      .from("project_performance_updates")
      .select("*, project:projects(id,name,manager_id,total_budget,progress)")
      .eq("period_type", initialPeriod.periodType)
      .eq("period_start", initialPeriod.periodStart)
      .eq("period_end", initialPeriod.periodEnd)
      .order("updated_at", { ascending: false }),
  ]);

  return (
    <div className="min-h-full bg-slate-50/70 p-6 lg:p-8">
      <KpiCenterClient
        currentUser={user}
        initialDefinitions={definitions ?? []}
        initialValues={values ?? []}
        initialShareLinks={shareLinks ?? []}
        initialProducts={products ?? []}
        initialProjects={projects ?? []}
        initialProjectUpdates={projectUpdates ?? []}
        initialPeriod={initialPeriod}
      />
    </div>
  );
}
