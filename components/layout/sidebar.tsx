"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, FolderKanban, CheckSquare, KanbanSquare,
  AlertTriangle, FileText, Users, Zap, Settings, Upload, X, Bell,
  ChevronDown, ChevronLeft, Star, Folder, Hash, ListTodo, BarChart3
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Project } from "@/lib/supabase/types";

const globalNavItems = [
  { href: "/dashboard",     label: "الرئيسية",   icon: LayoutDashboard },
  { href: "/dashboard/analytics", label: "التحليلات", icon: BarChart3 },
  { href: "/projects",      label: "المشاريع",   icon: FolderKanban },
  { href: "/kpis",          label: "مركز المؤشرات", icon: BarChart3 },
  { href: "/my-tasks",      label: "مهامي",      icon: CheckSquare },
  { href: "/notifications", label: "الإشعارات",  icon: Bell },
];

const teamNavItems = [
  { href: "/team",          label: "الفريق",     icon: Users },
  { href: "/automations",   label: "الأتمتة",    icon: Zap },
  { href: "/import",        label: "استيراد",    icon: Upload },
  { href: "/settings",      label: "الإعدادات",  icon: Settings },
];

interface SidebarProps {
  onClose?: () => void;
}

export function Sidebar({ onClose }: SidebarProps) {
  const pathname = usePathname();
  const [projects, setProjects] = useState<Project[]>([]);
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({});
  const [workspacesExpanded, setWorkspacesExpanded] = useState(true);

  useEffect(() => {
    const fetchProjects = async () => {
      const supabase = createClient();
      const { data } = await supabase.from("projects").select("*").eq("status", "active").order("created_at", { ascending: false });
      if (data) setProjects(data);
    };
    fetchProjects();
  }, []);

  const toggleProject = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setExpandedProjects((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const NavItem = ({ href, label, icon: Icon, isSub = false }: any) => {
    const isActive = pathname === href;
    return (
      <Link
        href={href}
        onClick={onClose}
        className={cn(
          "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all group",
          isActive
            ? "bg-primary/10 text-primary border-r-2 border-primary"
            : "text-muted-foreground hover:bg-accent hover:text-foreground border-r-2 border-transparent"
        )}
      >
        <Icon size={isSub ? 16 : 18} className={cn(
          "transition-colors",
          isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
        )} />
        <span>{label}</span>
      </Link>
    );
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 border-l border-border select-none">
      {/* Logo */}
      <div className="flex items-center justify-between px-5 py-4">
        <Link href="/dashboard" className="flex items-center justify-center transition-opacity hover:opacity-80">
          <Image src="/logo.png" alt="شعار سماوة" width={44} height={44} className="w-11 h-11 object-contain" />
        </Link>
        {onClose && (
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 lg:hidden p-1 rounded-md hover:bg-slate-200 transition-colors">
            <X size={20} />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-6 scrollbar-thin scrollbar-thumb-slate-200">
        
        {/* Global Nav */}
        <div className="space-y-0.5">
          {globalNavItems.map((item) => (
            <NavItem key={item.href} {...item} />
          ))}
        </div>

        {/* Workspaces (Projects) */}
        <div>
          <button
            onClick={() => setWorkspacesExpanded(!workspacesExpanded)}
            className="flex items-center justify-between w-full px-3 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 transition-colors group"
          >
            <span>مساحات العمل</span>
            {workspacesExpanded ? (
              <ChevronDown size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
            ) : (
              <ChevronLeft size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
            )}
          </button>

          {workspacesExpanded && (
            <div className="mt-1 space-y-0.5">
              {projects.length === 0 ? (
                 <div className="px-4 py-2 text-xs text-slate-400">ما فيه مشاريع نشطة</div>
              ) : (
                projects.map((project) => {
                  const isExpanded = expandedProjects[project.id];
                  const isActiveProject = pathname.startsWith(`/projects/${project.id}`);
                  
                  return (
                    <div key={project.id} className="flex flex-col">
                      <Link
                        href={`/projects/${project.id}`}
                        onClick={onClose}
                        className={cn(
                          "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all group",
                          isActiveProject
                            ? "bg-white text-primary shadow-sm border-r-2 border-primary"
                            : "text-slate-600 hover:bg-slate-200/50 hover:text-slate-900 border-r-2 border-transparent"
                        )}
                      >
                        <button 
                          onClick={(e) => toggleProject(project.id, e)}
                          className="p-0.5 rounded-sm hover:bg-slate-300 text-slate-400 transition-colors"
                        >
                          {isExpanded ? <ChevronDown size={14} /> : <ChevronLeft size={14} />}
                        </button>
                        <div className="w-5 h-5 rounded flex items-center justify-center text-xs font-bold text-white shadow-sm flex-shrink-0 bg-gradient-to-br from-indigo-500 to-indigo-600">
                          {project.name.charAt(0)}
                        </div>
                        <span className="truncate">{project.name}</span>
                      </Link>

                      {/* Nested Items */}
                      {isExpanded && (
                        <div className="pr-11 pl-2 py-1 space-y-0.5 border-r border-slate-200 mr-5 mt-1 mb-1">
                          <Link href={`/projects/${project.id}?tab=board`} onClick={onClose}
                                className={cn("flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-medium transition-colors", pathname === `/projects/${project.id}` && typeof window !== 'undefined' && window.location.search.includes('tab=board') ? "text-primary bg-primary/5" : "text-slate-500 hover:text-slate-800 hover:bg-slate-200/50")}>
                            <KanbanSquare size={14} /> اللوحة
                          </Link>
                          <Link href={`/projects/${project.id}?tab=tasks`} onClick={onClose}
                                className={cn("flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-medium transition-colors", pathname === `/projects/${project.id}` && typeof window !== 'undefined' && window.location.search.includes('tab=tasks') ? "text-primary bg-primary/5" : "text-slate-500 hover:text-slate-800 hover:bg-slate-200/50")}>
                            <ListTodo size={14} /> المهام
                          </Link>
                          <Link href={`/projects/${project.id}?tab=documents`} onClick={onClose}
                                className={cn("flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-medium transition-colors", pathname === `/projects/${project.id}` && typeof window !== 'undefined' && window.location.search.includes('tab=documents') ? "text-primary bg-primary/5" : "text-slate-500 hover:text-slate-800 hover:bg-slate-200/50")}>
                            <FileText size={14} /> المستندات
                          </Link>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Team & Settings */}
        <div>
          <div className="px-3 py-2 text-xs font-bold text-slate-500">الإعدادات والفريق</div>
          <div className="mt-1 space-y-0.5">
            {teamNavItems.map((item) => (
              <NavItem key={item.href} {...item} />
            ))}
          </div>
        </div>

      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-border bg-slate-50/50 flex items-center justify-center">
        <Image src="/logo.png" alt="سماوة" width={28} height={28} className="w-7 h-7 object-contain opacity-50" />
      </div>
    </div>
  );
}
