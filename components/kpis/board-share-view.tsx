"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  Activity,
  BarChart3,
  Eye,
  LayoutDashboard,
  List,
  Package,
  Radio,
  Search,
  ShieldCheck,
  Target,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { createSearchMatcher } from "@/lib/utils/search";
import { buildKpiRadarModel, type KpiRadarIndicator, type KpiRadarQuarter } from "@/lib/kpis/radar";
import { formatKpiValue, getKpiStatusLabel, getKpiStatusStyle } from "@/lib/kpis/status";
import type { KpiBoardSnapshot } from "@/lib/kpis/share";
import type { KpiStatus } from "@/lib/supabase/types";

const ALL_PERSPECTIVES = "ALL";
const QUARTER_COLORS = ["#10b981", "#f43f5e", "#eab308", "#6366f1"];
const PERSPECTIVE_COLORS = ["#10b981", "#f43f5e", "#eab308", "#3b82f6", "#ec4899", "#8b5cf6", "#06b6d4"];

const PERSPECTIVE_ICONS: Record<string, typeof Activity> = {
  "الإيرادات": TrendingUp,
  "العقود والعملاء": Users,
  "الجمهور والمشتركين": Radio,
  "العمليات والمشاريع": Activity,
  "البرامج والخدمات": BarChart3,
  "المنتجات": Package,
  "الشراكات والتموضع": Target,
};

