import { describe, expect, it } from "vitest";
import { buildKpiRadarModel, getPeriodTarget } from "../lib/kpis/radar";
import { mergeKpiValuesByPeriod } from "../lib/queries/kpis";
import type { KpiDefinition, KpiValue } from "../lib/supabase/types";

describe("KPI radar model", () => {
  it("normalizes additive annual targets into monthly and quarterly period targets", () => {
    expect(getPeriodTarget(1200, "sum", "monthly")).toBe(100);
    expect(getPeriodTarget(1200, "sum", "quarterly")).toBe(300);
    expect(getPeriodTarget(80, "average", "quarterly")).toBe(80);
  });

  it("builds annual radar values from quarterly KPI values", () => {
    const definitions = [
      kpiDefinition("REV_GOV_ANNUAL", "revenue", 1200, "ريال"),
      kpiDefinition("CLIENT_SATISFACTION", "satisfaction", 80, "%"),
      kpiDefinition("AUD_TOP_EPISODE", "top-episode", 1000, "مشاهدة"),
    ];

    const model = buildKpiRadarModel(definitions, [
      kpiValue("revenue", "monthly", "2026-05-01", "2026-05-31", 50),
    ], [
      kpiValue("revenue", "quarterly", "2026-01-01", "2026-03-31", 100),
      kpiValue("revenue", "quarterly", "2026-04-01", "2026-06-30", 200),
      kpiValue("satisfaction", "quarterly", "2026-01-01", "2026-03-31", 90),
      kpiValue("satisfaction", "quarterly", "2026-04-01", "2026-06-30", 70),
      kpiValue("top-episode", "quarterly", "2026-01-01", "2026-03-31", 500),
      kpiValue("top-episode", "quarterly", "2026-04-01", "2026-06-30", 1200),
    ], "monthly");

    const byId = Object.fromEntries(model.indicators.map((indicator) => [indicator.definition.id, indicator]));

    expect(byId.revenue.annualActual).toBe(300);
    expect(byId.revenue.currentTarget).toBe(100);
    expect(byId.revenue.currentAchievement).toBe(50);
    expect(byId.satisfaction.annualActual).toBe(80);
    expect(byId.satisfaction.annualAchievement).toBe(100);
    expect(byId["top-episode"].annualActual).toBe(1200);
    expect(byId["top-episode"].annualAchievement).toBe(100);
  });

  it("keeps the annual dashboard scoped to the selected year", () => {
    const [definition] = [kpiDefinition("REV_GOV_ANNUAL", "revenue", 1200, "ريال")];
    const model = buildKpiRadarModel(definition ? [definition] : [], [], [
      kpiValue("revenue", "quarterly", "2025-01-01", "2025-03-31", 900),
      kpiValue("revenue", "quarterly", "2026-01-01", "2026-03-31", 100),
    ], "quarterly", 2026);

    expect(model.indicators[0].annualActual).toBe(100);
    expect(model.indicators[0].quarters[0]).toMatchObject({
      key: "Q1",
      value: 100,
      target: 300,
      achievement: 33,
    });
  });

  it("keeps section dashboards scoped to their own indicators", () => {
    const revenue = { ...kpiDefinition("REV_GOV_ANNUAL", "revenue", 1200, "ريال"), perspective: "الإيرادات" };
    const audience = { ...kpiDefinition("AUD_SUBSCRIBERS_TOTAL", "audience", 400, "مشترك"), perspective: "الجمهور والمشتركين" };

    const model = buildKpiRadarModel([audience], [], [
      kpiValue(revenue.id, "quarterly", "2026-01-01", "2026-03-31", 1200),
      kpiValue(audience.id, "quarterly", "2026-01-01", "2026-03-31", 100),
    ], "quarterly", 2026);

    expect(model.indicators).toHaveLength(1);
    expect(model.indicators[0].definition.perspective).toBe("الجمهور والمشتركين");
    expect(model.indicators[0].quarters[0]).toMatchObject({
      key: "Q1",
      value: 100,
      target: 100,
      achievement: 100,
    });
    expect(model.summary.perspectives.map((item) => item.name)).toEqual(["الجمهور والمشتركين"]);
  });

  it("merges annual cache values by KPI and period", () => {
    const merged = mergeKpiValuesByPeriod([
      kpiValue("audience", "quarterly", "2026-01-01", "2026-03-31", 10),
      kpiValue("audience", "quarterly", "2026-04-01", "2026-06-30", 20),
    ], [
      kpiValue("audience", "quarterly", "2026-04-01", "2026-06-30", 30),
    ]);

    expect(merged).toHaveLength(2);
    expect(merged.map((value) => value.actual_value)).toEqual([10, 30]);
  });
});

function kpiDefinition(code: string, id: string, targetValue: number, targetUnit: string | null): KpiDefinition {
  return {
    id,
    code,
    name: code,
    description: null,
    perspective: "القسم",
    strategic_goal: null,
    measurement_label: null,
    target_value: targetValue,
    target_text: null,
    target_unit: targetUnit,
    direction: "higher_is_better",
    calculation_method: "manual",
    auto_source: null,
    frequency: "monthly",
    visibility: "management",
    owner_id: null,
    active: true,
    sort_order: 1,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
}

function kpiValue(
  kpiId: string,
  periodType: "monthly" | "quarterly",
  periodStart: string,
  periodEnd: string,
  actualValue: number
): KpiValue {
  return {
    id: `${kpiId}-${periodStart}`,
    kpi_id: kpiId,
    period_type: periodType,
    period_start: periodStart,
    period_end: periodEnd,
    actual_value: actualValue,
    actual_text: null,
    target_value: null,
    status: "neutral",
    trend: "unknown",
    source: "manual",
    notes: null,
    updated_by: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
}
