"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  Edit3,
  LayoutDashboard,
  List,
  Package,
  Radio,
  Search,
  Settings2,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { buildKpiRadarModel, type KpiRadarIndicator, type KpiRadarQuarter } from "@/lib/kpis/radar";
import { formatKpiValue, getKpiStatusLabel, getKpiStatusStyle } from "@/lib/kpis/status";
import type { KpiDefinition, KpiPeriodType, KpiValue } from "@/lib/supabase/types";

interface Props {
  definitions: KpiDefinition[];
  values: KpiValue[];
  yearValues: KpiValue[];
  periodType: KpiPeriodType;
  periodLabel: string;
  year: number;
  isFetching?: boolean;
  isAdmin: boolean;
  scopePerspective?: string;
  onOpenBulkUpdate: () => void;
  onOpenTargets: () => void;
  onEditIndicator: (definitionId: string) => void;
}

const ALL_PERSPECTIVES = "all";
const QUARTER_COLORS = ["#0f766e", "#2563eb", "#b45309", "#7c3aed"];
const PERSPECTIVE_COLORS = ["#0f766e", "#2563eb", "#b45309", "#be123c", "#7c3aed", "#0891b2", "#475569"];

const PERSPECTIVE_ICONS: Record<string, typeof Activity> = {
  "الإيرادات": TrendingUp,
  "العقود والعملاء": Users,
  "الجمهور والمشتركين": Radio,
  "العمليات والمشاريع": Activity,
  "البرامج والخدمات": BarChart3,
  "المنتجات": Package,
  "الشراكات والتموضع": Target,
};

