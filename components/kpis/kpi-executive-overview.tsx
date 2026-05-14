"use client";

import { AlertTriangle, BarChart3, CheckCircle2, CircleDashed, Target } from "lucide-react";
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { calculateKpiAchievement, calculateKpiStatus, getValueForKpi, summarizeKpiStatuses } from "@/lib/kpis/status";
import type { KpiDefinition, KpiValue } from "@/lib/supabase/types";

interface Props {
  definitions: KpiDefinition[];
  values: KpiValue[];
}

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

export function KpiExecutiveOverview({ definitions, values }: Props) {
  const statusSummary = summarizeKpiStatuses(definitions, values);
  const statusData = Object.entries(statusSummary).map(([status, count]) => ({
    status,
    name: STATUS_LABELS[status as keyof typeof STATUS_LABELS],
    value: count,
  }));

  const sectionData = Object.values(
    definitions.reduce<Record<string, { section: string; total: number; values: number[] }>>((acc, definition) => {
      const value = getValueForKpi(values, definition.id);
      const achievement = calculateKpiAchievement(value?.actual_value, definition.target_value, definition.direction);
      acc[definition.perspective] ??= { section: definition.perspective, total: 0, values: [] };
      acc[definition.perspective].total += 1;
      if (achievement !== null) acc[definition.perspective].values.push(Math.round(achievement));
      return acc;
    }, {})
  ).map((section) => ({
    section: section.section,
    achievement: section.values.length
      ? Math.round(section.values.reduce((sum, item) => sum + item, 0) / section.values.length)
      : 0,
    total: section.total,
  }));

  const updatedValues = values.filter((value) => value.actual_value !== null).length;
  const critical = definitions
    .map((definition) => {
      const value = getValueForKpi(values, definition.id);
      const status = value?.status ?? calculateKpiStatus(definition, value?.actual_value);
      return { definition, value, status };
    })
    .filter((item) => item.status === "red" || item.status === "yellow")
    .slice(0, 6);

  const cards = [
    { label: "إجمالي المؤشرات", value: definitions.length, icon: Target, color: "text-indigo-600", bg: "bg-indigo-50" },
    { label: "مؤشرات محدثة", value: updatedValues, icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50" },
    { label: "بحاجة متابعة", value: statusSummary.yellow, icon: AlertTriangle, color: "text-amber-600", bg: "bg-amber-50" },
    { label: "بلا بيانات", value: statusSummary.neutral, icon: CircleDashed, color: "text-slate-600", bg: "bg-slate-100" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">{card.label}</p>
                <p className="mt-2 text-3xl font-extrabold text-slate-900">{card.value}</p>
              </div>
              <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${card.bg} ${card.color}`}>
                <card.icon size={22} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2">
          <div className="mb-4 flex items-center gap-2">
            <BarChart3 size={18} className="text-indigo-600" />
            <h2 className="text-base font-bold text-slate-900">توزيع حالة المؤشرات</h2>
          </div>
          <div className="h-72" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={70} outerRadius={105} paddingAngle={3}>
                  {statusData.map((entry) => (
                    <Cell key={entry.status} fill={STATUS_COLORS[entry.status as keyof typeof STATUS_COLORS]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {statusData.map((item) => (
              <div key={item.status} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                <span>{item.name}</span>
                <span className="font-bold">{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-3">
          <h2 className="mb-4 text-base font-bold text-slate-900">إنجاز الأقسام</h2>
          <div className="h-80" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sectionData} layout="vertical" margin={{ right: 16, left: 16 }}>
                <XAxis type="number" domain={[0, 100]} hide />
                <YAxis type="category" dataKey="section" width={130} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value) => [`${value}%`, "الإنجاز"]} />
                <Bar dataKey="achievement" fill="#4f46e5" radius={[6, 6, 6, 6]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-bold text-slate-900">أهم المؤشرات التي تحتاج انتباه</h2>
        {critical.length === 0 ? (
          <p className="mt-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
            لا توجد مؤشرات متعثرة أو بحاجة متابعة في الفترة الحالية.
          </p>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            {critical.map(({ definition, status, value }) => (
              <div key={definition.id} className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold text-slate-500">{definition.perspective}</p>
                    <p className="mt-1 text-sm font-bold text-slate-900">{definition.name}</p>
                  </div>
                  <span className={status === "red" ? "text-rose-600" : "text-amber-600"}>
                    {STATUS_LABELS[status]}
                  </span>
                </div>
                {value?.notes && <p className="mt-2 line-clamp-2 text-xs text-slate-500">{value.notes}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
