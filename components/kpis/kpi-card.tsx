"use client";

import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { getKpiAggregation, getKpiPeriodTarget } from "@/lib/kpis/aggregation";
import {
  calculateKpiAchievement,
  calculateKpiStatus,
  formatKpiValue,
  getKpiStatusLabel,
  getKpiStatusStyle,
} from "@/lib/kpis/status";
import type { KpiDefinition, KpiPeriodType, KpiValue } from "@/lib/supabase/types";

interface KpiCardProps {
  definition: KpiDefinition;
  value?: KpiValue | null;
  periodType?: KpiPeriodType;
}

export function KpiCard({ definition, value, periodType = "monthly" }: KpiCardProps) {
  const actualValue = value?.actual_value ?? null;
  const aggregation = getKpiAggregation(definition);
  const targetValue = getKpiPeriodTarget(definition, periodType);
  const status = calculateKpiStatus({ ...definition, target_value: targetValue }, actualValue);
  const achievement = calculateKpiAchievement(actualValue, targetValue, definition.direction);
  const progress = achievement === null ? 0 : Math.round(achievement);

  const TrendIcon = value?.trend === "up" ? ArrowUp : value?.trend === "down" ? ArrowDown : Minus;

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-slate-500">{definition.strategic_goal ?? definition.perspective}</p>
          <h3 className="mt-1 line-clamp-2 text-sm font-bold text-slate-900">{definition.name}</h3>
        </div>
        <span className={cn("shrink-0 rounded-full border px-2 py-1 text-xs font-bold", getKpiStatusStyle(status))}>
          {getKpiStatusLabel(status)}
        </span>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs text-slate-500">القيمة الحالية</p>
          <p className="mt-1 text-lg font-extrabold text-slate-900">{formatKpiValue(actualValue, definition.target_unit)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">المستهدف</p>
          <p className="mt-1 text-sm font-bold text-slate-700">{formatKpiValue(targetValue, definition.target_unit)}</p>
        </div>
      </div>

      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
          <span>نسبة الإنجاز</span>
          <span className="font-bold text-slate-700">{achievement === null ? "غير متاح" : `${progress}%`}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              status === "green" && "bg-emerald-500",
              status === "yellow" && "bg-amber-500",
              status === "red" && "bg-rose-500",
              status === "neutral" && "bg-slate-300"
            )}
            style={{ width: `${Math.min(100, progress)}%` }}
          />
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
        <span>
          {definition.calculation_method === "manual" ? "يدوي" : definition.calculation_method === "semi_auto" ? "شبه تلقائي" : "تلقائي"}
          {" · "}
          {aggregation === "sum" ? "تجميعي" : aggregation === "average" ? "متوسط" : "أعلى قيمة"}
        </span>
        <span className="flex items-center gap-1">
          <TrendIcon size={13} />
          {value?.updated_at ? new Date(value.updated_at).toLocaleDateString("ar-SA") : "لم يحدث بعد"}
        </span>
      </div>
    </article>
  );
}