export function KpiRadarDashboard({
  definitions,
  values,
  yearValues,
  periodType,
  periodLabel,
  year,
  isFetching,
  isAdmin,
  scopePerspective,
  onOpenBulkUpdate,
  onOpenTargets,
  onEditIndicator,
}: Props) {
  const [perspective, setPerspective] = useState(scopePerspective ?? ALL_PERSPECTIVES);
  const [query, setQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");

  useEffect(() => {
    if (scopePerspective) setPerspective(scopePerspective);
  }, [scopePerspective]);

  const model = useMemo(
    () => buildKpiRadarModel(definitions, values, yearValues, periodType, year),
    [definitions, periodType, values, year, yearValues]
  );

  const isScoped = Boolean(scopePerspective);
  const activePerspective = scopePerspective ?? perspective;
  const perspectives = model.summary.perspectives.map((item) => item.name);
  const activePerspectiveName = activePerspective === ALL_PERSPECTIVES ? "كل المؤشرات" : activePerspective;
  const normalizedQuery = query.trim().toLowerCase();

  const filteredIndicators = model.indicators.filter((indicator) => {
    const matchesPerspective = activePerspective === ALL_PERSPECTIVES || indicator.definition.perspective === activePerspective;
    const matchesQuery = !normalizedQuery
      || indicator.definition.name.toLowerCase().includes(normalizedQuery)
      || indicator.definition.code.toLowerCase().includes(normalizedQuery)
      || (indicator.definition.strategic_goal ?? "").toLowerCase().includes(normalizedQuery);
    return matchesPerspective && matchesQuery;
  });

  const perspectiveChartData = model.summary.perspectives.map((item) => ({
    name: item.name,
    value: item.averageAchievement,
  }));

  const indicatorChartData = filteredIndicators
    .map((indicator) => ({
      id: indicator.definition.id,
      name: shortLabel(indicator.definition.name),
      fullName: indicator.definition.name,
      achievement: indicator.annualAchievement ?? 0,
    }))
    .sort((a, b) => b.achievement - a.achievement)
    .slice(0, 10);

  return (
    <div className={cn("grid gap-6", !isScoped && "xl:grid-cols-[280px_minmax(0,1fr)]")}>
      {!isScoped && (
        <aside className="space-y-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-lg bg-slate-950 text-white">
              <LayoutDashboard size={22} />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-950">رادار الأداء</h2>
              <p className="text-xs font-semibold text-slate-500">سماوة {year}</p>
            </div>
          </div>

          <nav className="space-y-2">
            <PerspectiveButton active={perspective === ALL_PERSPECTIVES} onClick={() => setPerspective(ALL_PERSPECTIVES)}>
              <BarChart3 size={16} />
              عرض الكل
            </PerspectiveButton>
            {perspectives.map((item) => {
              const Icon = PERSPECTIVE_ICONS[item] ?? BarChart3;
              return (
                <PerspectiveButton key={item} active={perspective === item} onClick={() => setPerspective(item)}>
                  <Icon size={16} />
                  {item}
                </PerspectiveButton>
              );
            })}
          </nav>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-bold text-slate-500">متوسط الإنجاز السنوي</p>
            <div className="mt-2 flex items-end gap-2">
              <span className="text-4xl font-black text-slate-950">{model.summary.averageAchievement}%</span>
              <span className="mb-1 text-xs font-bold text-slate-500">للسنة</span>
            </div>
            <ProgressBar value={model.summary.averageAchievement} status={model.summary.averageAchievement >= 100 ? "green" : "yellow"} />
          </div>

          {isAdmin && (
            <div className="grid gap-2">
              <Button variant="outline" onClick={onOpenTargets}>
                <Settings2 size={16} />
                المستهدفات
              </Button>
              <Button onClick={onOpenBulkUpdate}>
                <Target size={16} />
                تحديث سريع
              </Button>
            </div>
          )}
        </aside>
      )}

      <div className="min-w-0 space-y-6">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-teal-700">
                <span className="rounded-full bg-teal-50 px-2.5 py-1">رادار الأداء الاستراتيجي</span>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">{periodLabel}</span>
                {isFetching && <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-700">تحديث البيانات</span>}
              </div>
              <h2 className="mt-3 text-2xl font-black text-slate-950">{activePerspectiveName}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                عرض ربع سنوي واضح لكل مؤشر: المستهدف، الفعلي، نسبة الإنجاز، والحالة السنوية من بيانات {year}.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              {!isScoped && (
                <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-1">
                  <Button size="sm" variant={viewMode === "grid" ? "default" : "ghost"} onClick={() => setViewMode("grid")}>
                    <LayoutDashboard size={15} />
                    المربعات
                  </Button>
                  <Button size="sm" variant={viewMode === "table" ? "default" : "ghost"} onClick={() => setViewMode("table")}>
                    <List size={15} />
                    الجدول
                  </Button>
                </div>
              )}
              <div className="relative min-w-64">
                <Search className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ابحث عن مؤشر" className="pr-9" />
              </div>
              {isScoped && isAdmin && (
                <div className="flex gap-2">
                  <Button variant="outline" onClick={onOpenTargets}>
                    <Settings2 size={16} />
                    المستهدفات
                  </Button>
                  <Button onClick={onOpenBulkUpdate}>
                    <Target size={16} />
                    تحديث القسم
                  </Button>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-5">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm xl:col-span-3">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="text-base font-extrabold text-slate-900">التوجه الربع سنوي للأداء</h3>
              <span className="text-xs font-bold text-slate-500">Q1 - Q4</span>
            </div>
            <div className="h-72" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={model.summary.quarters}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="key" tick={{ fontSize: 12 }} />
                  <YAxis tickFormatter={(value) => `${value}%`} />
                  <Tooltip formatter={(value) => [`${value}%`, "الإنجاز"]} />
                  <Bar dataKey="achievement" radius={[6, 6, 0, 0]} barSize={42}>
                    {model.summary.quarters.map((entry, index) => (
                      <Cell key={entry.key} fill={QUARTER_COLORS[index % QUARTER_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {isScoped ? (
            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2">
              <h3 className="mb-4 text-base font-extrabold text-slate-900">إنجاز مؤشرات القسم</h3>
              <div className="h-72" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={indicatorChartData} layout="vertical" margin={{ right: 12, left: 12 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" domain={[0, 120]} tickFormatter={(value) => `${value}%`} />
                    <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(value) => [`${value}%`, "الإنجاز"]} labelFormatter={(_, items) => items?.[0]?.payload?.fullName ?? ""} />
                    <Bar dataKey="achievement" radius={[6, 6, 6, 6]} barSize={18} fill="#0f766e" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2">
              <h3 className="mb-4 text-base font-extrabold text-slate-900">توزيع الإنجاز حسب المنظور</h3>
              <div className="relative h-56" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={perspectiveChartData} dataKey="value" nameKey="name" innerRadius={62} outerRadius={86} paddingAngle={5}>
                      {perspectiveChartData.map((entry, index) => (
                        <Cell key={entry.name} fill={PERSPECTIVE_COLORS[index % PERSPECTIVE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value, name) => [`${value}%`, name]} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-black text-slate-950">{model.summary.averageAchievement}%</span>
                  <span className="text-xs font-bold text-slate-500">المتوسط</span>
                </div>
              </div>
            </div>
          )}
        </section>

        {filteredIndicators.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 bg-white p-10 text-center text-sm font-semibold text-slate-500">
            لا توجد مؤشرات مطابقة للفترة أو البحث الحالي.
          </div>
        ) : isScoped || viewMode === "grid" ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
            {filteredIndicators.map((indicator) => (
              <RadarCard
                key={indicator.definition.id}
                indicator={indicator}
                canEdit={isAdmin}
                onEditIndicator={onEditIndicator}
              />
            ))}
          </div>
        ) : (
          <RadarTable indicators={filteredIndicators} canEdit={isAdmin} onEditIndicator={onEditIndicator} />
        )}
      </div>
    </div>
  );
}

function RadarCard({
  indicator,
  canEdit,
  onEditIndicator,
}: {
  indicator: KpiRadarIndicator;
  canEdit: boolean;
  onEditIndicator: (definitionId: string) => void;
}) {
  return (
    <article className="group flex min-h-[430px] flex-col rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-teal-200 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">{indicator.definition.perspective}</span>
            <span className="rounded-full bg-teal-50 px-2.5 py-1 text-xs font-bold text-teal-700">{indicator.sourceLabel}</span>
          </div>
          <h3 className="mt-3 line-clamp-2 text-base font-extrabold text-slate-950 transition group-hover:text-teal-700">
            {indicator.definition.name}
          </h3>
          {indicator.definition.strategic_goal && (
            <p className="mt-1 line-clamp-1 text-xs font-semibold text-slate-500">{indicator.definition.strategic_goal}</p>
          )}
        </div>
        <span className={cn("shrink-0 rounded-full border px-2.5 py-1 text-xs font-bold", getKpiStatusStyle(indicator.annualStatus))}>
          {getKpiStatusLabel(indicator.annualStatus)}
        </span>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-3">
        <Metric label="المستهدف السنوي" value={indicator.definition.target_text ?? formatCompactValue(indicator.annualTarget, indicator.definition.target_unit)} />
        <Metric label={getAnnualActualLabel(indicator)} value={formatCompactValue(indicator.annualActual, indicator.definition.target_unit)} />
        <Metric label="الإنجاز السنوي" value={formatAchievement(indicator.annualAchievement)} />
      </div>

      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
          <span>تقرير الأداء السنوي</span>
          <span className="font-extrabold text-slate-800">{formatAchievement(indicator.annualAchievement)}</span>
        </div>
        <ProgressBar value={indicator.annualAchievement} status={indicator.annualStatus} />
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2">
        {indicator.quarters.map((quarter) => (
          <QuarterPanel key={quarter.key} quarter={quarter} unit={indicator.definition.target_unit} />
        ))}
      </div>

      <div className="mt-auto flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
        <p className="text-xs font-semibold text-slate-500">
          آخر تحديث: {indicator.lastUpdatedAt ? new Date(indicator.lastUpdatedAt).toLocaleDateString("ar-SA") : "لم يحدث بعد"}
        </p>
        {canEdit && (
          <Button variant="outline" size="sm" onClick={() => onEditIndicator(indicator.definition.id)}>
            <Edit3 size={15} />
            تعديل المؤشر
          </Button>
        )}
      </div>
    </article>
  );
}

function RadarTable({
  indicators,
  canEdit,
  onEditIndicator,
}: {
  indicators: KpiRadarIndicator[];
  canEdit: boolean;
  onEditIndicator: (definitionId: string) => void;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1560px] text-right text-sm">
          <thead className="bg-slate-50 text-xs font-bold text-slate-500">
            <tr>
              <th className="px-4 py-3">المؤشر والقسم</th>
              <th className="px-4 py-3">المستهدف السنوي</th>
              <th className="px-4 py-3 text-center">Q1 target / actual / achievement</th>
              <th className="px-4 py-3 text-center">Q2 target / actual / achievement</th>
              <th className="px-4 py-3 text-center">Q3 target / actual / achievement</th>
              <th className="px-4 py-3 text-center">Q4 target / actual / achievement</th>
              <th className="px-4 py-3">المتحقق السنوي</th>
              <th className="px-4 py-3">الإنجاز والحالة</th>
              <th className="px-4 py-3">آخر تحديث</th>
              {canEdit && <th className="px-4 py-3">إجراء</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {indicators.map((indicator) => (
              <tr key={indicator.definition.id} className="hover:bg-slate-50/80">
                <td className="px-4 py-3">
                  <p className="font-extrabold text-slate-900">{indicator.definition.name}</p>
                  <p className="mt-1 text-xs text-slate-500">{indicator.definition.perspective}</p>
                </td>
                <td className="px-4 py-3 font-bold text-slate-700">
                  {indicator.definition.target_text ?? formatCompactValue(indicator.annualTarget, indicator.definition.target_unit)}
                </td>
                {indicator.quarters.map((quarter) => (
                  <td key={quarter.key} className="px-4 py-3 text-center">
                    <QuarterCell quarter={quarter} unit={indicator.definition.target_unit} />
                  </td>
                ))}
                <td className="px-4 py-3">
                  <p className="font-extrabold text-slate-950">{formatCompactValue(indicator.annualActual, indicator.definition.target_unit)}</p>
                  <p className="mt-1 text-xs text-slate-500">{getAnnualActualLabel(indicator)}</p>
                </td>
                <td className="px-4 py-3">
                  <span className={cn("inline-flex rounded-full border px-2.5 py-1 text-xs font-bold", getKpiStatusStyle(indicator.annualStatus))}>
                    {formatAchievement(indicator.annualAchievement)} · {getKpiStatusLabel(indicator.annualStatus)}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs font-semibold text-slate-500">
                  {indicator.lastUpdatedAt ? new Date(indicator.lastUpdatedAt).toLocaleDateString("ar-SA") : "لم يحدث بعد"}
                </td>
                {canEdit && (
                  <td className="px-4 py-3">
                    <Button variant="outline" size="sm" onClick={() => onEditIndicator(indicator.definition.id)}>
                      <ArrowUpRight size={15} />
                      تعديل
                    </Button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function QuarterPanel({ quarter, unit }: { quarter: KpiRadarQuarter; unit: string | null }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-black text-slate-500">{quarter.key}</p>
        <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-bold", getKpiStatusStyle(quarter.status))}>
          {formatAchievement(quarter.achievement)}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <SmallValue label="المستهدف" value={formatCompactValue(quarter.target, unit)} />
        <SmallValue label="الفعلي" value={formatCompactValue(quarter.value, unit)} />
      </div>
      <div className="mt-3">
        <ProgressBar value={quarter.achievement} status={quarter.status} compact />
      </div>
    </div>
  );
}

function QuarterCell({ quarter, unit }: { quarter: KpiRadarQuarter; unit: string | null }) {
  return (
    <div className="mx-auto max-w-[180px] rounded-lg bg-slate-50 px-3 py-2 text-right">
      <div className="grid grid-cols-3 gap-2 text-[11px]">
        <SmallValue label="Target" value={formatCompactValue(quarter.target, unit)} />
        <SmallValue label="Actual" value={formatCompactValue(quarter.value, unit)} />
        <SmallValue label="Ach." value={formatAchievement(quarter.achievement)} />
      </div>
      <div className="mt-2">
        <ProgressBar value={quarter.achievement} status={quarter.status} compact />
      </div>
    </div>
  );
}

function ProgressBar({ value, status, compact }: { value: number | null; status: string; compact?: boolean }) {
  return (
    <div className={cn("mt-3 overflow-hidden rounded-full bg-slate-100", compact ? "h-1.5" : "h-2")}>
      <div
        className={cn(
          "h-full rounded-full transition-all",
          status === "green" && "bg-emerald-600",
          status === "yellow" && "bg-amber-500",
          status === "red" && "bg-rose-500",
          status === "neutral" && "bg-slate-300"
        )}
        style={{ width: `${Math.min(value ?? 0, 100)}%` }}
      />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-extrabold text-slate-900">{value}</p>
    </div>
  );
}

function SmallValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-bold text-slate-400">{label}</p>
      <p className="mt-0.5 truncate font-extrabold text-slate-800">{value}</p>
    </div>
  );
}

function PerspectiveButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg px-3 py-3 text-right text-sm font-bold transition",
        active
          ? "border border-teal-200 bg-teal-50 text-teal-800"
          : "border border-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-50 hover:text-slate-950"
      )}
    >
      {children}
    </button>
  );
}

function formatCompactValue(value: number | null | undefined, unit?: string | null) {
  if (value === null || value === undefined) return "لا يوجد";
  return formatKpiValue(value, unit);
}

function formatAchievement(value: number | null | undefined) {
  return value === null || value === undefined ? "غير متاح" : `${value}%`;
}

function getAnnualActualLabel(indicator: KpiRadarIndicator) {
  if (indicator.aggregation === "average") return "متوسط سنوي";
  if (indicator.aggregation === "max") return "أعلى قيمة سنوية";
  return "إجمالي سنوي";
}

function shortLabel(value: string) {
  return value.length > 22 ? `${value.slice(0, 22)}...` : value;
}
