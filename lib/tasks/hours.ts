export interface TaskHourSummary {
  planned: number;
  actual: number;
  remaining: number | null;
  overrun: number;
  utilization: number | null;
  hasPlan: boolean;
  isOverPlan: boolean;
  label: string;
}

export function normalizeHours(value: number | null | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) return 0;
  return Math.max(0, value);
}

export function formatHours(value: number | null | undefined) {
  const hours = normalizeHours(value);
  return new Intl.NumberFormat("ar-EG-u-nu-arab", {
    maximumFractionDigits: 2,
    minimumFractionDigits: hours % 1 === 0 ? 0 : 2,
  }).format(hours);
}

export function getTaskHourSummary({
  plannedHours,
  actualHours,
}: {
  plannedHours: number | null | undefined;
  actualHours: number | null | undefined;
}): TaskHourSummary {
  const planned = normalizeHours(plannedHours);
  const actual = normalizeHours(actualHours);
  const hasPlan = planned > 0;
  const isOverPlan = hasPlan && actual > planned;
  const remaining = hasPlan ? Math.max(0, planned - actual) : null;
  const overrun = isOverPlan ? actual - planned : 0;
  const utilization = hasPlan ? Math.round((actual / planned) * 100) : null;

  let label = "بدون مخطط";
  if (hasPlan && isOverPlan) label = "زائد عن المخطط";
  else if (hasPlan) label = "ضمن المخطط";

  return {
    planned,
    actual,
    remaining,
    overrun,
    utilization,
    hasPlan,
    isOverPlan,
    label,
  };
}
