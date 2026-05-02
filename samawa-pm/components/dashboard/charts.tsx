"use client";

import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { getStatusLabel } from "@/lib/utils";

const STATUS_COLORS: Record<string, string> = {
  "Backlog": "#a78bfa",
  "To Do": "#94a3b8",
  "In Progress": "#60a5fa",
  "Review": "#fbbf24",
  "Done": "#4ade80",
  "Cancelled": "#cbd5e1",
};

interface ChartsProps {
  tasks: Array<{ status: string; owner_id?: string | null }>;
  projects: Array<{ name: string; progress?: number | null; status: string }>;
}

export function DashboardCharts({ tasks, projects }: ChartsProps) {
  // Task distribution by status
  const statusCounts = tasks.reduce<Record<string, number>>((acc, t) => {
    acc[t.status] = (acc[t.status] ?? 0) + 1;
    return acc;
  }, {});
  const pieData = Object.entries(statusCounts).map(([key, value]) => ({
    name: getStatusLabel(key),
    value,
    color: STATUS_COLORS[key] ?? "#94a3b8",
  }));

  // Project progress
  const projectData = projects
    .filter((p) => p.status === "active")
    .slice(0, 8)
    .map((p) => ({ name: p.name.substring(0, 12), progress: Math.round(p.progress ?? 0) }));

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Pie chart */}
      <div className="bg-white rounded-xl border border-border p-5">
        <h3 className="font-semibold text-foreground mb-4">توزيع المهام حسب الحالة</h3>
        {pieData.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={11}>
                {pieData.map((entry, index) => (
                  <Cell key={index} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => [`${v} مهمة`, ""]} />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-[220px] text-muted-foreground text-sm">
            لا توجد مهام حتى الآن
          </div>
        )}
      </div>

      {/* Bar chart */}
      <div className="bg-white rounded-xl border border-border p-5">
        <h3 className="font-semibold text-foreground mb-4">نسبة إنجاز المشاريع</h3>
        {projectData.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={projectData} layout="vertical" margin={{ right: 20, left: 0 }}>
              <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} fontSize={11} />
              <YAxis type="category" dataKey="name" width={80} fontSize={11} />
              <Tooltip formatter={(v: number) => [`${v}%`, "الإنجاز"]} />
              <Bar dataKey="progress" fill="#4f46e5" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-[220px] text-muted-foreground text-sm">
            لا توجد مشاريع نشطة
          </div>
        )}
      </div>
    </div>
  );
}
