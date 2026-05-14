import { describe, expect, it } from "vitest";
import {
  buildOperationsKpiValues,
  buildProductKpiValues,
  buildQuarterlyKpiValueRollups,
  calculateSimpleWorkspaceActuals,
} from "../lib/kpis/auto-calculations";
import type { ProjectPerformanceRecord, SimpleWorkspaceRecord } from "../lib/queries/kpis";
import type { KpiDefinition, KpiValue } from "../lib/supabase/types";

const periodContext = {
  periodType: "monthly" as const,
  periodStart: "2026-05-01",
  periodEnd: "2026-05-31",
  userId: "user-1",
};

describe("KPI auto calculations", () => {
  it("maps audience metrics to the expected audience KPI codes", () => {
    const actuals = calculateSimpleWorkspaceActuals("audience", [
      audienceMetric({ platform: "YouTube", subscribers: 120, paid_views_avg: 20, organic_views_avg: 10, top_episode_views: 1000 }),
      audienceMetric({ platform: "بودكاست", subscribers: 80, paid_views_avg: 40, organic_views_avg: 30, influencer_reach: 500 }),
    ]);

    expect(actuals).toMatchObject({
      AUD_YOUTUBE_SUBS: 120,
      AUD_OTHER_PLATFORM_SUBS: 80,
      AUD_PAID_VIEWS: 30,
      AUD_ORGANIC_VIEWS: 20,
      AUD_INFLUENCER_REACH: 500,
      AUD_TOP_EPISODE: 1000,
    });
  });

  it("emits clearing values when product KPI source records are removed", () => {
    const [definition] = [kpiDefinition("PROD_TAQREERAK", "product-kpi", 5000, "indicator_products")];
    const values = buildProductKpiValues([], [definition], periodContext);

    expect(values).toHaveLength(1);
    expect(values[0]).toMatchObject({
      kpi_id: "product-kpi",
      actual_value: 0,
    });
    expect(values[0].target_value).toBeCloseTo(5000 / 12);
  });

  it("emits neutral CPI/SPI values when the last project update is removed", () => {
    const definitions = [
      kpiDefinition("OPS_CPI", "cpi", 1, "project_performance_updates"),
      kpiDefinition("OPS_SPI", "spi", 0.85, "project_performance_updates"),
      kpiDefinition("OPS_UPDATED_REPORTS", "coverage", 80, "project_performance_updates"),
    ];

    const values = buildOperationsKpiValues([], definitions, 2, periodContext);
    const byKpi = Object.fromEntries(values.map((value) => [value.kpi_id, value]));

    expect(byKpi.cpi.actual_value).toBeNull();
    expect(byKpi.cpi.status).toBe("neutral");
    expect(byKpi.spi.actual_value).toBeNull();
    expect(byKpi.coverage.actual_value).toBe(0);
  });

  it("uses one latest operations update per project when rolling up a quarter", () => {
    const definitions = [
      kpiDefinition("OPS_CPI", "cpi", 1, "project_performance_updates"),
      kpiDefinition("OPS_UPDATED_REPORTS", "coverage", 80, "project_performance_updates"),
    ];

    const values = buildOperationsKpiValues([
      performanceUpdate({ id: "older", period_start: "2026-04-01", period_end: "2026-04-30", actual_progress: 10, actual_cost: 1000 }),
      performanceUpdate({ id: "latest", period_start: "2026-05-01", period_end: "2026-05-31", actual_progress: 50, actual_cost: 500 }),
    ], definitions, 2, {
      ...periodContext,
      periodType: "quarterly",
      periodStart: "2026-04-01",
      periodEnd: "2026-06-30",
    });
    const byKpi = Object.fromEntries(values.map((value) => [value.kpi_id, value]));

    expect(byKpi.cpi.actual_value).toBe(1);
    expect(byKpi.coverage.actual_value).toBe(50);
  });

  it("rolls monthly KPI values into quarterly values without dropping existing Q1 cache entries", () => {
    const definitions = [
      kpiDefinition("REV_GOV_ANNUAL", "revenue", 1200, "revenue_entries"),
      kpiDefinition("CLIENT_SATISFACTION", "satisfaction", 80, "client_opportunities"),
      kpiDefinition("AUD_TOP_EPISODE", "top-episode", 1000, "audience_metrics"),
    ];

    const values = buildQuarterlyKpiValueRollups([
      kpiValue("revenue", "2026-04-01", "2026-04-30", 100),
      kpiValue("revenue", "2026-05-01", "2026-05-31", 200),
      kpiValue("satisfaction", "2026-04-01", "2026-04-30", 90),
      kpiValue("satisfaction", "2026-05-01", "2026-05-31", 70),
      kpiValue("top-episode", "2026-04-01", "2026-04-30", 500),
      kpiValue("top-episode", "2026-05-01", "2026-05-31", 1200),
    ], definitions, {
      periodStart: "2026-04-01",
      periodEnd: "2026-06-30",
      userId: "user-1",
    });
    const byKpi = Object.fromEntries(values.map((value) => [value.kpi_id, value]));

    expect(byKpi.revenue.actual_value).toBe(300);
    expect(byKpi.revenue.target_value).toBe(300);
    expect(byKpi.satisfaction.actual_value).toBe(80);
    expect(byKpi.satisfaction.target_value).toBe(80);
    expect(byKpi["top-episode"].actual_value).toBe(1200);
    expect(byKpi["top-episode"].target_value).toBe(1000);
  });
});

