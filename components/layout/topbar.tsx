"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter, usePathname } from "next/navigation";
import { LogOut, Menu, Plus, Search, User, FileText, CheckSquare, FolderKanban, ChevronLeft, Home } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getAvatarUrl } from "@/lib/utils";
import Image from "next/image";
import Link from "next/link";
import type { Profile } from "@/lib/supabase/types";
import { QuickAddTaskModal } from "@/components/tasks/quick-add-task-modal";
import { NotificationBell } from "@/components/notifications/notification-bell";

interface TopbarProps {
  user: Profile;
  onMenuClick: () => void;
}

export function Topbar({ user, onMenuClick }: TopbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showQuickAddMenu, setShowQuickAddMenu] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  // Close menus on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-user-menu]")) setShowUserMenu(false);
      if (!target.closest("[data-quick-add]")) setShowQuickAddMenu(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Generate simple breadcrumbs
  const breadcrumbs = useMemo(() => {
    if (pathname === "/dashboard") return [{ label: "الرئيسية", href: "/dashboard" }];
    
    const parts = pathname.split("/").filter(Boolean);
    const crumbs = [{ label: <Home size={14} />, href: "/dashboard" }];
    
    let currentPath = "";
    parts.forEach((part, index) => {
      currentPath += `/${part}`;
      let label = part;
      if (part === "projects") label = "المشاريع";
      else if (part === "kpis") label = "مركز المؤشرات";
      else if (part === "my-tasks") label = "مهامي";
      else if (part === "board") label = "اللوحة";
      else if (part === "documents") label = "المستندات";
      else if (part === "team") label = "الفريق";
      else if (part === "settings") label = "الإعدادات";
      else if (part.length > 20) label = "تفاصيل"; // IDs
      
      crumbs.push({ label: label as any, href: currentPath });
    });
    
    return crumbs;
  }, [pathname]);

  return (
    <>
      <header className="h-14 bg-white border-b border-border flex items-center px-4 gap-4 sticky top-0 z-30 shadow-sm shadow-slate-100">
        {/* Mobile menu button */}
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
        >
          <Menu size={20} />
        </button>

        {/* Breadcrumbs (Desktop only) */}
        <div className="hidden md:flex items-center text-sm font-medium text-slate-500 space-x-reverse space-x-1">
          {breadcrumbs.map((crumb, index) => (
            <div key={crumb.href} className="flex items-center space-x-reverse space-x-1">
              <Link 
                href={crumb.href}
                className={`hover:text-primary transition-colors ${index === breadcrumbs.length - 1 ? "text-slate-800" : ""}`}
              >
                {crumb.label}
              </Link>
              {index < breadcrumbs.length - 1 && <ChevronLeft size={14} className="text-slate-400 mx-1" />}
            </div>
          ))}
        </div>

        {/* Search */}
        <div className="relative flex-1 max-w-lg mr-auto md:mr-6 lg:mr-10">
          <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
             placeholder="ابحث هنا... (اضغط /)"
            className="w-full pr-9 pl-3 py-1.5 text-sm bg-slate-100/80 border border-transparent hover:border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white transition-all placeholder:text-slate-400"
          />
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          {/* Quick Add Dropdown */}
          <div className="relative" data-quick-add>
            <button
              onClick={() => setShowQuickAddMenu(!showQuickAddMenu)}
              className="flex items-center justify-center w-8 h-8 sm:w-auto sm:px-3 sm:py-1.5 bg-primary text-white text-sm rounded-lg hover:bg-primary/90 transition-all font-medium shadow-sm hover:shadow active:scale-95"
            >
              <Plus size={16} className="sm:ml-1.5" />
               <span className="hidden sm:inline">أضف</span>
            </button>

            {showQuickAddMenu && (
              <div className="absolute left-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-100 py-1.5 z-50 animate-in slide-in-from-top-2 fade-in-0 duration-200">
                <button
                  onClick={() => { setShowTaskModal(true); setShowQuickAddMenu(false); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <div className="w-6 h-6 rounded bg-indigo-50 text-indigo-600 flex items-center justify-center"><CheckSquare size={14} /></div>
                  مهمة جديدة
                </button>
                <Link
                  href="/projects" // Or a create project modal if exists
                  onClick={() => setShowQuickAddMenu(false)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <div className="w-6 h-6 rounded bg-emerald-50 text-emerald-600 flex items-center justify-center"><FolderKanban size={14} /></div>
                  مشروع جديد
                </Link>
                <Link
                  href="/documents"
                  onClick={() => setShowQuickAddMenu(false)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <div className="w-6 h-6 rounded bg-sky-50 text-sky-600 flex items-center justify-center"><FileText size={14} /></div>
                  مستند جديد
                </Link>
              </div>
            )}
          </div>

          {/* Notifications */}
          <div className="mx-1">
            <NotificationBell userId={user.id} />
          </div>

          {/* User Menu */}
          <div className="relative ml-1" data-user-menu>
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 p-1 rounded-full hover:bg-slate-100 transition-colors border border-transparent hover:border-slate-200"
            >
              <Image
                src={user.avatar_url ?? getAvatarUrl(user.full_name)}
                alt={user.full_name ?? ""}
                width={32}
                height={32}
                className="w-8 h-8 rounded-full object-cover shadow-sm"
              />
            </button>

            {showUserMenu && (
              <div className="absolute left-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-100 py-1.5 z-50 animate-in slide-in-from-top-2 fade-in-0 duration-200">
                <div className="px-4 py-3 border-b border-slate-100 mb-1">
                  <p className="font-semibold text-sm text-slate-800 truncate">{user.full_name}</p>
                  <p className="text-xs text-slate-500 truncate mt-0.5">{user.email}</p>
                </div>
                <Link href="/settings" className="flex items-center gap-2.5 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors">
                  <User size={16} className="text-slate-400" />
                   الملف الشخصي
                 </Link>
                 <div className="h-px bg-slate-100 my-1.5 mx-2" />
                 <button
                   onClick={handleLogout}
                   className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                 >
                   <LogOut size={16} className="text-red-500" />
                   خروج
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <QuickAddTaskModal open={showTaskModal} onClose={() => setShowTaskModal(false)} />
    </>
  );
}
