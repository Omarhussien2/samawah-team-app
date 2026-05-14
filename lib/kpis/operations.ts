import type { ProjectPerformanceRecord } from "@/lib/queries/kpis";

export type PerformanceMetrics = {
  pv: number | null;
  ev: number | null;
  cpi: number | null;
  spi: number | null;
  warnings: string[];
  status: "green" | "yellow" | "red" | "neutral";
};

export function calculateProjectPerformance(update: ProjectPerformanceRecord): PerformanceMetrics {
  const budget = update.project?.total_budget ?? null;
  const warnings: string[] = [];

  if (budget === null || budget <= 0) warnings.push("لا توجد ميزانية صالحة للمشروع");
  if (update.actual_cost === 0) warnings.push("التكلفة الفعلية صفر");
  if (update.planned_progress === 0) warnings.push("نسبة الإنجاز المخطط صفر");

  const pv = budget && budget > 0 ? budget * (update.planned_progress / 100) : null;
  const ev = budget && budget > 0 ? budget * (update.actual_progress / 100) : null;
  const cpi = ev !== null && update.actual_cost > 0 ? ev / update.actual_cost : null;
  const spi = update.planned_progress > 0 ? update.actual_progress / update.planned_progress : null;

  let status: PerformanceMetrics["status"] = "neutral";
  if (warnings.length === 0 && cpi !== null && spi !== null) {
    if (cpi >= 1 && spi >= 1) status = "green";
    else if (cpi >= 0.85 && spi >= 0.85) status = "yellow";
    else status = "red";
  }

  return { pv, ev, cpi, spi, warnings, status };
}

export function averageMetric(records: ProjectPerformanceRecord[], key: "cpi" | "spi") {
  const values = records
    .map((record) => calculateProjectPerformance(record)[key])
    .filter((value): value is number => value !== null && Number.isFinite(value));

  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
