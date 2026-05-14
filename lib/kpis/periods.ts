import type { KpiPeriodType } from "@/lib/supabase/types";

export interface KpiPeriodOption {
  label: string;
  periodType: KpiPeriodType;
  periodStart: string;
  periodEnd: string;
}

const MONTH_LABELS = [
  "يناير",
  "فبراير",
  "مارس",
  "أبريل",
  "مايو",
  "يونيو",
  "يوليو",
  "أغسطس",
  "سبتمبر",
  "أكتوبر",
  "نوفمبر",
  "ديسمبر",
];

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function getMonthlyPeriods(year = 2026): KpiPeriodOption[] {
  return MONTH_LABELS.map((label, index) => {
    const start = new Date(Date.UTC(year, index, 1));
    const end = new Date(Date.UTC(year, index + 1, 0));
    return {
      label: `${label} ${year}`,
      periodType: "monthly",
      periodStart: isoDate(start),
      periodEnd: isoDate(end),
    };
  });
}

export function getQuarterlyPeriods(year = 2026): KpiPeriodOption[] {
  return [0, 1, 2, 3].map((quarter) => {
    const startMonth = quarter * 3;
    const start = new Date(Date.UTC(year, startMonth, 1));
    const end = new Date(Date.UTC(year, startMonth + 3, 0));
    return {
      label: `الربع ${quarter + 1} ${year}`,
      periodType: "quarterly",
      periodStart: isoDate(start),
      periodEnd: isoDate(end),
    };
  });
}

export function getPeriodOptions(periodType: KpiPeriodType, year = 2026) {
  return periodType === "monthly" ? getMonthlyPeriods(year) : getQuarterlyPeriods(year);
}

export function getCurrentKpiPeriod(periodType: KpiPeriodType, year = 2026) {
  const now = new Date();
  const index = now.getUTCFullYear() === year ? now.getUTCMonth() : 0;
  if (periodType === "quarterly") return getQuarterlyPeriods(year)[Math.floor(index / 3)];
  return getMonthlyPeriods(year)[index];
}

export function findPeriodOption(
  periodType: KpiPeriodType,
  periodStart: string,
  year = 2026
) {
  return getPeriodOptions(periodType, year).find((period) => period.periodStart === periodStart)
    ?? getCurrentKpiPeriod(periodType, year);
}
