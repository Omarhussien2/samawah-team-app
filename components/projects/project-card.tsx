import Link from "next/link";
import {
  cn,
  formatDateShort,
  getAvatarUrl,
  getProjectStatusLabel,
  getProjectTypeBadgeClass,
  getProjectTypeLabel,
} from "@/lib/utils";
import Image from "next/image";
import type { Profile, Project } from "@/lib/supabase/types";
import { CalendarDays, Users } from "lucide-react";

const statusColors: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700 border-emerald-100",
  paused: "bg-amber-50 text-amber-700 border-amber-100",
  completed: "bg-blue-50 text-blue-700 border-blue-100",
  cancelled: "bg-slate-50 text-slate-500 border-slate-100",
};

interface Props {
  project: Project & { manager?: Pick<Profile, "id" | "full_name" | "avatar_url"> | null };
}

export function ProjectCard({ project }: Props) {
  const progress = Math.round(project.progress ?? 0);
  const radius = 16;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <Link href={`/projects/${project.id}`} className="block group">
      <div className="bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-lg hover:border-indigo-300 transition-all duration-300 relative overflow-hidden">
        
        {/* Subtle decorative background blur */}
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-indigo-50 rounded-full blur-3xl opacity-50 group-hover:bg-indigo-100 transition-colors pointer-events-none" />

        <div className="relative z-10">
          {/* Header */}
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              {project.logo_url ? (
                <Image src={project.logo_url} alt="" width={48} height={48} className="w-12 h-12 rounded-xl object-cover shadow-sm border border-slate-100" />
              ) : (
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-sm bg-gradient-to-br from-indigo-500 to-indigo-600">
                  {project.name[0]}
                </div>
              )}
              <div>
                <h3 className="font-bold text-slate-800 text-lg group-hover:text-indigo-600 transition-colors line-clamp-1">
                  {project.name}
                </h3>
                {project.current_stage && (
                  <p className="text-xs font-medium text-slate-500 mt-0.5">{project.current_stage}</p>
                )}
                <span className={cn("mt-2 inline-flex w-fit rounded-md border px-2 py-0.5 text-[11px] font-bold", getProjectTypeBadgeClass(project.project_type))}>
                  {getProjectTypeLabel(project.project_type)}
                </span>
              </div>
            </div>
          </div>

          {/* Body: Status & Progress Ring */}
          <div className="flex items-center justify-between mb-5 bg-slate-50/50 rounded-xl p-3 border border-slate-100">
            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-slate-500 font-medium">حالة المشروع</span>
              <span className={cn("text-xs px-2.5 py-1 rounded-md font-bold border w-fit", statusColors[project.status] ?? "bg-gray-100 text-gray-600")}>
                {getProjectStatusLabel(project.status)}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex flex-col items-end gap-0.5">
                <span className="text-xs text-slate-500 font-medium">الإنجاز</span>
                <span className="text-sm font-bold text-slate-800">{progress}%</span>
              </div>
              <div className="relative w-10 h-10 flex items-center justify-center">
                <svg className="transform -rotate-90 w-10 h-10">
                  <circle cx="20" cy="20" r={radius} className="stroke-slate-200" strokeWidth="4" fill="none" />
                  <circle
                    cx="20"
                    cy="20"
                    r={radius}
                    className="stroke-indigo-600 transition-all duration-1000 ease-out"
                    strokeWidth="4"
                    fill="none"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                  />
                </svg>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between mt-auto border-t border-slate-100 pt-3">
            <div className="flex items-center gap-2">
              {project.manager ? (
                <div className="flex items-center gap-2">
                  <Image
                    src={project.manager.avatar_url ?? getAvatarUrl(project.manager.full_name)}
                    width={20} height={20} alt=""
                    className="w-5 h-5 rounded-full object-cover shadow-sm"
                  />
                  <span className="text-xs font-medium text-slate-600">{project.manager.full_name}</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
                  <Users size={14} /> بدون مدير
                </div>
              )}
            </div>
            
            {project.end_date && (
              <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
                <CalendarDays size={12} className="text-slate-400" />
                <span>{formatDateShort(project.end_date)}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