export function BoardShareView({ snapshot }: { snapshot: KpiBoardSnapshot }) {
  const [activePerspective, setActivePerspective] = useState(ALL_PERSPECTIVES);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");

  const model = useMemo(
    () => buildKpiRadarModel(snapshot.definitions, [], snapshot.values, "quarterly", snapshot.year),
    [snapshot.definitions, snapshot.values, snapshot.year]
  );

  const perspectives = model.summary.perspectives.map((item) => item.name);
  const matchesSearch = createSearchMatcher(searchQuery);
  const filteredIndicators = model.indicators.filter((indicator) => {
    const matchesPerspective = activePerspective === ALL_PERSPECTIVES || indicator.definition.perspective === activePerspective;
    const matchesQuery = matchesSearch([
      indicator.definition.name,
      indicator.definition.code,
      indicator.definition.perspective,
      indicator.definition.strategic_goal,
      indicator.definition.measurement_label,
      indicator.definition.target_text,
      indicator.definition.target_unit,
      indicator.sourceLabel,
      getKpiStatusLabel(indicator.annualStatus),
    ]);
    return matchesPerspective && matchesQuery;
  });

  const averageProgress = Math.round(average(filteredIndicators.map((indicator) => indicator.annualAchievement ?? 0)));
  const achievedCount = filteredIndicators.filter((indicator) => (indicator.annualAchievement ?? 0) >= 100).length;
  const quartersData = ["Q1", "Q2", "Q3", "Q4"].map((key) => ({
    name: key,
    value: Math.round(average(filteredIndicators.map((indicator) => indicator.quarters.find((quarter) => quarter.key === key)?.achievement ?? 0))),
  }));
  const perspectiveProgress = model.summary.perspectives.map((item) => ({
    name: item.name,
    value: item.averageAchievement,
  }));

  return (
    <main className="min-h-screen overflow-hidden bg-slate-950 text-white" dir="rtl">
      <div className="flex min-h-screen flex-col lg:flex-row">
        <aside className="relative z-10 flex w-full flex-col gap-8 border-b border-white/10 bg-white/[0.05] p-6 shadow-2xl backdrop-blur-2xl lg:w-80 lg:border-b-0 lg:border-l lg:p-8">
          <div className="flex items-center gap-4">
            <div className="flex size-12 rotate-3 items-center justify-center rounded-lg bg-teal-500 text-white shadow-lg shadow-teal-500/20">
              <LayoutDashboard size={28} />
            </div>
            <div>
              <h1 className="text-xl font-black leading-tight text-white">سماوة {snapshot.year}</h1>
              <p className="text-xs font-semibold text-white/40">رادار الأداء الاستراتيجي</p>
            </div>
          </div>

          <nav className="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
            <PerspectiveButton active={activePerspective === ALL_PERSPECTIVES} onClick={() => setActivePerspective(ALL_PERSPECTIVES)}>
              <BarChart3 size={18} />
              عرض الكل
            </PerspectiveButton>
            <div className="hidden h-px bg-white/10 lg:block" />
            {perspectives.map((perspective) => {
              const Icon = PERSPECTIVE_ICONS[perspective] ?? BarChart3;
              return (
                <PerspectiveButton key={perspective} active={activePerspective === perspective} onClick={() => setActivePerspective(perspective)}>
                  <Icon size={18} />
                  {perspective}
                </PerspectiveButton>
              );
            })}
          </nav>

          <div className="mt-auto grid gap-3">
            <div className="rounded-lg border border-white/10 bg-white/[0.06] p-5 text-center">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/30">إجمالي الإنجاز</p>
              <div className="mt-2 text-4xl font-black text-teal-300 drop-shadow-[0_0_12px_rgba(45,212,191,0.35)]">{averageProgress}%</div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10 p-0.5">
                <div
                  className="h-full rounded-full bg-teal-400 shadow-[0_0_12px_rgba(45,212,191,0.5)] transition-all"
                  style={{ width: `${Math.min(averageProgress, 100)}%` }}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <MiniStat label="المكتملة" value={achievedCount} tone="teal" />
              <MiniStat label="قيد التنفيذ" value={Math.max(filteredIndicators.length - achievedCount, 0)} tone="rose" />
            </div>
          </div>
        </aside>

        <section className="relative z-10 min-w-0 flex-1 overflow-auto p-5 md:p-10">
          <header className="mb-10 flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-full border border-teal-300/20 bg-teal-300/10 px-3 py-1 text-xs font-black text-teal-200">
                  <ShieldCheck size={14} />
                  رابط قراءة فقط
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs font-bold text-white/50">
                  <Eye size={14} />
                  {snapshot.link.views_count} مشاهدة
                </span>
              </div>
              <h2 className="flex flex-wrap items-center gap-3 text-3xl font-black text-white md:text-4xl">
                {activePerspective === ALL_PERSPECTIVES ? "الكل" : activePerspective}
                <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs font-black uppercase tracking-widest text-white/40">
                  {filteredIndicators.length} مؤشر
                </span>
              </h2>
              <p className="max-w-3xl text-sm font-medium leading-7 text-white/40">
                تتبع أداء مؤشرات سماوة في الوقت الفعلي عبر الأرباع، المستهدف السنوي، المتحقق، ونسبة الإنجاز.
              </p>
            </div>

            <div className="flex w-full flex-col gap-3 md:w-auto md:flex-row md:items-center">
              <div className="flex rounded-lg border border-white/10 bg-white/[0.08] p-1.5 shadow-xl backdrop-blur-xl">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setViewMode("grid")}
                  className={cn("text-white/40 hover:bg-white/10 hover:text-white", viewMode === "grid" && "bg-white/10 text-white")}
                >
                  <LayoutDashboard size={16} />
                  المربعات
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setViewMode("table")}
                  className={cn("text-white/40 hover:bg-white/10 hover:text-white", viewMode === "table" && "bg-white/10 text-white")}
                >
                  <List size={16} />
                  الجدول
                </Button>
              </div>
              <div className="relative w-full md:w-80">
                <Search className="absolute right-4 top-1/2 size-4 -translate-y-1/2 text-white/30" />
                <Input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="ابحث عن مؤشر..."
                  className="rounded-lg border-white/10 bg-white/[0.06] py-6 pl-10 pr-11 text-right text-white placeholder:text-white/25 focus-visible:ring-teal-400/40"
                />
                {searchQuery && (
                  <button
                    type="button"
                    aria-label="مسح البحث"
                    onClick={() => setSearchQuery("")}
                    className="absolute left-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-white/30 transition hover:bg-white/10 hover:text-white"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>
          </header>

          <section className="mb-8 grid grid-cols-1 gap-6 xl:grid-cols-3">
            <div className="rounded-lg border border-white/10 bg-white/[0.06] p-6 shadow-2xl backdrop-blur-2xl xl:col-span-2">
              <h3 className="mb-6 flex items-center gap-2 text-sm font-black text-white/70">
                <span className="h-6 w-1.5 rounded-full bg-teal-400" />
                التوجه الربع سنوي للأداء المختزل (%)
              </h3>
              <div className="h-72" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={quartersData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff14" vertical={false} />
                    <XAxis dataKey="name" stroke="#ffffff45" fontSize={12} tickLine={false} axisLine={false} dy={10} />
                    <YAxis stroke="#ffffff45" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}%`} />
                    <Tooltip
                      cursor={{ fill: "rgba(255,255,255,0.04)" }}
                      contentStyle={{ backgroundColor: "#020617", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px" }}
                      formatter={(value) => [`${value}%`, "الإنجاز"]}
                    />
                    <Bar dataKey="value" radius={[8, 8, 0, 0]} barSize={40}>
                      {quartersData.map((entry, index) => (
                        <Cell key={entry.name} fill={QUARTER_COLORS[index % QUARTER_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-lg border border-white/10 bg-white/[0.06] p-6 shadow-2xl backdrop-blur-2xl">
              <h3 className="mb-6 flex items-center gap-2 text-sm font-black text-white/70">
                <span className="h-6 w-1.5 rounded-full bg-blue-400" />
                توزيع الإنجاز حسب المنظور
              </h3>
              <div className="relative h-56" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={perspectiveProgress} dataKey="value" nameKey="name" innerRadius={65} outerRadius={86} paddingAngle={7} stroke="none">
                      {perspectiveProgress.map((entry, index) => (
                        <Cell key={entry.name} fill={PERSPECTIVE_COLORS[index % PERSPECTIVE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: "#020617", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px" }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-black text-white">{model.summary.averageAchievement}%</span>
                  <span className="text-[10px] font-black uppercase tracking-widest text-white/30">المتوسط</span>
                </div>
              </div>
            </div>
          </section>

          {filteredIndicators.length === 0 ? (
            <div className="rounded-lg border border-dashed border-white/15 bg-white/[0.04] p-10 text-center text-sm font-semibold text-white/45">
              لا توجد مؤشرات مطابقة للبحث الحالي.
            </div>
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
              {filteredIndicators.map((indicator) => (
                <IndicatorCard key={indicator.definition.id} indicator={indicator} />
              ))}
            </div>
          ) : (
            <IndicatorTable indicators={filteredIndicators} />
          )}
        </section>
      </div>
    </main>
  );
}

function IndicatorCard({ indicator }: { indicator: KpiRadarIndicator }) {
  return (
    <article className="group relative flex min-h-[430px] flex-col overflow-hidden rounded-lg border border-white/10 bg-white/[0.06] p-6 shadow-2xl backdrop-blur-2xl transition hover:-translate-y-1 hover:bg-white/[0.08] hover:shadow-teal-500/10">
      <div className="relative z-10 flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <span className="text-[10px] font-black uppercase tracking-[0.18em] text-teal-300">{indicator.definition.perspective}</span>
          <h3 className="line-clamp-2 text-xl font-black leading-tight text-white transition group-hover:text-teal-200">{indicator.definition.name}</h3>
          <p className="line-clamp-1 text-[11px] font-semibold text-white/30">{indicator.definition.strategic_goal ?? indicator.sourceLabel}</p>
        </div>
        <span className={cn("shrink-0 rounded-lg border px-2.5 py-1 text-xs font-black", darkStatusStyle(indicator.annualStatus))}>
          {getKpiStatusLabel(indicator.annualStatus)}
        </span>
      </div>

      <div className="relative z-10 mt-10 flex flex-1 flex-col justify-end">
        <div className="mb-4 flex items-baseline justify-between gap-3">
          <span className="text-3xl font-black tracking-tight text-white">
            {formatCompactValue(indicator.annualActual, indicator.definition.target_unit)}
          </span>
          <span className={cn("rounded-full border px-3 py-1 text-xs font-black", (indicator.annualAchievement ?? 0) >= 100 ? "border-teal-300/30 bg-teal-300/10 text-teal-200" : "border-rose-300/30 bg-rose-300/10 text-rose-200")}>
            {formatAchievement(indicator.annualAchievement)}
          </span>
        </div>

        <div className="mb-8 h-2 overflow-hidden rounded-full bg-white/10">
          <div
            className={cn("h-full rounded-full shadow-[0_0_12px_rgba(45,212,191,0.35)]", (indicator.annualAchievement ?? 0) >= 100 ? "bg-teal-400" : "bg-rose-400")}
            style={{ width: `${Math.min(indicator.annualAchievement ?? 0, 100)}%` }}
          />
        </div>

        <div className="grid grid-cols-4 gap-3">
          {indicator.quarters.map((quarter) => (
            <QuarterSpark key={quarter.key} quarter={quarter} unit={indicator.definition.target_unit} />
          ))}
        </div>
      </div>

      <div className="relative z-10 mt-8 flex items-center justify-between gap-3 border-t border-white/10 pt-5 text-xs font-bold text-white/35">
        <span>المستهدف السنوي: {formatCompactValue(indicator.annualTarget, indicator.definition.target_unit)}</span>
        <span>{indicator.lastUpdatedAt ? new Date(indicator.lastUpdatedAt).toLocaleDateString("ar-SA") : "لم يحدث بعد"}</span>
      </div>
    </article>
  );
}

function IndicatorTable({ indicators }: { indicators: KpiRadarIndicator[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-white/10 bg-white/[0.06] shadow-2xl backdrop-blur-2xl">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1500px] border-collapse text-right">
          <thead>
            <tr className="border-b border-white/10 bg-white/[0.08] text-[10px] font-black uppercase tracking-widest text-white/50">
              <th className="p-5">المؤشر الاستراتيجي</th>
              <th className="p-5">المستهدف السنوي</th>
              <th className="p-5 text-center">Q1</th>
              <th className="p-5 text-center">Q2</th>
              <th className="p-5 text-center">Q3</th>
              <th className="p-5 text-center">Q4</th>
              <th className="p-5">المتحقق السنوي</th>
              <th className="p-5">تقرير الأداء</th>
              <th className="p-5">آخر تحديث</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {indicators.map((indicator) => (
              <tr key={indicator.definition.id} className="transition hover:bg-white/[0.04]">
                <td className="p-5">
                  <p className="text-base font-black text-white">{indicator.definition.name}</p>
                  <p className="mt-1 inline-block rounded bg-white/[0.06] px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-white/30">
                    {indicator.definition.perspective}
                  </p>
                </td>
                <td className="whitespace-nowrap p-5 font-bold text-white/50">{formatCompactValue(indicator.annualTarget, indicator.definition.target_unit)}</td>
                {indicator.quarters.map((quarter) => (
                  <td key={quarter.key} className="p-5 text-center font-bold text-white/60">
                    <QuarterCell quarter={quarter} unit={indicator.definition.target_unit} />
                  </td>
                ))}
                <td className="p-5 text-lg font-black text-teal-300">{formatCompactValue(indicator.annualActual, indicator.definition.target_unit)}</td>
                <td className="p-5">
                  <div className="flex items-center gap-4">
                    <div className="h-2 w-28 overflow-hidden rounded-full bg-white/10">
                      <div
                        className={cn("h-full", (indicator.annualAchievement ?? 0) >= 100 ? "bg-teal-400" : "bg-rose-400")}
                        style={{ width: `${Math.min(indicator.annualAchievement ?? 0, 100)}%` }}
                      />
                    </div>
                    <span className="text-xs font-black text-white/70">{formatAchievement(indicator.annualAchievement)}</span>
                  </div>
                </td>
                <td className="p-5 text-xs font-bold text-white/35">
                  {indicator.lastUpdatedAt ? new Date(indicator.lastUpdatedAt).toLocaleDateString("ar-SA") : "لم يحدث بعد"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function QuarterSpark({ quarter, unit }: { quarter: KpiRadarQuarter; unit: string | null }) {
  const progress = Math.min(quarter.achievement ?? 0, 100);
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="text-[10px] font-black text-white/35">{quarter.key}</div>
      <div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
        <div className={cn("h-full transition-all", progress >= 100 ? "bg-teal-300/60" : "bg-white/25")} style={{ width: `${progress}%` }} />
      </div>
      <div className="text-center text-[10px] font-bold text-white/35">{formatCompactValue(quarter.value, unit)}</div>
    </div>
  );
}

function QuarterCell({ quarter, unit }: { quarter: KpiRadarQuarter; unit: string | null }) {
  return (
    <div className="mx-auto grid max-w-[180px] grid-cols-3 gap-2 rounded-lg bg-white/[0.05] px-3 py-2 text-right text-[11px]">
      <SmallValue label="مستهدف" value={formatCompactValue(quarter.target, unit)} />
      <SmallValue label="فعلي" value={formatCompactValue(quarter.value, unit)} />
      <SmallValue label="إنجاز" value={formatAchievement(quarter.achievement)} />
    </div>
  );
}

function PerspectiveButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex shrink-0 items-center gap-3 rounded-lg border px-4 py-3 text-sm font-bold transition lg:w-full",
        active
          ? "border-teal-300/30 bg-teal-500 text-white shadow-xl shadow-teal-500/20"
          : "border-transparent text-white/50 hover:border-white/10 hover:bg-white/[0.06] hover:text-white"
      )}
    >
      {children}
    </button>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: number; tone: "teal" | "rose" }) {
  return (
    <div className="relative overflow-hidden rounded-lg border border-white/10 bg-white/[0.06] p-4">
      <div className={cn("absolute right-0 top-0 h-full w-1", tone === "teal" ? "bg-teal-400" : "bg-rose-400")} />
      <p className="text-[10px] font-black uppercase tracking-widest text-white/30">{label}</p>
      <p className="mt-1 text-2xl font-black text-white">{value}</p>
    </div>
  );
}

function SmallValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="font-black text-white/25">{label}</p>
      <p className="mt-0.5 truncate font-black text-white/70">{value}</p>
    </div>
  );
}

function formatCompactValue(value: number | null | undefined, unit?: string | null) {
  if (value === null || value === undefined) return "لا يوجد";
  return formatKpiValue(value, unit);
}

function formatAchievement(value: number | null | undefined) {
  return value === null || value === undefined ? "غير متاح" : `${value}%`;
}

function average(values: number[]) {
  const usable = values.filter((value) => Number.isFinite(value));
  return usable.length ? usable.reduce((sum, value) => sum + value, 0) / usable.length : 0;
}

function darkStatusStyle(status: KpiStatus) {
  return cn(
    getKpiStatusStyle(status),
    status === "green" && "border-teal-300/30 bg-teal-300/10 text-teal-100",
    status === "yellow" && "border-amber-300/30 bg-amber-300/10 text-amber-100",
    status === "red" && "border-rose-300/30 bg-rose-300/10 text-rose-100",
    status === "neutral" && "border-white/10 bg-white/[0.06] text-white/45"
  );
}
