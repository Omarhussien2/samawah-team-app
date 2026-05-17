import { cn } from "@/lib/utils";
import { getTaskDisplayLines } from "@/lib/tasks/display";

interface TaskTitleStackProps {
  title: string;
  subTask?: string | null;
  category?: string | null;
  done?: boolean;
  className?: string;
  primaryClassName?: string;
  secondaryClassName?: string;
}

export function TaskTitleStack({
  title,
  subTask,
  category,
  done = false,
  className,
  primaryClassName,
  secondaryClassName,
}: TaskTitleStackProps) {
  const { primary, secondary } = getTaskDisplayLines({ title, subTask, category });

  return (
    <div className={cn("min-w-0", className)}>
      <p
        className={cn(
          "font-semibold text-foreground line-clamp-2 leading-snug",
          done && "line-through text-muted-foreground",
          primaryClassName
        )}
      >
        {primary}
      </p>
      {secondary && (
        <p className={cn("mt-0.5 text-xs text-muted-foreground line-clamp-1", secondaryClassName)}>
          {secondary}
        </p>
      )}
    </div>
  );
}
