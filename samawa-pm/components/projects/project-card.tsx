import Link from "next/link";
import { formatDateShort, getProjectStatusLabel, cn } from "@/lib/utils";
import type { Profile, Project } from "@/lib/supabase/types";
import { CalendarDays, User } from "lucide-react";

const statusColors: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  paused: "bg-amber-100 text-amber-700",
  completed: "bg-blue-100 text-blue-700",
  cancelled: "bg-gray-100 text-gray-500",
};

interface Props {
  project: Project & { manager?: Pick<Profile, "id" | "full_name" | "avatar_url"> | null };
}

export function ProjectCard({ project }: Props) {
  const progress = Math.round(project.progress ?? 0);

  return (
    <Link href={`/projects/${project.id}`}>
      <div className="bg-white rounded-xl border border-border p-5 hover:shadow-md hover:border-primary/30 transition-all cursor-pointer group">
        {/* Top */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3">
            {project.logo_url ? (
              <img src={project.logo_url} alt="" className="w-10 h-10 rounded-lg object-cover" />
            ) : (
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center text-primary font-bold text-lg">
                {project.name[0]}
              </div>
            )}
            <div>
              <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-1">
                {project.name}
              </h3>
              {project.current_stage && (
                <p className="text-xs text-muted-foreground mt-0.5">{project.current_stage}</p>
              )}
            </div>
          </div>
          <span className={cn("text-xs px-2 py-1 rounded-full font-medium flex-shrink-0", statusColors[project.status] ?? "bg-gray-100 text-gray-600")}>
            {getProjectStatusLabel(project.status)}
          </span>
        </div>

        {/* Description */}
        {project.description && (
          <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{project.description}</p>
        )}

        {/* Progress */}
        <div className="mb-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
            <span>الإنجاز</span>
            <span className="font-medium">{progress}%</span>
          </div>
          <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <User size={12} />
            <span>{project.manager?.full_name ?? project.manager_name ?? "—"}</span>
          </div>
          {project.end_date && (
            <div className="flex items-center gap-1.5">
              <CalendarDays size={12} />
              <span>{formatDateShort(project.end_date)}</span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
