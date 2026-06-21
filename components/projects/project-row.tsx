import Link from "next/link";
import { formatDateShort, getProjectStatusLabel, getProjectType, getProjectTypeBadgeClass, getProjectTypeLabel, cn } from "@/lib/utils";
import type { Profile, Project } from "@/lib/supabase/types";

const statusColors: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  paused: "bg-amber-100 text-amber-700",
  completed: "bg-blue-100 text-blue-700",
  cancelled: "bg-gray-100 text-gray-500",
};

interface Props {
  project: Project & { manager?: Pick<Profile, "id" | "full_name" | "avatar_url"> | null };
  href?: string;
}

export function ProjectRow({ project, href = `/projects/${project.id}` }: Props) {
  const progress = Math.round(project.progress ?? 0);
  return (
    <tr className="hover:bg-accent/50 transition-colors">
      <td className="px-4 py-3">
        <Link href={href} className="flex items-center gap-3">
          <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center text-primary font-bold text-sm flex-shrink-0">
            {project.name[0]}
          </div>
          <span className="font-medium text-foreground hover:text-primary transition-colors line-clamp-1">
            {project.name}
          </span>
          <span className={cn("hidden rounded-md border px-2 py-0.5 text-[11px] font-bold sm:inline-flex", getProjectTypeBadgeClass(getProjectType(project)))}>
            {getProjectTypeLabel(getProjectType(project))}
          </span>
        </Link>
      </td>
      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
        {project.manager?.full_name ?? project.manager_name ?? "—"}
      </td>
      <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">
        {project.current_stage ?? "—"}
      </td>
      <td className="px-4 py-3">
        <span className={cn("text-xs px-2 py-1 rounded-full font-medium", statusColors[project.status] ?? "bg-gray-100 text-gray-600")}>
          {getProjectStatusLabel(project.status)}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full" style={{ width: `${progress}%` }} />
          </div>
          <span className="text-xs text-muted-foreground w-8">{progress}%</span>
        </div>
      </td>
      <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">
        {formatDateShort(project.end_date)}
      </td>
    </tr>
  );
}
