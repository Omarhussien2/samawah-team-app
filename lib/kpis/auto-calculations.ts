import { averageMetric, selectLatestProjectPerformanceByProject } from "@/lib/kpis/operations";
import { aggregateKpiActuals, getKpiAggregation, getKpiPeriodTarget } from "@/lib/kpis/aggregation";
import { calculateKpiStatus } from "@/lib/kpis/status";
import { summarizeChallenges } from "@/lib/challenges/risk";
import type { ChallengeRiskRecord, KpiValueUpsert, ProjectPerformanceRecord, SimpleWorkspaceKind, SimpleWorkspaceRecord } from "@/lib/queries/kpis";
import type { IndicatorProduct, KpiDefinition, KpiPeriodType, KpiValue } from "@/lib/supabase/types";

type KpiValueContext = {
  periodType: KpiPeriodType;
  periodStart: string;
  periodEnd: string;
  userId: string;
  notes: string;
};

const SIMPLE_WORKSPACE_TITLES: Record<SimpleWorkspaceKind, string> = {
  revenue: "مساحة الإيرادات",
  clients: "مساحة العقود والعملاء",
  audience: "مساحة الجمهور والمشتركين",
  services: "مساحة البرامج والخدمات",
  partnerships: "مساحة الشراكات والتموضع",
};

export function buildSimpleWorkspaceKpiValues(
  kind: SimpleWorkspaceKind,
  records: SimpleWorkspaceRecord[],
  definitions: KpiDefinition[],
  context: Omit<KpiValueContext, "notes">
) {
  const actuals = calculateSimpleWorkspaceActuals(kind, records);
  return buildKpiValuesFromCodes(actuals, definitions, {
    ...context,
    notes: `تحديث تلقائي من ${SIMPLE_WORKSPACE_TITLES[kind]}`,
  });
}

export function buildProductKpiValues(
  products: IndicatorProduct[],
  definitions: KpiDefinition[],
  context: Omit<KpiValueContext, "notes">
) {
  const activeProducts = products.filter((product) => product.status !== "archived");
  const productDefinitions = definitions.filter((definition) => definition.auto_source === "indicator_products");

  return productDefinitions.map((definition) => {
    const actual = activeProducts
      .filter((product) => product.kpi_id === definition.id)
      .reduce((sum, product) => sum + Number(product.current_value ?? 0), 0);

    return toKpiValueUpsert(definition, actual, {
      ...context,
      notes: "تحديث تلقائي من مساحة المنتجات",
    });
  });
}

export function buildOperationsKpiValues(
  updates: ProjectPerformanceRecord[],
  definitions: KpiDefinition[],
  projectCount: number,
  context: Omit<KpiValueContext, "notes">
) {
  const latestUpdates = selectLatestProjectPerformanceByProject(updates);
  const actuals = {
    OPS_CPI: averageMetric(latestUpdates, "cpi"),
    OPS_SPI: averageMetric(latestUpdates, "spi"),
    OPS_UPDATED_REPORTS: projectCount ? Math.min(100, Math.round((latestUpdates.length / projectCount) * 100)) : null,
  };

  return buildKpiValuesFromCodes(actuals, definitions, {
    ...context,
    notes: "تحديث تلقائي من مساحة العمليات والمشاريع",
  });
}

export function buildChallengeRiskKpiValues(
  challenges: ChallengeRiskRecord[],
  definitions: KpiDefinition[],
  context: Omit<KpiValueContext, "notes">
) {
  const summary = summarizeChallenges(challenges);
  return buildKpiValuesFromCodes(
    {
      OPS_RISK_COVERAGE: summary.riskCoverage,
    },
    definitions,
    {
      ...context,
      notes: "تحديث تلقائي من سجل التحديات والمخاطر",
    }
  );
}

