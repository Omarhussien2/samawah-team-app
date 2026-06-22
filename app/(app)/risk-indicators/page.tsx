import { RiskIndicatorsClient } from "@/components/risk-indicators/risk-indicators-client";
import { getUser } from "@/lib/auth/get-user";
import { buildRiskIndicatorData } from "@/lib/risk-indicators/metrics";
import { createClient } from "@/lib/supabase/server";
import type { RiskIndicatorChallenge, RiskIndicatorProject, RiskIndicatorTask } from "@/lib/risk-indicators/metrics";

const PAGE_SIZE = 1000;

type PagedResult<T> = {
  data: T[] | null;
  error: { message: string } | null;
};

async function fetchAllRows<T>(
  fetchPage: (from: number, to: number) => PromiseLike<PagedResult<T>>,
) {
  const rows: T[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await fetchPage(from, from + PAGE_SIZE - 1);
    const pageRows = data ?? [];

    rows.push(...pageRows);

    if (error || pageRows.length < PAGE_SIZE) {
      return { data: rows, error };
    }
  }
}

export default async function RiskIndicatorsPage() {
  await getUser();
  const supabase = await createClient();

  const [{ data: projects, error: projectsError }, { data: tasks, error: tasksError }, { data: challenges, error: challengesError }] =
    await Promise.all([
      fetchAllRows<RiskIndicatorProject>((from, to) =>
        supabase
          .from("projects")
          .select("id,name,status,manager_name,updated_at")
          .order("name", { ascending: true })
          .range(from, to),
      ),
      fetchAllRows<RiskIndicatorTask>((from, to) =>
        supabase
          .from("tasks")
          .select("id,project_id,status")
          .order("created_at", { ascending: false })
          .range(from, to),
      ),
      fetchAllRows<RiskIndicatorChallenge>((from, to) =>
        supabase
          .from("challenges")
          .select("id,project_id,task_id,title,status,kind,risk_level,risk_score,probability_score,impact_score,mitigation_plan,created_at,updated_at")
          .order("updated_at", { ascending: false })
          .range(from, to),
      ),
    ]);

  if (projectsError) console.error("Risk indicators projects query failed", projectsError.message);
  if (tasksError) console.error("Risk indicators tasks query failed", tasksError.message);
  if (challengesError) console.error("Risk indicators challenges query failed", challengesError.message);

  const data = buildRiskIndicatorData({
    projects: (projects ?? []) as RiskIndicatorProject[],
    tasks: (tasks ?? []) as RiskIndicatorTask[],
    challenges: (challenges ?? []) as RiskIndicatorChallenge[],
  });

  return (
    <div className="page-container">
      <RiskIndicatorsClient data={data} generatedAt={new Date().toISOString()} />
    </div>
  );
}
