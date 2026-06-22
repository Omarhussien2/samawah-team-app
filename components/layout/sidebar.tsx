"use client";

import { useEffect, useState } from "react";
import type { ElementType } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Bell,
  CheckSquare,
  ChevronDown,
  ChevronLeft,
  FileText,
  FolderKanban,
  KanbanSquare,
  LayoutDashboard,
  ListTodo,
  Settings,
  ShieldAlert,
  Upload,
  Users,
  X,
  Zap,
} from "lucide-react";
import { dedupeProjectsById, uniqueProjectIds } from "@/lib/projects/project-access";
import { createClient } from "@/lib/supabase/client";
import type { Profile, Project } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

const globalNavItems = [
  { href: "/dashboard", label: "الرئيسية", icon: LayoutDashboard },
  { href: "/dashboard/analytics", label: "التحليلات", icon: BarChart3 },
  { href: "/projects", label: "المشاريع", icon: FolderKanban },
  { href: "/kpis", label: "مركز المؤشرات", icon: BarChart3 },
  { href: "/risk-indicators", label: "المخاطر", icon: ShieldAlert },
  { href: "/my-tasks", label: "مهامي", icon: CheckSquare },
  { href: "/notifications", label: "الإشعارات", icon: Bell },
];

const teamNavItems = [
  { href: "/team", label: "الفريق", icon: Users },
  { href: "/automations", label: "الأتمتة", icon: Zap },
  { href: "/import", label: "استيراد", icon: Upload },
  { href: "/settings", label: "الإعدادات", icon: Settings },
];

interface SidebarProps {
  user: Profile;
  onClose?: () => void;
}

interface NavItemProps {
  href: string;
  label: string;
  icon: ElementType;
  isSub?: boolean;
}

