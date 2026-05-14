import type { KpiDefinition, KpiPeriodType } from "@/lib/supabase/types";

export type KpiAggregation = "sum" | "average" | "max";

const KPI_AGGREGATION_BY_CODE: Record<string, KpiAggregation> = {
  CLIENT_SATISFACTION: "average",
  AUD_PAID_VIEWS: "average",
  AUD_ORGANIC_VIEWS: "average",
  AUD_TOP_EPISODE: "max",
  OPS_CPI: "average",
  OPS_SPI: "average",
  OPS_UPDATED_REPORTS: "average",
  OPS_ISO_21500: "average",
  OPS_PM_COMPLIANCE: "average",
  OPS_PROGRAM_INTEGRATION: "average",
  OPS_REVISION_ROUNDS: "average",
  OPS_RISK_COVERAGE: "average",
};

export function getKpiAggregation(
  definition: Pick<KpiDefinition, "code" | "target_unit" | "calculation_method" | "auto_source">
): KpiAggregation {
  const mapped = KPI_AGGREGATION_BY_CODE[definition.code];
  if (mapped) return mapped;

  if (
    definition.target_unit === "%"
    || (definition.auto_source === "project_performance_updates" && definition.calculation_method !== "manual")
  ) {
    return "average";
  }

  return "sum";
}

export function getPeriodTarget(
  annualTarget: number | null | undefined,
  aggregation: KpiAggregation,
  periodType: KpiPeriodType
) {
  if (annualTarget === null || annualTarget === undefined) return null;
  if (aggregation !== "sum") return annualTarget;
  return periodType === "monthly" ? annualTarget / 12 : annualTarget / 4;
}

export function getKpiPeriodTarget(
  definition: Pick<KpiDefinition, "code" | "target_value" | "target_unit" | "calculation_method" | "auto_source">,
  periodType: KpiPeriodType
) {
  return getPeriodTarget(definition.target_value, getKpiAggregation(definition), periodType);
}

export function aggregateKpiActuals(values: (number | null)[], aggregation: KpiAggregation) {
  const usable = values.filter((value): value is number => value !== null && Number.isFinite(value));
  if (usable.length === 0) return null;
  if (aggregation === "average") return usable.reduce((sum, value) => sum + value, 0) / usable.length;
  if (aggregation === "max") return Math.max(...usable);
  return usable.reduce((sum, value) => sum + value, 0);
}
