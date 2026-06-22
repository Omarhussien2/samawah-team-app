"use client";

import { useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Link2,
  ListChecks,
  ShieldAlert,
  Target,
  TrendingDown,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  OPEN_RISK_WARNING_RATE,
  RISK_REGISTER_TARGET,
  type ProjectRiskIndicatorRow,
  type RiskIndicatorData,
  type RiskRegisterStatus,
  type RiskSeverity,
} from "@/lib/risk-indicators/metrics";

type FilterValue = "all" | "attention" | "missing" | "unlinked";

const filterOptions: Array<{ value: FilterValue; label: string }> = [
  { value: "all", label: "كل المشاريع" },
  { value: "attention", label: "تحتاج متابعة" },
  { value: "missing", label: "بدون سجل" },
  { value: "unlinked", label: "بلا مهام معالجة" },
];

const statusLabels: Record<RiskRegisterStatus, string> = {
  updated: "محدث",
  stale: "متأخر",
  missing: "لا يوجد سجل",
};

const statusClasses: Record<RiskRegisterStatus, string> = {
  updated: "bg-emerald-50 text-emerald-700 border-emerald-100",
  stale: "bg-amber-50 text-amber-700 border-amber-100",
  missing: "bg-rose-50 text-rose-700 border-rose-100",
};

const severityLabels: Record<RiskSeverity, string> = {
  critical: "حرجة",
  high: "مرتفعة",
  medium: "متوسطة",
  low: "منخفضة",
};

const severityBarClasses: Record<RiskSeverity, string> = {
  critical: "bg-rose-600",
  high: "bg-orange-500",
  medium: "bg-amber-400",
  low: "bg-sky-500",
};

const numberFormatter = new Intl.NumberFormat("ar-SA", { maximumFractionDigits: 0 });
const percentFormatter = new Intl.NumberFormat("ar-SA", { maximumFractionDigits: 1 });

