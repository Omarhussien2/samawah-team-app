import { formatDateShort, getStatusColor, getAlertLevelColor } from "@/lib/utils";
import Link from "next/link";
import { AlertCircle } from "lucide-react";

interface Task {
  id: string;
  title: string;
  status: string;
  due_date?: string | null;
  alert_level?: string | null;
  priority: string;
}

export function TopTasks({ tasks }: { tasks: Task[] }) {
  return (
    <div className="bg-white rounded-xl border border-border p-5">
      <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
        <AlertCircle size={18} className="text-red-500" />
        أهم المهام اليوم
      </h3>
      {tasks.length === 0 ? (
        <p className="text-center text-muted-foreground text-sm py-6">
          ما فيه مهام عاجلة 🎉
        </p>
      ) : (
        <div className="space-y-2">
          {tasks.map((task) => (
            <Link key={task.id} href={`/tasks/${task.id}`}>
              <div className="p-3 rounded-lg border border-border hover:bg-accent transition-colors cursor-pointer">
                <p className="text-sm font-medium text-foreground line-clamp-1">{task.title}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(task.status)}`}>
                    {task.status}
                  </span>
                  {task.due_date && (
                    <span className="text-xs text-muted-foreground">{formatDateShort(task.due_date)}</span>
                  )}
                  {task.alert_level && (
                    <span className={`text-xs px-1.5 py-0.5 rounded ${getAlertLevelColor(task.alert_level)}`}>
                      {task.alert_level}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
