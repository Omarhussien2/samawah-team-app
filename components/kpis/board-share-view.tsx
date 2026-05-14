"use client";

import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Building2, Clock, Eye, ShieldCheck } from "lucide-react";
import { KpiCard } from "@/components/kpis/kpi-card";
import { calculateKpiAchievement, getValueForKpi, summarizeKpiStatuses } from "@/lib/kpis/status";
import type { KpiBoardSnapshot } from "@/lib/kpis/share";
import type { KpiValue } from "@/lib/supabase/types";

const STATUS_COLORS = {
  green: "#10b981",
  yellow: "#f59e0b",
  red: "#f43f5e",
  neutral: "#94a3b8",
};

const STATUS_LABELS = {
  green: "ممتاز",
  yellow: "بحاجة متابعة",
  red: "متعثر",
  neutral: "بلا بيانات",
};

function latestValues(values: KpiValue[]) {
  const map = new Map<string, KpiValue>();
  values.forEach((value) => {
    if (!map.has(value.kpi_id)) map.set(value.kpi_id, value);
  });
  return Array.from(map.values());
}

export function BoardShareView({ snapshot }: { snapshot: KpiBoardSnapshot }) {
  const values = latestValues(snapshot.values);
  const statusSummary = summarizeKpiStatuses(snapshot.definitions, values);
  const statusData = Object.entries(statusSummary).map(([status, value]) => ({
    status,
    name: STATUS_LABELS[status as keyof typeof STATUS_LABELS],
    value,
  }));

  const sectionData = Object.values(
    snapshot.definitions.reduce<Record<string, { section: string; values: number[] }>>((acc, definition) => {
      const value = getValueForKpi(values, definition.id);
      const achievement = calculateKpiAchievement(value?.actual_value, definition.target_value, definition.direction);
      acc[definition.perspective] ??= { section: definition.perspective, values: [] };
      if (achievement !== null) acc[definition.perspective].values.push(Math.round(achievement));
      return acc;
    }, {})
  ).map((section) => ({
    section: section.section,
    achievement: section.values.length ? Math.round(section.values.reduce((sum, item) => sum + item, 0) / section.values.length) : 0,
  }));

  const critical = snapshot.definitions
    .filter((definition) => {
      const value = getValueForKpi(values, definition.id);
      return value?.status === "red" || value?.status === "yellow";
    })
    .slice(0, 8);

  return (
    <main className="min-h-screen bg-slate-950 text-white" dir="rtl">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="rounded-2xl border border-white/10 bg-white/[0.06] p-6 shadow-2xl">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-bold text-emerald-300">
                <ShieldCheck size={18} />
                رابط قراءة فقط
              </div>
              <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">لوحة مؤشرات سماوة لمجلس الإدارة</h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
                عرض تنفيذي محدث لأداء مؤشرات 2026 عبر المنظورات الاستراتيجية. لا توجد صلاحيات تعديل في هذا الرابط.
              </p>
            </div>
            <div className="grid gap-3 text-sm text-slate-300 sm:grid-cols-3 lg:min-w-[520px]">
              <div className="rounded-xl bg-white/10 p-4">
                <Building2 size={18} className="mb-2 text-indigo-300" />
                <p className="text-slate-400">المؤشرات</p>
                <p className="mt-1 text-2xl font-extrabold text-white">{snapshot.definitions.length}</p>
              </div>
              <div className="rounded-xl bg-white/10 p-4">
                <Eye size={18} className="mb-2 text-emerald-300" />
                <p className="text-slate-400">عدد المشاهدات</p>
                <p className="mt-1 text-2xl font-extrabold text-white">{snapshot.link.views_count}</p>
              </div>
              <div className="rounded-xl bg-white/10 p-4">
                <Clock size={18} className="mb-2 text-amber-300" />
                <p className="text-slate-400">تاريخ العرض</p>
                <p className="mt-1 text-base font-bold text-white">{new Date(snapshot.generatedAt).toLocaleString("ar-SA")}</p>
              </div>
            </div>
          </div>
        </header>

        <section className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-5">
          <div className="rounded-2xl border border-white/10 bg-white p-5 text-slate-900 shadow-xl xl:col-span-2">
            <h2 className="mb-4 text-lg font-extrabold">توزيع حالة المؤشرات</h2>
            <div className="h-72" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={74} outerRadius={108} paddingAngle={3}>
                    {statusData.map((entry) => (
                      <Cell key={entry.status} fill={STATUS_COLORS[entry.status as keyof typeof STATUS_COLORS]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white p-5 text-slate-900 shadow-xl xl:col-span-3">
            <h2 className="mb-4 text-lg font-extrabold">أداء المنظورات</h2>
            <div className="h-80" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sectionData} layout="vertical" margin={{ right: 16, left: 12 }}>
                  <XAxis type="number" domain={[0, 100]} hide />
                  <YAxis type="category" dataKey="section" width={135} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(value) => [`${value}%`, "الإنجاز"]} />
                  <Bar dataKey="achievement" fill="#4f46e5" radius={[6, 6, 6, 6]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>

        {critical.length > 0 && (
          <section className="mt-6 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-5">
            <h2 className="text-lg font-extrabold text-amber-100">مؤشرات تحتاج متابعة</h2>
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              {critical.map((definition) => (
                <div key={definition.id} className="rounded-xl bg-white/10 p-4">
                  <p className="text-xs font-bold text-amber-200">{definition.perspective}</p>
                  <p className="mt-1 text-sm font-bold">{definition.name}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {snapshot.definitions.slice(0, 12).map((definition) => (
            <KpiCard key={definition.id} definition={definition} value={getValueForKpi(values, definition.id)} />
          ))}
        </section>
      </div>
    </main>
  );
}