export function RiskIndicatorsClient({ data, generatedAt }: { data: RiskIndicatorData; generatedAt: string }) {
  const [filter, setFilter] = useState<FilterValue>("all");
  const visibleProjects = useMemo(() => {
    return data.projects.filter((project) => {
      if (filter === "attention") return isAttentionProject(project);
      if (filter === "missing") return project.registerStatus === "missing";
      if (filter === "unlinked") return project.unlinkedOpenRisks > 0;
      return true;
    });
  }, [data.projects, filter]);

  const totalOpenSeverity = Object.values(data.severityTotals).reduce((total, value) => total + value, 0);
  const registerFormula = `${formatNumber(data.summary.compliantProjects)} ÷ ${formatNumber(data.summary.activeProjects)} × 100`;
  const openRiskFormula = `${formatNumber(data.summary.openRisks)} ÷ ${formatNumber(data.summary.totalRisks)} × 100`;

  return (
    <div className="space-y-6">
      <div className="section-header">
        <div>
          <h1 className="text-2xl font-bold text-foreground">مؤشرات المخاطر</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            قراءة مباشرة من المشاريع والمهام وسجل التحديات والمخاطر في المنصة.
          </p>
        </div>
        <div className="rounded-lg border border-border bg-white px-3 py-2 text-xs font-bold text-slate-500">
          آخر قراءة: {formatDate(generatedAt)}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <IndicatorCard
          icon={ClipboardCheck}
          label="التزام سجل المخاطر"
          value={formatPercent(data.summary.registerCoverageRate)}
          detail={`${formatNumber(data.summary.compliantProjects)} من ${formatNumber(data.summary.activeProjects)} مشاريع نشطة`}
          formula={registerFormula}
          healthy={data.summary.registerCoverageRate >= RISK_REGISTER_TARGET}
        />
        <IndicatorCard
          icon={TrendingDown}
          label="المخاطر المفتوحة المتبقية"
          value={formatPercent(data.summary.openRiskRate)}
          detail={`${formatNumber(data.summary.openRisks)} مفتوحة من ${formatNumber(data.summary.totalRisks)} مخاطر`}
          formula={openRiskFormula}
          healthy={data.summary.openRiskRate < OPEN_RISK_WARNING_RATE}
        />
        <SmallMetric
          icon={AlertTriangle}
          label="مخاطر حرجة/مرتفعة"
          value={formatNumber(data.summary.criticalOpenRisks + data.summary.highOpenRisks)}
          detail="مفتوحة وتحتاج أولوية متابعة"
          tone="danger"
        />
        <SmallMetric
          icon={Link2}
          label="مخاطر بلا مهمة"
          value={formatNumber(data.summary.unlinkedOpenRisks)}
          detail="مخاطر مفتوحة غير مربوطة بإجراء"
          tone="warning"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4 text-primary" />
              توزيع المخاطر المفتوحة
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {(Object.keys(severityLabels) as RiskSeverity[]).map((severity) => {
              const count = data.severityTotals[severity];
              const width = totalOpenSeverity > 0 ? (count / totalOpenSeverity) * 100 : 0;

              return (
                <div key={severity}>
                  <div className="mb-2 flex items-center justify-between text-sm font-bold">
                    <span>{severityLabels[severity]}</span>
                    <span>{formatNumber(count)}</span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                    <div className={cn("h-full rounded-full", severityBarClasses[severity])} style={{ width: `${width}%` }} />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between gap-3 text-base">
              <span className="flex items-center gap-2">
                <ListChecks className="h-4 w-4 text-primary" />
                أولوية مدراء المشاريع
              </span>
              <span className="rounded-md bg-muted px-2 py-1 text-xs font-bold text-muted-foreground">
                {formatNumber(data.actionQueue.length)}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-border">
            {data.actionQueue.length === 0 ? (
              <div className="py-8 text-center text-sm font-semibold text-muted-foreground">
                لا توجد مشاريع تحتاج متابعة عاجلة.
              </div>
            ) : (
              data.actionQueue.map((project) => (
                <div key={project.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="font-black text-slate-900">{project.name}</div>
                      <div className="mt-1 text-xs font-bold text-muted-foreground">
                        {project.managerName ?? "بدون مدير محدد"} · {formatNumber(project.openRisks)} مخاطر مفتوحة
                      </div>
                    </div>
                    <StatusBadge status={project.registerStatus} />
                  </div>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{project.nextAction}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <InfoStrip
          icon={Target}
          label="مشاريع مطلوبة للوصول للمستهدف"
          value={formatNumber(data.summary.projectsNeededForTarget)}
        />
        <InfoStrip
          icon={CheckCircle2}
          label="تحديات مفتوحة مرتبطة بمهام"
          value={`${formatPercent(data.summary.challengeTaskLinkRate)} · ${formatNumber(data.summary.linkedActiveChallenges)} من ${formatNumber(data.summary.activeChallenges)}`}
        />
        <InfoStrip
          icon={ShieldAlert}
          label="المهام المفتوحة في نطاق القياس"
          value={`${formatNumber(data.summary.openTasks)} من ${formatNumber(data.summary.totalTasks)}`}
        />
      </div>

      <Card>
        <CardHeader className="gap-4 border-b border-border pb-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle className="text-base">مشاريع الشركة</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">حالة سجل المخاطر وربطه بالمهام حسب كل مشروع نشط.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {filterOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setFilter(option.value)}
                className={cn(
                  "h-9 rounded-lg px-3 text-xs font-extrabold transition-colors",
                  filter === option.value ? "bg-primary text-white" : "bg-muted text-slate-600 hover:bg-slate-200",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50 text-right text-xs font-black text-muted-foreground">
                  <th className="px-4 py-3">المشروع</th>
                  <th className="px-4 py-3">حالة السجل</th>
                  <th className="px-4 py-3">آخر تحديث</th>
                  <th className="px-4 py-3">مخاطر مفتوحة</th>
                  <th className="px-4 py-3">مخاطر مغلقة</th>
                  <th className="px-4 py-3">حرجة/مرتفعة</th>
                  <th className="px-4 py-3">ربط المهام</th>
                  <th className="px-4 py-3">المهام</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visibleProjects.map((project) => (
                  <tr key={project.id} className="align-top hover:bg-muted/35">
                    <td className="px-4 py-4">
                      <div className="font-black text-slate-900">{project.name}</div>
                      <div className="mt-1 text-xs font-bold text-muted-foreground">
                        {project.managerName ?? "بدون مدير محدد"}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <StatusBadge status={project.registerStatus} />
                    </td>
                    <td className="px-4 py-4 font-bold">{formatDate(project.lastRiskUpdate)}</td>
                    <td className="px-4 py-4 font-black">{formatNumber(project.openRisks)}</td>
                    <td className="px-4 py-4 font-black">{formatNumber(project.closedRisks)}</td>
                    <td className="px-4 py-4 font-black text-rose-700">
                      {formatNumber(project.openBySeverity.critical + project.openBySeverity.high)}
                    </td>
                    <td className="px-4 py-4">
                      <div className="font-black">{formatNumber(project.linkedRiskTasks)}</div>
                      {project.unlinkedOpenRisks > 0 && (
                        <div className="mt-1 text-xs font-bold text-rose-600">
                          {formatNumber(project.unlinkedOpenRisks)} بلا مهمة
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <div className="font-black">{formatNumber(project.openTasks)} مفتوحة</div>
                      <div className="mt-2 w-28">
                        <Progress value={project.totalTasks ? ((project.totalTasks - project.openTasks) / project.totalTasks) * 100 : 0} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function IndicatorCard({
  icon: Icon,
  label,
  value,
  detail,
  formula,
  healthy,
}: {
  icon: typeof ClipboardCheck;
  label: string;
  value: string;
  detail: string;
  formula: string;
  healthy: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-black text-muted-foreground">{label}</p>
            <p className="mt-2 text-3xl font-black text-slate-900">{value}</p>
            <p className="mt-1 text-sm font-bold text-muted-foreground">{detail}</p>
          </div>
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
            <Icon className="h-5 w-5" />
          </span>
        </div>
        <div className="mt-4 flex items-center justify-between gap-3">
          <span className="rounded-lg bg-muted px-3 py-2 text-xs font-black text-slate-700">{formula}</span>
          <span className={cn("rounded-lg px-2.5 py-1 text-xs font-black", healthy ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700")}>
            {healthy ? "ضمن المسار" : "تحتاج متابعة"}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function SmallMetric({
  icon: Icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: typeof AlertTriangle;
  label: string;
  value: string;
  detail: string;
  tone: "danger" | "warning";
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-black text-muted-foreground">{label}</p>
            <p className="mt-2 text-4xl font-black text-slate-900">{value}</p>
          </div>
          <span className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-lg", tone === "danger" ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700")}>
            <Icon className="h-5 w-5" />
          </span>
        </div>
        <p className="mt-4 text-sm font-bold leading-6 text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}

function InfoStrip({ icon: Icon, label, value }: { icon: typeof Target; label: string; value: string }) {
  return (
    <div className="flex min-h-20 items-center gap-3 rounded-lg border border-border bg-white px-4 py-3 shadow-sm">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-muted text-primary">
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <p className="text-xs font-black text-muted-foreground">{label}</p>
        <p className="mt-1 text-lg font-black text-slate-900">{value}</p>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: RiskRegisterStatus }) {
  return (
    <span className={cn("inline-flex rounded-full border px-2.5 py-1 text-xs font-black", statusClasses[status])}>
      {statusLabels[status]}
    </span>
  );
}

function isAttentionProject(project: ProjectRiskIndicatorRow) {
  return (
    project.registerStatus !== "updated" ||
    project.unlinkedOpenRisks > 0 ||
    project.openBySeverity.critical > 0 ||
    project.openBySeverity.high > 0
  );
}

function formatNumber(value: number) {
  return numberFormatter.format(value);
}

function formatPercent(value: number) {
  return `${percentFormatter.format(value)}٪`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "لا يوجد";
  return new Date(value).toLocaleDateString("ar-SA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