function kpiDefinition(code: string, id: string, targetValue: number, autoSource: string | null): KpiDefinition {
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
    target_unit: null,
    direction: "higher_is_better",
    calculation_method: "semi_auto",
    auto_source: autoSource,
    frequency: "monthly",
    visibility: "management",
    owner_id: null,
    active: true,
    sort_order: 1,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
}

function audienceMetric(patch: Partial<Extract<SimpleWorkspaceRecord, { platform: string }>>): SimpleWorkspaceRecord {
  return {
    id: patch.id ?? `audience-${patch.platform ?? "youtube"}`,
    metric_date: patch.metric_date ?? "2026-05-10",
    platform: patch.platform ?? "YouTube",
    subscribers: patch.subscribers ?? 0,
    paid_views_avg: patch.paid_views_avg ?? 0,
    organic_views_avg: patch.organic_views_avg ?? 0,
    top_episode_views: patch.top_episode_views ?? 0,
    influencer_reach: patch.influencer_reach ?? 0,
    notes: null,
    created_by: null,
    created_at: "2026-05-10T00:00:00Z",
    updated_at: "2026-05-10T00:00:00Z",
  };
}

function performanceUpdate(patch: Partial<ProjectPerformanceRecord>): ProjectPerformanceRecord {
  return {
    id: patch.id ?? "performance-1",
    project_id: patch.project_id ?? "project-1",
    period_type: patch.period_type ?? "monthly",
    period_start: patch.period_start ?? "2026-05-01",
    period_end: patch.period_end ?? "2026-05-31",
    planned_progress: patch.planned_progress ?? 50,
    actual_progress: patch.actual_progress ?? 50,
    actual_cost: patch.actual_cost ?? 500,
    notes: null,
    updated_by: null,
    created_at: patch.created_at ?? "2026-05-01T00:00:00Z",
    updated_at: patch.updated_at ?? "2026-05-01T00:00:00Z",
    project: {
      id: patch.project?.id ?? "project-1",
      name: patch.project?.name ?? "Project",
      manager_id: patch.project?.manager_id ?? null,
      total_budget: patch.project?.total_budget ?? 1000,
      progress: patch.project?.progress ?? 0,
    },
  };
}

function kpiValue(kpiId: string, periodStart: string, periodEnd: string, actualValue: number): KpiValue {
  return {
    id: `${kpiId}-${periodStart}`,
    kpi_id: kpiId,
    period_type: "monthly",
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
