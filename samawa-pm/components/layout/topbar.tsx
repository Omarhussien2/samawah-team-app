"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, LogOut, Menu, Plus, Search, User } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn, getAvatarUrl, avatarFallback } from "@/lib/utils";
import type { Profile } from "@/lib/supabase/types";
import { QuickAddTaskModal } from "@/components/tasks/quick-add-task-modal";

interface TopbarProps {
  user: Profile;
  onMenuClick: () => void;
}

export function Topbar({ user, onMenuClick }: TopbarProps) {
  const router = useRouter();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <>
      <header className="h-14 bg-white border-b border-border flex items-center px-4 gap-3 sticky top-0 z-30">
        {/* Mobile menu button */}
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-lg hover:bg-accent text-muted-foreground"
        >
          <Menu size={20} />
        </button>

        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="البحث عن مشروع أو مهمة..."
            className="w-full pr-9 pl-3 py-2 text-sm bg-accent border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          />
        </div>

        <div className="flex items-center gap-2 mr-auto">
          {/* Quick Add */}
          <button
            onClick={() => setShowQuickAdd(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-primary text-white text-sm rounded-lg hover:bg-primary/90 transition-colors font-medium"
          >
            <Plus size={16} />
            <span className="hidden sm:inline">مهمة سريعة</span>
          </button>

          {/* Notifications */}
          <button className="relative p-2 rounded-lg hover:bg-accent text-muted-foreground">
            <Bell size={20} />
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
          </button>

          {/* User Menu */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-accent"
            >
              <img
                src={user.avatar_url ?? getAvatarUrl(user.full_name)}
                alt={user.full_name ?? ""}
                className="w-8 h-8 rounded-full object-cover"
              />
              <span className="hidden sm:inline text-sm font-medium text-foreground">
                {user.full_name ?? user.email}
              </span>
            </button>

            {showUserMenu && (
              <div className="absolute left-0 mt-1 w-52 bg-white rounded-xl shadow-lg border border-border py-1 z-50">
                <div className="px-4 py-2 border-b border-border">
                  <p className="font-medium text-sm text-foreground">{user.full_name}</p>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                </div>
                <a href="/settings" className="flex items-center gap-2 px-4 py-2 text-sm text-foreground hover:bg-accent">
                  <User size={15} />
                  الملف الشخصي
                </a>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                >
                  <LogOut size={15} />
                  تسجيل الخروج
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <QuickAddTaskModal open={showQuickAdd} onClose={() => setShowQuickAdd(false)} />
    </>
  );
}