export function calculateSimpleWorkspaceActuals(
  kind: SimpleWorkspaceKind,
  records: SimpleWorkspaceRecord[]
): Record<string, number | null> {
  if (kind === "revenue") {
    const rows = records.filter(isRevenue).filter((row) => row.status !== "expected");
    return {
      REV_GOV_ANNUAL: sum(rows.filter((row) => row.revenue_type === "government"), "amount"),
      REV_NON_GOV: sum(rows.filter((row) => row.revenue_type === "non_government"), "amount"),
      REV_PRODUCTS: sum(rows.filter((row) => row.revenue_type === "product"), "amount"),
    };
  }

  if (kind === "clients") {
    const rows = records.filter(isClient);
    return {
      CLIENT_STRATEGIC: rows.filter((row) => row.record_type === "strategic_client" && row.status !== "lost").length,
      CLIENT_NEW: rows.filter((row) => row.record_type === "new_client" && row.status === "won").length,
      CLIENT_PROPOSALS: rows.filter((row) => row.record_type === "proposal").length,
      CLIENT_SATISFACTION: average(rows.map((row) => row.satisfaction_score)),
      CLIENT_REPEAT: rows.filter((row) => row.record_type === "repeat_client" || row.status === "repeat").length,
    };
  }

  if (kind === "audience") {
    const rows = records.filter(isAudience);
    return {
      AUD_YOUTUBE_SUBS: sum(rows.filter((row) => isYoutubePlatform(row.platform)), "subscribers"),
      AUD_OTHER_PLATFORM_SUBS: sum(rows.filter((row) => !isYoutubePlatform(row.platform)), "subscribers"),
      AUD_PAID_VIEWS: average(rows.map((row) => row.paid_views_avg)),
      AUD_ORGANIC_VIEWS: average(rows.map((row) => row.organic_views_avg)),
      AUD_INFLUENCER_REACH: sum(rows, "influencer_reach"),
      AUD_TOP_EPISODE: rows.length ? Math.max(...rows.map((row) => row.top_episode_views)) : null,
    };
  }

  if (kind === "services") {
    const rows = records.filter(isService).filter((row) => row.status === "completed");
    return {
      SERV_PODCAST: sum(rows.filter((row) => row.output_type === "podcast"), "quantity"),
      SERV_YOUTUBE_PROGRAMS: sum(rows.filter((row) => row.output_type === "youtube_program"), "quantity"),
      SERV_MEDIA_REPORTS: sum(rows.filter((row) => row.output_type === "media_report"), "quantity"),
    };
  }

  const rows = records.filter(isPartnership).filter((row) => row.status === "confirmed" || row.status === "completed");
  return {
    PART_AWARDS: rows.filter((row) => row.activity_type === "award").length,
    PART_SPONSORSHIPS: rows.filter((row) => row.activity_type === "sponsorship").length,
    PART_EVENTS: rows.filter((row) => row.activity_type === "event").length,
    PART_PRODUCT_SPONSORS: rows.filter((row) => row.activity_type === "product_sponsor").length,
    PART_INTEGRATIONS: rows.filter((row) => row.activity_type === "partnership").length,
    PART_SPEAKING: rows.filter((row) => row.activity_type === "speaker").length,
  };
}

export function buildQuarterlyKpiValueRollups(
  monthlyValues: KpiValue[],
  definitions: KpiDefinition[],
  context: Omit<KpiValueContext, "periodType" | "notes">
) {
  return definitions.map((definition) => {
    const aggregation = getKpiAggregation(definition);
    const actual = aggregateKpiActuals(
      monthlyValues
        .filter((value) => value.kpi_id === definition.id)
        .map((value) => value.actual_value),
      aggregation
    );

    return toKpiValueUpsert(definition, actual, {
      ...context,
      periodType: "quarterly",
      notes: "تجميع تلقائي من القيم الشهرية",
    });
  });
}

function buildKpiValuesFromCodes(
  actuals: Record<string, number | null>,
  definitions: KpiDefinition[],
  context: KpiValueContext
) {
  return Object.entries(actuals).reduce<KpiValueUpsert[]>((acc, [code, actual]) => {
    const definition = definitions.find((item) => item.code === code);
    if (!definition) return acc;
    acc.push(toKpiValueUpsert(definition, actual, context));
    return acc;
  }, []);
}

function toKpiValueUpsert(
  definition: KpiDefinition,
  actual: number | null,
  context: KpiValueContext
): KpiValueUpsert {
  const periodTarget = getKpiPeriodTarget(definition, context.periodType);
  return {
    kpi_id: definition.id,
    period_type: context.periodType,
    period_start: context.periodStart,
    period_end: context.periodEnd,
    actual_value: actual,
    target_value: periodTarget,
    status: calculateKpiStatus({ ...definition, target_value: periodTarget }, actual),
    trend: "unknown",
    source: "semi_auto",
    notes: context.notes,
    updated_by: context.userId,
  };
}

function isYoutubePlatform(platform: string) {
  const normalized = platform.trim().toLowerCase();
  return normalized.includes("يوتيوب") || normalized.includes("youtube") || normalized.includes("yt");
}

function sum<T>(rows: T[], key: keyof T) {
  return rows.reduce((total, row) => total + Number(row[key] ?? 0), 0);
}

function average(values: (number | null)[]) {
  const usable = values.filter((item): item is number => item !== null && Number.isFinite(item));
  return usable.length ? usable.reduce((total, item) => total + item, 0) / usable.length : null;
}

function isRevenue(record: SimpleWorkspaceRecord): record is Extract<SimpleWorkspaceRecord, { revenue_type: string }> {
  return "revenue_type" in record;
}

function isClient(record: SimpleWorkspaceRecord): record is Extract<SimpleWorkspaceRecord, { client_name: string; record_type: string }> {
  return "record_type" in record;
}

function isAudience(record: SimpleWorkspaceRecord): record is Extract<SimpleWorkspaceRecord, { platform: string }> {
  return "platform" in record;
}

function isService(record: SimpleWorkspaceRecord): record is Extract<SimpleWorkspaceRecord, { output_type: string }> {
  return "output_type" in record;
}

function isPartnership(record: SimpleWorkspaceRecord): record is Extract<SimpleWorkspaceRecord, { activity_type: string }> {
  return "activity_type" in record;
}
