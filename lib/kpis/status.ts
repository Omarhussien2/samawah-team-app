import type { KpiDefinition, KpiStatus, KpiValue } from "@/lib/supabase/types";

export const KPI_STATUS_LABELS: Record<KpiStatus, string> = {
  green: "ممتاز",
  yellow: "بحاجة متابعة",
  red: "متعثر",
  neutral: "بلا بيانات",
};

export const KPI_STATUS_STYLES: Record<KpiStatus, string> = {
  green: "bg-emerald-50 text-emerald-700 border-emerald-200",
  yellow: "bg-amber-50 text-amber-700 border-amber-200",
  red: "bg-rose-50 text-rose-700 border-rose-200",
  neutral: "bg-slate-50 text-slate-600 border-slate-200",
};

export function calculateKpiAchievement(
  actualValue: number | null | undefined,
  targetValue: number | null | undefined,
  direction: KpiDefinition["direction"] = "higher_is_better"
) {
  if (actualValue === null || actualValue === undefined || targetValue === null || targetValue === undefined) return null;
  if (targetValue === 0) return actualValue === 0 ? 100 : null;

  if (direction === "lower_is_better") {
    if (actualValue <= 0) return 100;
    return Math.max(0, Math.min(100, (targetValue / actualValue) * 100));
  }

  return Math.max(0, Math.min(100, (actualValue / targetValue) * 100));
}

export function calculateKpiStatus(
  definition: Pick<KpiDefinition, "code" | "direction" | "target_value">,
  actualValue: number | null | undefined
): KpiStatus {
  if (actualValue === null || actualValue === undefined || definition.target_value === null) return "neutral";

  if (definition.code === "OPS_CPI") {
    if (actualValue >= 1) return "green";
    if (actualValue >= 0.85) return "yellow";
    return "red";
  }

  if (definition.code === "OPS_SPI") {
    if (actualValue >= 1) return "green";
    if (actualValue >= 0.85) return "yellow";
    return "red";
  }

  if (definition.direction === "lower_is_better") {
    if (actualValue <= definition.target_value) return "green";
    if (actualValue <= definition.target_value * 1.25) return "yellow";
    return "red";
  }

  const achievement = calculateKpiAchievement(actualValue, definition.target_value, definition.direction);
  if (achievement === null) return "neutral";
  if (achievement >= 90) return "green";
  if (achievement >= 70) return "yellow";
  return "red";
}

export function getKpiStatusLabel(status: KpiStatus | null | undefined) {
  return KPI_STATUS_LABELS[status ?? "neutral"];
}

export function getKpiStatusStyle(status: KpiStatus | null | undefined) {
  return KPI_STATUS_STYLES[status ?? "neutral"];
}

export function formatKpiValue(value: number | null | undefined, unit?: string | null) {
  if (value === null || value === undefined) return "لا توجد قيمة";
  const formatted = new Intl.NumberFormat("ar-SA", {
    maximumFractionDigits: Number.isInteger(value) ? 0 : 2,
  }).format(value);
  return unit ? `${formatted} ${unit}` : formatted;
}

export function getValueForKpi(values: KpiValue[], kpiId: string) {
  return values.find((value) => value.kpi_id === kpiId) ?? null;
}

export function summarizeKpiStatuses(definitions: KpiDefinition[], values: KpiValue[]) {
  return definitions.reduce<Record<KpiStatus, number>>(
    (summary, definition) => {
      const value = getValueForKpi(values, definition.id);
      const status = calculateKpiStatus(definition, value?.actual_value);
      summary[status] += 1;
      return summary;
    },
    { green: 0, yellow: 0, red: 0, neutral: 0 }
  );
}
