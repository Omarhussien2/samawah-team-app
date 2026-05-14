import { calculateKpiAchievement, calculateKpiStatus } from "@/lib/kpis/status";
import type { KpiDefinition, KpiPeriodType, KpiStatus, KpiValue } from "@/lib/supabase/types";

export type KpiRadarAggregation = "sum" | "average" | "max";
export type KpiRadarQuarterKey = "Q1" | "Q2" | "Q3" | "Q4";

export type KpiRadarQuarter = {
  key: KpiRadarQuarterKey;
  label: string;
  value: number | null;
  target: number | null;
  achievement: number | null;
  status: KpiStatus;
};

export type KpiRadarIndicator = {
  definition: KpiDefinition;
  aggregation: KpiRadarAggregation;
  sourceLabel: string;
  currentValue: KpiValue | null;
  currentActual: number | null;
  currentTarget: number | null;
  currentAchievement: number | null;
  currentStatus: KpiStatus;
  annualActual: number | null;
  annualTarget: number | null;
  annualAchievement: number | null;
  annualStatus: KpiStatus;
  quarters: KpiRadarQuarter[];
  lastUpdatedAt: string | null;
};

export type KpiRadarPerspective = {
  name: string;
  count: number;
  achieved: number;
  attention: number;
  averageAchievement: number;
};

export type KpiRadarQuarterPerformance = {
  key: KpiRadarQuarterKey;
  label: string;
  achievement: number;
};

export type KpiRadarSummary = {
  total: number;
  achieved: number;
  attention: number;
  noData: number;
  averageAchievement: number;
  perspectives: KpiRadarPerspective[];
  quarters: KpiRadarQuarterPerformance[];
  critical: KpiRadarIndicator[];
};

export type KpiRadarModel = {
  indicators: KpiRadarIndicator[];
  summary: KpiRadarSummary;
};

const QUARTERS: { key: KpiRadarQuarterKey; label: string; startMonth: number }[] = [
  { key: "Q1", label: "الربع 1", startMonth: 1 },
  { key: "Q2", label: "الربع 2", startMonth: 4 },
  { key: "Q3", label: "الربع 3", startMonth: 7 },
  { key: "Q4", label: "الربع 4", startMonth: 10 },
];

const AVERAGE_CODES = new Set([
  "CLIENT_SATISFACTION",
  "AUD_PAID_VIEWS",
  "AUD_ORGANIC_VIEWS",
  "OPS_CPI",
  "OPS_SPI",
  "OPS_UPDATED_REPORTS",
  "OPS_ISO_21500",
  "OPS_PM_COMPLIANCE",
  "OPS_PROGRAM_INTEGRATION",
  "OPS_REVISION_ROUNDS",
  "OPS_RISK_COVERAGE",
]);

const MAX_CODES = new Set(["AUD_TOP_EPISODE"]);

export function buildKpiRadarModel(
  definitions: KpiDefinition[],
  currentValues: KpiValue[],
  yearValues: KpiValue[],
  selectedPeriodType: KpiPeriodType
): KpiRadarModel {
  const currentByKpi = new Map(currentValues.map((value) => [value.kpi_id, value]));
  const quarterlyByKpi = groupQuarterValuesByKpi(yearValues);

  const indicators = definitions.map((definition) => {
    const aggregation = getKpiRadarAggregation(definition);
    const currentValue = currentByKpi.get(definition.id) ?? null;
    const currentTarget = getPeriodTarget(definition.target_value, aggregation, selectedPeriodType);
    const currentAchievement = calculateAchievement(definition, currentValue?.actual_value ?? null, currentTarget);
    const currentStatus = calculateKpiStatus({ ...definition, target_value: currentTarget }, currentValue?.actual_value);
    const quarterValues = quarterlyByKpi.get(definition.id) ?? new Map<KpiRadarQuarterKey, KpiValue>();
    const quarters = QUARTERS.map(({ key, label }) => {
      const quarterValue = quarterValues.get(key) ?? null;
      const quarterTarget = getPeriodTarget(definition.target_value, aggregation, "quarterly");
      const achievement = calculateAchievement(definition, quarterValue?.actual_value ?? null, quarterTarget);
      return {
        key,
        label,
        value: quarterValue?.actual_value ?? null,
        target: quarterTarget,
        achievement,
        status: calculateKpiStatus({ ...definition, target_value: quarterTarget }, quarterValue?.actual_value),
      };
    });
    const annualActual = aggregateQuarterValues(quarters.map((quarter) => quarter.value), aggregation);
    const annualAchievement = calculateAchievement(definition, annualActual, definition.target_value);

    return {
      definition,
      aggregation,
      sourceLabel: getSourceLabel(definition),
      currentValue,
      currentActual: currentValue?.actual_value ?? null,
      currentTarget,
      currentAchievement,
      currentStatus,
      annualActual,
      annualTarget: definition.target_value,
      annualAchievement,
      annualStatus: calculateKpiStatus(definition, annualActual),
      quarters,
      lastUpdatedAt: getLatestUpdatedAt([currentValue, ...Array.from(quarterValues.values())]),
    };
  });

  return {
    indicators,
    summary: buildRadarSummary(indicators),
  };
}

