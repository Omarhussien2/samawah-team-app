import { FolderKanban, PauseCircle, ListTodo, AlertCircle, CalendarClock } from "lucide-react";

interface StatsProps {
  activeProjects: number;
  pausedProjects: number;
  openTasks: number;
  overdueTasks: number;
  todayTasks: number;
}

const statCards = (p: StatsProps) => [
  {
    label: "المشاريع النشطة",
    value: p.activeProjects,
    icon: FolderKanban,
    color: "text-blue-600 bg-blue-50",
    border: "border-blue-100",
  },
  {
    label: "المشاريع المتوقفة",
    value: p.pausedProjects,
    icon: PauseCircle,
    color: "text-amber-600 bg-amber-50",
    border: "border-amber-100",
  },
  {
    label: "المهام المفتوحة",
    value: p.openTasks,
    icon: ListTodo,
    color: "text-indigo-600 bg-indigo-50",
    border: "border-indigo-100",
  },
  {
    label: "المهام المتأخرة",
    value: p.overdueTasks,
    icon: AlertCircle,
    color: "text-red-600 bg-red-50",
    border: "border-red-100",
  },
  {
    label: "مستحقة اليوم",
    value: p.todayTasks,
    icon: CalendarClock,
    color: "text-green-600 bg-green-50",
    border: "border-green-100",
  },
];

export function DashboardStats(props: StatsProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
      {statCards(props).map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.label}
            className={`bg-white rounded-xl p-4 border ${card.border} flex flex-col gap-3`}
          >
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${card.color}`}>
              <Icon size={20} />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{card.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{card.label}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
