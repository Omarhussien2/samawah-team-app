"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { CheckCircle2, Clock, AlertTriangle, FolderKanban, ArrowUpRight, MessageSquare, CheckSquare } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  user: any;
  projects: any[];
  tasks: any[];
  comments: any[];
}

export function DashboardClient({ user, projects, tasks, comments }: Props) {
  const [localTasks, setLocalTasks] = useState(tasks);

  // Greeting logic
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "صباح الخير" : hour < 18 ? "مساء الخير" : "طاب مساؤك";
  const todayStr = new Date().toISOString().split("T")[0];

  // Calculate metrics
  const activeProjectsCount = projects.filter(p => p.status === "active").length;
  
  const todayTasks = localTasks.filter(t => t.due_date === todayStr && !["Done", "Cancelled"].includes(t.status));
  const overdueTasks = localTasks.filter(t => t.due_date && t.due_date < todayStr && !["Done", "Cancelled"].includes(t.status));
  
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const completedThisWeek = localTasks.filter(t => t.status === "Done" && new Date(t.updated_at) >= weekAgo).length;

  // Chart data: tasks created vs completed last 7 days
  const chartData = useMemo(() => {
    const data = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      
      const created = localTasks.filter(t => t.created_at.startsWith(dateStr)).length;
      const completed = localTasks.filter(t => t.status === "Done" && t.updated_at?.startsWith(dateStr)).length;
      
      data.push({
        name: format(d, 'EEEE', { locale: ar }), // Day name in Arabic
        جديدة: created,
        مكتملة: completed
      });
    }
    return data;
  }, [localTasks]);

  // Mark task as done
  const handleMarkDone = async (taskId: string) => {
    setLocalTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: "Done" } : t));
    toast.success("تم إنجاز المهمة!");
    const supabase = createClient();
    await supabase.from("tasks").update({ status: "Done", board_column: "Done", progress: 100 }).eq("id", taskId);
  };

  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500 fade-in-0">
      
      {/* Welcome Section */}
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-slate-500 uppercase tracking-wide">
          {format(new Date(), "EEEE، d MMMM yyyy", { locale: ar })}
        </p>
        <h1 className="text-3xl font-bold font-heading text-slate-900 tracking-tight">
          {greeting}، {user.full_name?.split(" ")[0] || "مرحباً"}! 👋
        </h1>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "المشاريع النشطة", value: activeProjectsCount, icon: FolderKanban, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "مهام اليوم", value: todayTasks.length, icon: Clock, color: "text-amber-600", bg: "bg-amber-50" },
          { label: "مهام متأخرة", value: overdueTasks.length, icon: AlertTriangle, color: "text-red-600", bg: "bg-red-50" },
          { label: "إنجاز الأسبوع", value: completedThisWeek, icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50" },
        ].map((stat, i) => (
          <div key={i} className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-slate-500">{stat.label}</p>
                <h3 className="text-3xl font-bold text-slate-800 mt-2">{stat.value}</h3>
              </div>
              <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", stat.bg, stat.color)}>
                <stat.icon size={20} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Chart & Project Progress */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Chart */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold font-heading text-slate-800">أداء الأسبوع</h2>
            </div>
            <div className="h-72 w-full" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 0, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dx={-10} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    itemStyle={{ fontSize: '13px', fontWeight: 500 }}
                  />
                  <Line type="monotone" dataKey="مكتملة" stroke="#10b981" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                  <Line type="monotone" dataKey="جديدة" stroke="#6366f1" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Project Progress */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold font-heading text-slate-800">نشاط المشاريع</h2>
              <Link href="/projects" className="text-sm text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1">
                عرض الكل <ArrowUpRight size={14} />
              </Link>
            </div>
            <div className="space-y-5">
              {projects.filter(p => p.status === 'active').slice(0, 4).map((project) => (
                <div key={project.id} className="group">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-semibold text-slate-700 group-hover:text-indigo-600 transition-colors">{project.name}</span>
                    <span className="text-xs font-bold text-slate-500">{project.progress}%</span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-indigo-500 rounded-full transition-all duration-1000 ease-out" 
                      style={{ width: `${project.progress}%` }} 
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Tasks & Timeline */}
        <div className="space-y-6">
          
          {/* Today's Tasks */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col h-[400px]">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold font-heading text-slate-800 flex items-center gap-2">
                <CheckSquare size={18} className="text-indigo-600" />
                مهام اليوم
              </h2>
            </div>
            <div className="flex-1 overflow-y-auto pr-2 -mr-2 space-y-2 scrollbar-thin scrollbar-thumb-slate-200">
              {todayTasks.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center px-4">
                  <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mb-3">
                    <CheckCircle2 size={24} className="text-slate-300" />
                  </div>
                  <p className="text-sm text-slate-500 font-medium">لا توجد مهام مستحقة اليوم</p>
                </div>
              ) : (
                todayTasks.map((task) => (
                  <div key={task.id} className="group flex items-start gap-3 p-3 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-colors cursor-pointer">
                    <button onClick={() => handleMarkDone(task.id)} className="mt-0.5 text-slate-300 hover:text-emerald-500 transition-colors">
                      <CheckCircle2 size={18} />
                    </button>
                    <div>
                      <p className="text-sm font-medium text-slate-700 group-hover:text-slate-900 leading-tight">{task.title}</p>
                      <p className="text-xs text-slate-400 mt-1">{projects.find(p => p.id === task.project_id)?.name}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Activity Timeline */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col h-[350px]">
            <div className="mb-4">
              <h2 className="text-lg font-bold font-heading text-slate-800">آخر التحديثات</h2>
            </div>
            <div className="flex-1 overflow-y-auto pr-2 -mr-2 scrollbar-thin scrollbar-thumb-slate-200">
              <div className="relative border-r-2 border-slate-100 right-3 mr-1 space-y-6 pb-4">
                {comments.map((comment, i) => (
                  <div key={comment.id} className="relative pr-6">
                    <div className="absolute right-[-5px] top-1 w-2.5 h-2.5 rounded-full bg-indigo-500 border-2 border-white shadow-sm" />
                    <div className="flex items-start gap-2">
                      <div className="bg-slate-50 rounded-lg p-3 border border-slate-100 text-sm flex-1">
                        <p className="font-semibold text-slate-800 text-xs mb-1">{comment.user?.full_name}</p>
                        <p className="text-slate-600 line-clamp-2">{comment.body}</p>
                      </div>
                    </div>
                  </div>
                ))}
                {comments.length === 0 && (
                  <p className="text-sm text-slate-400 pr-6">لا توجد نشاطات حديثة</p>
                )}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