export function getKpiRadarAggregation(definition: Pick<KpiDefinition, "code" | "name" | "target_unit">): KpiRadarAggregation {
  if (MAX_CODES.has(definition.code)) return "max";
  if (AVERAGE_CODES.has(definition.code)) return "average";
  if (definition.name.includes("متوسط")) return "average";
  if (definition.target_unit === "%" && !definition.code.includes("COVERAGE")) return "average";
  return "sum";
}

export function getPeriodTarget(
  annualTarget: number | null | undefined,
  aggregation: KpiRadarAggregation,
  periodType: KpiPeriodType
) {
  if (annualTarget === null || annualTarget === undefined) return null;
  if (aggregation !== "sum") return annualTarget;
  return periodType === "monthly" ? annualTarget / 12 : annualTarget / 4;
}

function buildRadarSummary(indicators: KpiRadarIndicator[]): KpiRadarSummary {
  const achieved = indicators.filter((indicator) => (indicator.annualAchievement ?? 0) >= 100).length;
  const attention = indicators.filter((indicator) => indicator.annualStatus === "red" || indicator.annualStatus === "yellow").length;
  const noData = indicators.filter((indicator) => indicator.annualActual === null).length;
  const averageAchievement = average(indicators.map((indicator) => indicator.annualAchievement ?? 0));
  const perspectives = Object.values(
    indicators.reduce<Record<string, KpiRadarPerspective>>((acc, indicator) => {
      const name = indicator.definition.perspective;
      acc[name] ??= { name, count: 0, achieved: 0, attention: 0, averageAchievement: 0 };
      acc[name].count += 1;
      if ((indicator.annualAchievement ?? 0) >= 100) acc[name].achieved += 1;
      if (indicator.annualStatus === "red" || indicator.annualStatus === "yellow") acc[name].attention += 1;
      acc[name].averageAchievement += indicator.annualAchievement ?? 0;
      return acc;
    }, {})
  ).map((perspective) => ({
    ...perspective,
    averageAchievement: perspective.count ? Math.round(perspective.averageAchievement / perspective.count) : 0,
  }));

  const quarters = QUARTERS.map(({ key, label }) => ({
    key,
    label,
    achievement: Math.round(average(indicators.map((indicator) => indicator.quarters.find((quarter) => quarter.key === key)?.achievement ?? 0))),
  }));

  return {
    total: indicators.length,
    achieved,
    attention,
    noData,
    averageAchievement: Math.round(averageAchievement),
    perspectives,
    quarters,
    critical: indicators
      .filter((indicator) => indicator.annualStatus === "red" || indicator.annualStatus === "yellow")
      .sort((a, b) => (a.annualAchievement ?? 0) - (b.annualAchievement ?? 0))
      .slice(0, 6),
  };
}

function groupQuarterValuesByKpi(values: KpiValue[]) {
  return values.reduce<Map<string, Map<KpiRadarQuarterKey, KpiValue>>>((acc, value) => {
    if (value.period_type !== "quarterly") return acc;
    const quarter = getQuarterKey(value.period_start);
    if (!quarter) return acc;
    const byQuarter = acc.get(value.kpi_id) ?? new Map<KpiRadarQuarterKey, KpiValue>();
    byQuarter.set(quarter, value);
    acc.set(value.kpi_id, byQuarter);
    return acc;
  }, new Map());
}

function getQuarterKey(periodStart: string): KpiRadarQuarterKey | null {
  const month = Number(periodStart.slice(5, 7));
  if (month >= 1 && month <= 3) return "Q1";
  if (month >= 4 && month <= 6) return "Q2";
  if (month >= 7 && month <= 9) return "Q3";
  if (month >= 10 && month <= 12) return "Q4";
  return null;
}

function aggregateQuarterValues(values: (number | null)[], aggregation: KpiRadarAggregation) {
  const usable = values.filter((value): value is number => value !== null && Number.isFinite(value));
  if (usable.length === 0) return null;
  if (aggregation === "average") return average(usable);
  if (aggregation === "max") return Math.max(...usable);
  return usable.reduce((sum, value) => sum + value, 0);
}

function calculateAchievement(
  definition: Pick<KpiDefinition, "direction">,
  actual: number | null,
  target: number | null | undefined
) {
  const achievement = calculateKpiAchievement(actual, target, definition.direction);
  return achievement === null ? null : Math.round(achievement);
}

function average(values: number[]) {
  const usable = values.filter((value) => Number.isFinite(value));
  return usable.length ? usable.reduce((sum, value) => sum + value, 0) / usable.length : 0;
}

function getLatestUpdatedAt(values: (KpiValue | null)[]) {
  return values
    .map((value) => value?.updated_at ?? null)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1) ?? null;
}

function getSourceLabel(definition: Pick<KpiDefinition, "calculation_method" | "auto_source">) {
  if (definition.auto_source === "audience_metrics") return "الجمهور";
  if (definition.auto_source === "revenue_entries") return "الإيرادات";
  if (definition.auto_source === "indicator_products") return "المنتجات";
  if (definition.auto_source === "project_performance_updates") return "أداء المشاريع";
  if (definition.calculation_method === "manual") return "يدوي";
  if (definition.calculation_method === "semi_auto") return "شبه تلقائي";
  return "تلقائي";
}