export function Sidebar({ user, onClose }: SidebarProps) {
  const pathname = usePathname();
  const [projects, setProjects] = useState<Project[]>([]);
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({});
  const [workspacesExpanded, setWorkspacesExpanded] = useState(true);

  useEffect(() => {
    const fetchProjects = async () => {
      const supabase = createClient();
      const { data: memberships } = await supabase
        .from("project_members")
        .select("project_id")
        .eq("user_id", user.id);
      const memberProjectIds = uniqueProjectIds((memberships ?? []).map((membership) => membership.project_id));
      const memberProjectsQuery = memberProjectIds.length
        ? supabase.from("projects").select("*").eq("status", "active").in("id", memberProjectIds)
        : null;
      const projectResults = await Promise.all([
        supabase.from("projects").select("*").eq("status", "active").eq("manager_id", user.id),
        supabase.from("projects").select("*").eq("status", "active").eq("forms_owner_id", user.id),
        ...(memberProjectsQuery ? [memberProjectsQuery] : []),
      ]);

      setProjects(dedupeProjectsById(projectResults.flatMap((result) => result.data ?? [])));
    };
    fetchProjects();
  }, [user.id]);

  const toggleProject = (id: string, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setExpandedProjects((current) => ({ ...current, [id]: !current[id] }));
  };

  const NavItem = ({ href, label, icon: Icon, isSub = false }: NavItemProps) => {
    const isActive = pathname === href;

    return (
      <Link
        href={href}
        onClick={onClose}
        className={cn(
          "flex items-center gap-3 rounded-lg border-r-2 px-3 py-2 text-sm font-medium transition-all group",
          isActive
            ? "border-primary bg-primary/10 text-primary"
            : "border-transparent text-muted-foreground hover:bg-accent hover:text-foreground",
        )}
      >
        <Icon
          size={isSub ? 16 : 18}
          className={cn(
            "transition-colors",
            isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground",
          )}
        />
        <span>{label}</span>
      </Link>
    );
  };

  return (
    <div className="flex h-full select-none flex-col border-l border-border bg-slate-50">
      <div className="flex items-center justify-between px-5 py-4">
        <Link href="/dashboard" className="flex items-center justify-center transition-opacity hover:opacity-80">
          <Image src="/logo.png" alt="شعار سماوة" width={44} height={44} className="h-11 w-11 object-contain" />
        </Link>
        {onClose && (
          <button
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-600 lg:hidden"
          >
            <X size={20} />
          </button>
        )}
      </div>

      <nav className="scrollbar-thin scrollbar-thumb-slate-200 flex-1 space-y-6 overflow-y-auto px-3 py-2">
        <div className="space-y-0.5">
          {globalNavItems.map((item) => (
            <NavItem key={item.href} {...item} />
          ))}
        </div>

        <div>
          <button
            onClick={() => setWorkspacesExpanded(!workspacesExpanded)}
            className="flex w-full items-center justify-between px-3 py-2 text-xs font-bold text-slate-500 transition-colors hover:text-slate-700 group"
          >
            <span>مساحات العمل</span>
            {workspacesExpanded ? (
              <ChevronDown size={14} className="opacity-0 transition-opacity group-hover:opacity-100" />
            ) : (
              <ChevronLeft size={14} className="opacity-0 transition-opacity group-hover:opacity-100" />
            )}
          </button>

          {workspacesExpanded && (
            <div className="mt-1 space-y-0.5">
              {projects.length === 0 ? (
                <div className="px-4 py-2 text-xs text-slate-400">لا توجد مشاريع نشطة</div>
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
                          "flex items-center gap-2 rounded-lg border-r-2 px-3 py-2 text-sm font-medium transition-all group",
                          isActiveProject
                            ? "border-primary bg-white text-primary shadow-sm"
                            : "border-transparent text-slate-600 hover:bg-slate-200/50 hover:text-slate-900",
                        )}
                      >
                        <button
                          onClick={(event) => toggleProject(project.id, event)}
                          className="rounded-sm p-0.5 text-slate-400 transition-colors hover:bg-slate-300"
                        >
                          {isExpanded ? <ChevronDown size={14} /> : <ChevronLeft size={14} />}
                        </button>
                        <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-gradient-to-br from-indigo-500 to-indigo-600 text-xs font-bold text-white shadow-sm">
                          {project.name.charAt(0)}
                        </div>
                        <span className="truncate">{project.name}</span>
                      </Link>

                      {isExpanded && (
                        <div className="mr-5 mb-1 mt-1 space-y-0.5 border-r border-slate-200 py-1 pl-2 pr-11">
                          <Link
                            href={`/projects/${project.id}?tab=board`}
                            onClick={onClose}
                            className={cn(
                              "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
                              pathname === `/projects/${project.id}` &&
                                typeof window !== "undefined" &&
                                window.location.search.includes("tab=board")
                                ? "bg-primary/5 text-primary"
                                : "text-slate-500 hover:bg-slate-200/50 hover:text-slate-800",
                            )}
                          >
                            <KanbanSquare size={14} /> اللوحة
                          </Link>
                          <Link
                            href={`/projects/${project.id}?tab=tasks`}
                            onClick={onClose}
                            className={cn(
                              "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
                              pathname === `/projects/${project.id}` &&
                                typeof window !== "undefined" &&
                                window.location.search.includes("tab=tasks")
                                ? "bg-primary/5 text-primary"
                                : "text-slate-500 hover:bg-slate-200/50 hover:text-slate-800",
                            )}
                          >
                            <ListTodo size={14} /> المهام
                          </Link>
                          <Link
                            href={`/projects/${project.id}?tab=documents`}
                            onClick={onClose}
                            className={cn(
                              "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
                              pathname === `/projects/${project.id}` &&
                                typeof window !== "undefined" &&
                                window.location.search.includes("tab=documents")
                                ? "bg-primary/5 text-primary"
                                : "text-slate-500 hover:bg-slate-200/50 hover:text-slate-800",
                            )}
                          >
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

        <div>
          <div className="px-3 py-2 text-xs font-bold text-slate-500">الإعدادات والفريق</div>
          <div className="mt-1 space-y-0.5">
            {teamNavItems.map((item) => (
              <NavItem key={item.href} {...item} />
            ))}
          </div>
        </div>
      </nav>

      <div className="flex items-center justify-center border-t border-border bg-slate-50/50 px-4 py-4">
        <Image src="/logo.png" alt="سماوة" width={28} height={28} className="h-7 w-7 object-contain opacity-50" />
      </div>
    </div>
  );
}
