"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Edit, MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { formatDateShort, getProjectStatusLabel, cn } from "@/lib/utils";
import { KanbanBoard } from "@/components/board/kanban-board";
import { TasksTable } from "@/components/tasks/tasks-table";
import { ChallengesList } from "@/components/challenges/challenges-list";
import { DocumentsList } from "@/components/documents/documents-list";
import type { Profile, Project, Task, Challenge, Document } from "@/lib/supabase/types";

const TABS = [
  { key: "overview", label: "نظرة عامة" },
  { key: "board", label: "اللوحة" },
  { key: "tasks", label: "المهام" },
  { key: "challenges", label: "التحديات" },
  { key: "documents", label: "المستندات" },
];

interface Props {
  project: Project & { manager?: Pick<Profile, "id" | "full_name" | "avatar_url"> | null };
  tasks: (Task & { owner?: Pick<Profile, "id" | "full_name" | "avatar_url"> | null })[];
  challenges: (Challenge & { owner?: Pick<Profile, "id" | "full_name"> | null })[];
  documents: (Document & { creator?: Pick<Profile, "id" | "full_name"> | null })[];
  profiles: Pick<Profile, "id" | "full_name" | "avatar_url">[];
  currentUser: Profile;
}

export function ProjectDetailClient({ project, tasks, challenges, documents, profiles, currentUser }: Props) {
  const [activeTab, setActiveTab] = useState("overview");
  const progress = Math.round(project.progress ?? 0);

  return (
    <div>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Link href="/projects" className="hover:text-primary flex items-center gap-1">
          <ArrowRight size={14} />
          المشاريع
        </Link>
        <span>/</span>
        <span className="text-foreground font-medium">{project.name}</span>
      </div>

      {/* Header */}
      <div className="bg-white rounded-xl border border-border p-6 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-primary/10 rounded-xl flex items-center justify-center text-primary font-bold text-2xl flex-shrink-0">
              {project.name[0]}
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">{project.name}</h1>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                <span className="text-sm text-muted-foreground">{project.manager?.full_name ?? project.manager_name ?? "—"}</span>
                {project.current_stage && (
                  <span className="text-xs bg-accent px-2 py-0.5 rounded-full text-muted-foreground">{project.current_stage}</span>
                )}
                <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium",
                  project.status === "active" ? "bg-green-100 text-green-700" :
                  project.status === "paused" ? "bg-amber-100 text-amber-700" :
                  "bg-gray-100 text-gray-600"
                )}>
                  {getProjectStatusLabel(project.status)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {project.description && (
          <p className="mt-4 text-sm text-muted-foreground">{project.description}</p>
        )}

        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-muted-foreground mb-1">تاريخ البداية</p>
            <p className="text-sm font-medium">{formatDateShort(project.start_date)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">تاريخ الانتهاء</p>
            <p className="text-sm font-medium">{formatDateShort(project.end_date)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">الميزانية</p>
            <p className="text-sm font-medium">{project.total_budget?.toLocaleString("ar") ?? "—"} ر.س</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">الإنجاز</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full" style={{ width: `${progress}%` }} />
              </div>
              <span className="text-sm font-medium">{progress}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border mb-6 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors",
              activeTab === tab.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-border p-5">
            <p className="text-sm font-medium text-muted-foreground mb-2">إجمالي المهام</p>
            <p className="text-3xl font-bold text-foreground">{tasks.length}</p>
          </div>
          <div className="bg-white rounded-xl border border-border p-5">
            <p className="text-sm font-medium text-muted-foreground mb-2">المهام المكتملة</p>
            <p className="text-3xl font-bold text-green-600">{tasks.filter(t => t.status === "Done").length}</p>
          </div>
          <div className="bg-white rounded-xl border border-border p-5">
            <p className="text-sm font-medium text-muted-foreground mb-2">التحديات المفتوحة</p>
            <p className="text-3xl font-bold text-amber-600">{challenges.filter(c => c.status === "open").length}</p>
          </div>
        </div>
      )}
      {activeTab === "board" && (
        <KanbanBoard tasks={tasks} projectId={project.id} profiles={profiles} />
      )}
      {activeTab === "tasks" && (
        <TasksTable tasks={tasks} profiles={profiles} projectId={project.id} />
      )}
      {activeTab === "challenges" && (
        <ChallengesList challenges={challenges} profiles={profiles} projectId={project.id} />
      )}
      {activeTab === "documents" && (
        <DocumentsList documents={documents} projectId={project.id} currentUser={currentUser} />
      )}
    </div>
  );
}
