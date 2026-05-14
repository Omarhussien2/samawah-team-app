import { KpiCenterClient } from "@/components/kpis/kpi-center-client";
import { getCurrentKpiPeriod } from "@/lib/kpis/periods";
import { getUser } from "@/lib/auth/get-user";
import { createClient } from "@/lib/supabase/server";

const SAFE_SHARE_LINK_SELECT = "id,name,active,expires_at,created_by,last_viewed_at,views_count,created_at,updated_at";

export default async function KpisPage() {
  const { user } = await getUser();
  const supabase = await createClient();
  const initialPeriod = getCurrentKpiPeriod("monthly");
  const initialYear = Number(initialPeriod.periodStart.slice(0, 4));

  const [
    { data: definitions },
    { data: values },
    { data: yearValues },
    { data: shareLinks },
  ] = await Promise.all([
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
    supabase
      .from("kpi_values")
      .select("*")
      .eq("period_type", "quarterly")
      .gte("period_start", `${initialYear}-01-01`)
      .lte("period_end", `${initialYear}-12-31`),
    user.role === "admin"
      ? supabase
          .from("kpi_share_links")
          .select(SAFE_SHARE_LINK_SELECT)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);

  return (
    <div className="min-h-full bg-slate-50/70 p-6 lg:p-8">
      <KpiCenterClient
        currentUser={user}
        initialDefinitions={definitions ?? []}
        initialValues={values ?? []}
        initialYearValues={yearValues ?? []}
        initialShareLinks={shareLinks ?? []}
        initialPeriod={initialPeriod}
      />
    </div>
  );
}
