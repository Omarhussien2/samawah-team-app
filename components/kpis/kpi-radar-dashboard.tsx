"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  CircleDashed,
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
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { buildKpiRadarModel, type KpiRadarIndicator } from "@/lib/kpis/radar";
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
  onOpenBulkUpdate: () => void;
  onOpenTargets: () => void;
  onOpenWorkspace: (perspective: string) => void;
}

const ALL_PERSPECTIVES = "all";
const QUARTER_COLORS = ["#0f766e", "#2563eb", "#b45309", "#7c3aed"];

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
  onOpenBulkUpdate,
  onOpenTargets,
  onOpenWorkspace,
}: Props) {
  const [perspective, setPerspective] = useState(ALL_PERSPECTIVES);
  const [query, setQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");

  const model = useMemo(
    () => buildKpiRadarModel(definitions, values, yearValues, periodType),
    [definitions, periodType, values, yearValues]
  );
  const perspectives = model.summary.perspectives.map((item) => item.name);
  const normalizedQuery = query.trim().toLowerCase();
  const filteredIndicators = model.indicators.filter((indicator) => {
    const matchesPerspective = perspective === ALL_PERSPECTIVES || indicator.definition.perspective === perspective;
    const matchesQuery = !normalizedQuery
      || indicator.definition.name.toLowerCase().includes(normalizedQuery)
      || indicator.definition.code.toLowerCase().includes(normalizedQuery)
      || (indicator.definition.strategic_goal ?? "").toLowerCase().includes(normalizedQuery);
    return matchesPerspective && matchesQuery;
  });

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-slate-950 text-white shadow-sm">
        <div className="grid gap-6 p-6 lg:grid-cols-[1fr_280px] lg:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-emerald-300">
              <LayoutDashboard size={16} />
              رادار الأداء الاستراتيجي
              <span className="rounded-full border border-white/10 bg-white/10 px-2.5 py-1 text-white/70">
                {periodLabel}
              </span>
              {isFetching && <span className="rounded-full bg-amber-400/15 px-2.5 py-1 text-amber-100">تحديث البيانات</span>}
            </div>
            <h2 className="mt-3 text-2xl font-extrabold tracking-tight md:text-3xl">سماوة {year}: رؤية واحدة للمؤشرات والتنفيذ</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <SummaryMetric label="مؤشر مكتمل" value={model.summary.achieved} tone="green" />
              <SummaryMetric label="بحاجة متابعة" value={model.summary.attention} tone="amber" />
              <SummaryMetric label="بلا بيانات" value={model.summary.noData} tone="slate" />
            </div>
          </div>

          <div className="rounded-lg border border-white/10 bg-white/[0.06] p-5">
            <p className="text-sm font-semibold text-white/60">إجمالي الإنجاز</p>
            <div className="mt-2 flex items-end gap-2">
              <span className="text-5xl font-black">{model.summary.averageAchievement}%</span>
              <span className="mb-2 text-xs font-bold text-white/40">متوسط سنوي</span>
            </div>
            <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-emerald-400 transition-all"
                style={{ width: `${Math.min(model.summary.averageAchievement, 100)}%` }}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatusCard label="إجمالي المؤشرات" value={model.summary.total} icon={Target} />
        <StatusCard label="مكتمل" value={model.summary.achieved} icon={CheckCircle2} tone="green" />
        <StatusCard label="بحاجة متابعة" value={model.summary.attention} icon={AlertTriangle} tone="amber" />
        <StatusCard label="بلا بيانات" value={model.summary.noData} icon={CircleDashed} tone="slate" />
      </section>

      <section className="grid gap-6 xl:grid-cols-5">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm xl:col-span-3">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="text-base font-extrabold text-slate-900">التوجه الربعي المختزل</h3>
            <span className="text-xs font-bold text-slate-500">Q1 - Q4</span>
          </div>
          <div className="h-72" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={model.summary.quarters}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="key" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={(value) => `${value}%`} />
                <Tooltip formatter={(value) => [`${value}%`, "الإنجاز"]} />
                <Bar dataKey="achievement" radius={[6, 6, 0, 0]}>
                  {model.summary.quarters.map((entry, index) => (
                    <Cell key={entry.key} fill={QUARTER_COLORS[index % QUARTER_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2">
          <h3 className="mb-4 text-base font-extrabold text-slate-900">الإنجاز حسب المنظور</h3>
          <div className="space-y-3">
            {model.summary.perspectives.map((item) => (
              <button
                key={item.name}
                type="button"
                onClick={() => setPerspective(item.name)}
                className="w-full rounded-lg border border-slate-100 bg-slate-50 px-3 py-3 text-right transition hover:border-slate-300 hover:bg-white"
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-sm font-bold text-slate-900">{item.name}</span>
                  <span className="text-xs font-extrabold text-slate-500">{item.averageAchievement}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white">
                  <div className="h-full rounded-full bg-slate-900" style={{ width: `${Math.min(item.averageAchievement, 100)}%` }} />
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap gap-2">
            <FilterButton active={perspective === ALL_PERSPECTIVES} onClick={() => setPerspective(ALL_PERSPECTIVES)}>
              الكل
            </FilterButton>
            {perspectives.map((item) => {
              const Icon = PERSPECTIVE_ICONS[item] ?? BarChart3;
              return (
                <FilterButton key={item} active={perspective === item} onClick={() => setPerspective(item)}>
                  <Icon size={14} />
                  {item}
                </FilterButton>
              );
            })}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative min-w-64">
              <Search className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ابحث عن مؤشر" className="pr-9" />
            </div>
            <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-1">
              <Button size="sm" variant={viewMode === "grid" ? "default" : "ghost"} onClick={() => setViewMode("grid")}>
                <LayoutDashboard size={15} />
                بطاقات
              </Button>
              <Button size="sm" variant={viewMode === "table" ? "default" : "ghost"} onClick={() => setViewMode("table")}>
                <List size={15} />
                جدول
              </Button>
            </div>
            {isAdmin && (
              <>
                <Button variant="outline" onClick={onOpenTargets}>
                  <Settings2 size={16} />
                  المستهدفات
                </Button>
                <Button onClick={onOpenBulkUpdate}>
                  <Target size={16} />
                  تحديث سريع
                </Button>
              </>
            )}
          </div>
        </div>
      </section>

      {viewMode === "grid" ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {filteredIndicators.map((indicator) => (
            <RadarCard key={indicator.definition.id} indicator={indicator} onOpenWorkspace={onOpenWorkspace} />
          ))}
        </div>
      ) : (
        <RadarTable indicators={filteredIndicators} onOpenWorkspace={onOpenWorkspace} />
      )}
    </div>
  );
}

function RadarCard({
  indicator,
  onOpenWorkspace,
}: {
  indicator: KpiRadarIndicator;
  onOpenWorkspace: (perspective: string) => void;
}) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">{indicator.definition.perspective}</span>
            <span className="rounded-full bg-teal-50 px-2.5 py-1 text-xs font-bold text-teal-700">{indicator.sourceLabel}</span>
          </div>
          <h3 className="mt-3 line-clamp-2 text-base font-extrabold text-slate-950">{indicator.definition.name}</h3>
          {indicator.definition.strategic_goal && (
            <p className="mt-1 line-clamp-1 text-xs font-semibold text-slate-500">{indicator.definition.strategic_goal}</p>
          )}
        </div>
        <span className={cn("shrink-0 rounded-full border px-2.5 py-1 text-xs font-bold", getKpiStatusStyle(indicator.annualStatus))}>
          {getKpiStatusLabel(indicator.annualStatus)}
        </span>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-4">
        <Metric label="المتحقق السنوي" value={formatKpiValue(indicator.annualActual, indicator.definition.target_unit)} />
        <Metric label="المستهدف" value={indicator.definition.target_text ?? formatKpiValue(indicator.annualTarget, indicator.definition.target_unit)} />
      </div>

      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
          <span>نسبة الإنجاز السنوية</span>
          <span className="font-extrabold text-slate-800">{indicator.annualAchievement ?? 0}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              indicator.annualStatus === "green" && "bg-emerald-500",
              indicator.annualStatus === "yellow" && "bg-amber-500",
              indicator.annualStatus === "red" && "bg-rose-500",
              indicator.annualStatus === "neutral" && "bg-slate-300"
            )}
            style={{ width: `${Math.min(indicator.annualAchievement ?? 0, 100)}%` }}
          />
        </div>
      </div>

      <div className="mt-5 grid grid-cols-4 gap-2">
        {indicator.quarters.map((quarter) => (
          <div key={quarter.key} className="rounded-lg bg-slate-50 px-2 py-2 text-center">
            <p className="text-xs font-black text-slate-500">{quarter.key}</p>
            <p className="mt-1 truncate text-xs font-bold text-slate-900">{formatKpiValue(quarter.value, indicator.definition.target_unit)}</p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white">
              <div className="h-full rounded-full bg-slate-900" style={{ width: `${Math.min(quarter.achievement ?? 0, 100)}%` }} />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
        <p className="text-xs font-semibold text-slate-500">
          {indicator.lastUpdatedAt ? new Date(indicator.lastUpdatedAt).toLocaleDateString("ar-SA") : "لم يحدث بعد"}
        </p>
        <Button variant="outline" size="sm" onClick={() => onOpenWorkspace(indicator.definition.perspective)}>
          <ArrowUpRight size={15} />
          فتح المساحة
        </Button>
      </div>
    </article>
  );
}

function RadarTable({
  indicators,
  onOpenWorkspace,
}: {
  indicators: KpiRadarIndicator[];
  onOpenWorkspace: (perspective: string) => void;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-right text-sm">
          <thead className="bg-slate-50 text-xs font-bold text-slate-500">
            <tr>
              <th className="px-4 py-3">المؤشر</th>
              <th className="px-4 py-3">المستهدف</th>
              <th className="px-4 py-3 text-center">Q1</th>
              <th className="px-4 py-3 text-center">Q2</th>
              <th className="px-4 py-3 text-center">Q3</th>
              <th className="px-4 py-3 text-center">Q4</th>
              <th className="px-4 py-3">السنوي</th>
              <th className="px-4 py-3">الإنجاز</th>
              <th className="px-4 py-3">إجراء</th>
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
                  {indicator.definition.target_text ?? formatKpiValue(indicator.annualTarget, indicator.definition.target_unit)}
                </td>
                {indicator.quarters.map((quarter) => (
                  <td key={quarter.key} className="px-4 py-3 text-center font-semibold text-slate-700">
                    {formatKpiValue(quarter.value, indicator.definition.target_unit)}
                  </td>
                ))}
                <td className="px-4 py-3 font-extrabold text-slate-950">{formatKpiValue(indicator.annualActual, indicator.definition.target_unit)}</td>
                <td className="px-4 py-3">
                  <span className={cn("rounded-full border px-2.5 py-1 text-xs font-bold", getKpiStatusStyle(indicator.annualStatus))}>
                    {indicator.annualAchievement ?? 0}%
                  </span>
                </td>
                <td className="px-4 py-3">
                  <Button variant="outline" size="sm" onClick={() => onOpenWorkspace(indicator.definition.perspective)}>
                    <ArrowUpRight size={15} />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusCard({
  label,
  value,
  icon: Icon,
  tone = "blue",
}: {
  label: string;
  value: number;
  icon: typeof Target;
  tone?: "blue" | "green" | "amber" | "slate";
}) {
  const toneClass = {
    blue: "bg-blue-50 text-blue-700",
    green: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    slate: "bg-slate-100 text-slate-700",
  }[tone];

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-black text-slate-950">{value}</p>
        </div>
        <div className={cn("flex size-11 items-center justify-center rounded-lg", toneClass)}>
          <Icon size={22} />
        </div>
      </div>
    </div>
  );
}

function SummaryMetric({ label, value, tone }: { label: string; value: number; tone: "green" | "amber" | "slate" }) {
  const color = {
    green: "text-emerald-300",
    amber: "text-amber-200",
    slate: "text-slate-200",
  }[tone];

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.05] px-4 py-3">
      <p className="text-xs font-semibold text-white/50">{label}</p>
      <p className={cn("mt-1 text-2xl font-black", color)}>{value}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className="mt-1 line-clamp-1 text-sm font-extrabold text-slate-900">{value}</p>
    </div>
  );
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Button type="button" size="sm" variant={active ? "default" : "outline"} onClick={onClick}>
      {children}
    </Button>
  );
}
