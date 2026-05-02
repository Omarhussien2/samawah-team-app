"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, FolderKanban, CheckSquare, KanbanSquare,
  AlertTriangle, FileText, Users, Zap, Settings, Upload, X
} from "lucide-react";

const navItems = [
  { href: "/dashboard",   label: "الرئيسية",  icon: LayoutDashboard },
  { href: "/projects",    label: "المشاريع",  icon: FolderKanban },
  { href: "/my-tasks",    label: "مهامي",     icon: CheckSquare },
  { href: "/board",       label: "اللوحة",    icon: KanbanSquare },
  { href: "/challenges",  label: "التحديات",  icon: AlertTriangle },
  { href: "/documents",   label: "المستندات", icon: FileText },
  { href: "/team",        label: "الفريق",    icon: Users },
  { href: "/automations", label: "الأتمتة",   icon: Zap },
  { href: "/import",      label: "استيراد",   icon: Upload },
  { href: "/settings",    label: "الإعدادات", icon: Settings },
];

interface SidebarProps {
  onClose?: () => void;
}

export function Sidebar({ onClose }: SidebarProps) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col h-full bg-white border-l border-border">
      {/* Logo */}
      <div className="flex items-center justify-between px-4 py-5 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">س</span>
          </div>
          <span className="font-bold text-lg text-foreground">سماوة</span>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground lg:hidden">
            <X size={20} />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <Icon size={18} className={isActive ? "text-primary" : ""} />
              <span>{item.label}</span>
              {isActive && (
                <div className="mr-auto w-1.5 h-1.5 rounded-full bg-primary" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-border">
        <p className="text-xs text-muted-foreground text-center">
          سماوة © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
