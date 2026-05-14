"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Edit, RefreshCw, Save, Trash2 } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { buildOperationsKpiValues } from "@/lib/kpis/auto-calculations";
import { getRelatedKpiPeriods, type KpiPeriodOption, uniqueKpiPeriods } from "@/lib/kpis/periods";
import { averageMetric, calculateProjectPerformance, selectLatestProjectPerformanceByProject } from "@/lib/kpis/operations";
import { formatKpiValue, getKpiStatusStyle } from "@/lib/kpis/status";
import {
  deleteProjectPerformanceUpdate,
  fetchActiveProjectsForPerformance,
  fetchProjectPerformanceUpdates,
  kpiKeys,
  mergeKpiValuesByKpiId,
  mergeKpiValuesByPeriod,
  saveProjectPerformanceUpdate,
  upsertKpiValues,
  type ProjectPerformanceRecord,
} from "@/lib/queries/kpis";
import type { KpiDefinition, KpiPeriodType, KpiValue, Profile, Project } from "@/lib/supabase/types";

interface Props {
  currentUser: Profile;
  definitions: KpiDefinition[];
  initialProjects: Pick<Project, "id" | "name" | "manager_id" | "total_budget" | "progress">[];
  initialUpdates: ProjectPerformanceRecord[];
  periodType: KpiPeriodType;
  periodStart: string;
  periodEnd: string;
}

const blankDraft = {
  id: "",
  projectId: "",
  plannedProgress: "",
  actualProgress: "",
  actualCost: "",
  notes: "",
};

type Draft = typeof blankDraft;
type KpiSyncResult = {
  period: KpiPeriodOption;
  values: KpiValue[];
};

export function OperationsWorkspace({
  currentUser,
  definitions,
  initialProjects,
  initialUpdates,
  periodType,
  periodStart,
  periodEnd,
}: Props) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(blankDraft);
  const canManage = currentUser.role === "admin" || currentUser.role === "project_manager";
  const updatesQueryKey = kpiKeys.projectPerformance(periodType, periodStart, periodEnd);

  const { data: projects = initialProjects } = useQuery({
    queryKey: [...kpiKeys.all, "performance-projects"],
    queryFn: fetchActiveProjectsForPerformance,
    initialData: initialProjects,
  });

  const { data: updates = initialUpdates, isFetching: isFetchingUpdates } = useQuery({
    queryKey: updatesQueryKey,
    queryFn: () => fetchProjectPerformanceUpdates(periodType, periodStart, periodEnd),
    initialData: initialUpdates,
  });

  const syncOperationalKpis = async (
    nextUpdates: ProjectPerformanceRecord[],
    affectedPeriods: KpiPeriodOption[]
  ): Promise<KpiSyncResult[]> => {
    return Promise.all(affectedPeriods.map(async (period) => {
      const periodUpdates = isSameKpiPeriod(period, periodType, periodStart, periodEnd)
        ? nextUpdates
        : await fetchProjectPerformanceUpdates(period.periodType, period.periodStart, period.periodEnd);
      const values = buildOperationsKpiValues(periodUpdates, definitions, projects.length, {
        periodType: period.periodType,
        periodStart: period.periodStart,
        periodEnd: period.periodEnd,
        userId: currentUser.id,
      });
      return {
        period,
        values: values.length > 0 ? await upsertKpiValues(values) : [],
      };
    }));
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const project = projects.find((item) => item.id === draft.projectId);
      const existingUpdate = draft.id ? updates.find((item) => item.id === draft.id) : null;
      const saved = await saveProjectPerformanceUpdate({
        ...(draft.id ? { id: draft.id } : {}),
        project_id: draft.projectId,
        period_type: existingUpdate?.period_type ?? periodType,
        period_start: existingUpdate?.period_start ?? periodStart,
        period_end: existingUpdate?.period_end ?? periodEnd,
        planned_progress: Number(draft.plannedProgress || 0),
        actual_progress: Number(draft.actualProgress || 0),
        actual_cost: Number(draft.actualCost || 0),
        notes: draft.notes.trim() || null,
        updated_by: currentUser.id,
      });
      const record: ProjectPerformanceRecord = { ...saved, project: project ?? null };
      const nextUpdates = mergePerformanceUpdate(updates, record);
      const syncResults = await syncOperationalKpis(
        nextUpdates,
        getOperationAffectedPeriods(record, periodType, periodStart, periodEnd)
      );
      return { nextUpdates, syncResults };
    },
    onSuccess: ({ nextUpdates, syncResults }) => {
      toast.success("تم حفظ أداء المشروع وتحديث مؤشرات الفترة");
      queryClient.setQueryData(updatesQueryKey, nextUpdates);
      syncResults.forEach(({ period, values }) => {
        queryClient.setQueryData(
          kpiKeys.values(period.periodType, period.periodStart, period.periodEnd),
          (current: KpiValue[] | undefined) => mergeKpiValuesByKpiId(current, values)
        );
        if (period.periodType === "quarterly") {
          queryClient.setQueryData(
            kpiKeys.yearValues(Number(period.periodStart.slice(0, 4))),
            (current: KpiValue[] | undefined) => mergeKpiValuesByPeriod(current, values)
          );
        }
      });
      queryClient.invalidateQueries({ queryKey: updatesQueryKey });
      syncResults.forEach(({ period }) => {
        queryClient.invalidateQueries({ queryKey: kpiKeys.values(period.periodType, period.periodStart, period.periodEnd) });
        queryClient.invalidateQueries({ queryKey: kpiKeys.projectPerformance(period.periodType, period.periodStart, period.periodEnd) });
        if (period.periodType === "quarterly") {
          queryClient.invalidateQueries({ queryKey: kpiKeys.yearValues(Number(period.periodStart.slice(0, 4))) });
        }
      });
      setOpen(false);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "تعذر حفظ أداء المشروع"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (record: ProjectPerformanceRecord) => {
      await deleteProjectPerformanceUpdate(record.id);
      const nextUpdates = updates.filter((item) => item.id !== record.id);
      const syncResults = await syncOperationalKpis(
        nextUpdates,
        getOperationAffectedPeriods(record, periodType, periodStart, periodEnd)
      );
      return { nextUpdates, syncResults };
    },
    onSuccess: ({ nextUpdates, syncResults }) => {
      toast.success("تم حذف تحديث الأداء وتحديث مؤشرات الفترة");
      queryClient.setQueryData(updatesQueryKey, nextUpdates);
      syncResults.forEach(({ period, values }) => {
        queryClient.setQueryData(
          kpiKeys.values(period.periodType, period.periodStart, period.periodEnd),
          (current: KpiValue[] | undefined) => mergeKpiValuesByKpiId(current, values)
        );
        if (period.periodType === "quarterly") {
          queryClient.setQueryData(
            kpiKeys.yearValues(Number(period.periodStart.slice(0, 4))),
            (current: KpiValue[] | undefined) => mergeKpiValuesByPeriod(current, values)
          );
        }
      });
      queryClient.invalidateQueries({ queryKey: updatesQueryKey });
      syncResults.forEach(({ period }) => {
        queryClient.invalidateQueries({ queryKey: kpiKeys.values(period.periodType, period.periodStart, period.periodEnd) });
        queryClient.invalidateQueries({ queryKey: kpiKeys.projectPerformance(period.periodType, period.periodStart, period.periodEnd) });
        if (period.periodType === "quarterly") {
          queryClient.invalidateQueries({ queryKey: kpiKeys.yearValues(Number(period.periodStart.slice(0, 4))) });
        }
      });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "تعذر حذف تحديث الأداء"),
  });

  const latestUpdates = selectLatestProjectPerformanceByProject(updates);
  const metrics = latestUpdates.map((update) => ({ update, metrics: calculateProjectPerformance(update) }));
  const averageCpi = averageMetric(latestUpdates, "cpi");
  const averageSpi = averageMetric(latestUpdates, "spi");
  const warningCount = metrics.filter((item) => item.metrics.warnings.length > 0).length;
  const chartData = metrics.map(({ update, metrics }) => ({
    project: update.project?.name ?? "مشروع",
    cpi: metrics.cpi,
    spi: metrics.spi,
    planned: update.planned_progress,
    actual: update.actual_progress,
  }));

  const editRecord = (record?: ProjectPerformanceRecord) => {
    setDraft(record ? {
      id: record.id,
      projectId: record.project_id,
      plannedProgress: String(record.planned_progress ?? 0),
      actualProgress: String(record.actual_progress ?? 0),
      actualCost: String(record.actual_cost ?? 0),
      notes: record.notes ?? "",
    } : blankDraft);
    setOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Stat label="متوسط CPI" value={averageCpi === null ? "محايد" : averageCpi.toFixed(2)} />
        <Stat label="متوسط SPI" value={averageSpi === null ? "محايد" : averageSpi.toFixed(2)} />
        <Stat label="تقارير الأداء" value={`${latestUpdates.length}/${projects.length}`} />
        <Stat label="تحذيرات" value={warningCount} />
      </div>

      {isFetchingUpdates && (
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
          <RefreshCw size={14} className="animate-spin" />
          يتم تحديث أداء المشاريع للفترة...
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-base font-bold text-slate-900">CPI / SPI للمشاريع</h2>
            {canManage && <Button onClick={() => editRecord()}>إدخال أداء الفترة</Button>}
          </div>
          <div className="h-72" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ right: 16, left: 16 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="project" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, "auto"]} />
                <Tooltip />
                <Bar dataKey="cpi" name="CPI" fill="#0f766e" radius={[6, 6, 0, 0]} />
                <Bar dataKey="spi" name="SPI" fill="#7c3aed" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-base font-bold text-slate-900">المخطط مقابل الفعلي</h2>
          <div className="h-72" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ right: 16, left: 16 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="project" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Line type="monotone" dataKey="planned" name="المخطط" stroke="#64748b" strokeWidth={2} />
                <Line type="monotone" dataKey="actual" name="الفعلي" stroke="#2563eb" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-right text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3">المشروع</th>
              <th className="px-4 py-3">PV</th>
              <th className="px-4 py-3">EV</th>
              <th className="px-4 py-3">CPI</th>
              <th className="px-4 py-3">SPI</th>
              <th className="px-4 py-3">الحالة</th>
              {canManage && <th className="px-4 py-3">إجراءات</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {metrics.map(({ update, metrics }) => (
              <tr key={update.id}>
                <td className="px-4 py-3 font-bold text-slate-900">{update.project?.name ?? "مشروع غير متاح"}</td>
                <td className="px-4 py-3">{formatKpiValue(metrics.pv, "ريال")}</td>
                <td className="px-4 py-3">{formatKpiValue(metrics.ev, "ريال")}</td>
                <td className="px-4 py-3 font-bold">{metrics.cpi === null ? "محايد" : metrics.cpi.toFixed(2)}</td>
                <td className="px-4 py-3 font-bold">{metrics.spi === null ? "محايد" : metrics.spi.toFixed(2)}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${getKpiStatusStyle(metrics.status)}`}>
                    {metrics.warnings.length ? "تحذير" : metrics.status === "green" ? "جيد" : metrics.status === "yellow" ? "متابعة" : metrics.status === "red" ? "متعثر" : "محايد"}
                  </span>
                  {metrics.warnings.length > 0 && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-amber-700">
                      <AlertTriangle size={12} />
                      {metrics.warnings.join("، ")}
                    </p>
                  )}
                </td>
                {canManage && (
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => editRecord(update)} disabled={deleteMutation.isPending}><Edit size={14} /></Button>
                      <Button variant="outline" size="sm" onClick={() => deleteMutation.mutate(update)} disabled={deleteMutation.isPending}><Trash2 size={14} /></Button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{draft.id ? "تعديل أداء المشروع" : "إدخال أداء المشروع للفترة"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 md:grid-cols-2">
            <Select value={draft.projectId} onValueChange={(value) => setDraft({ ...draft, projectId: value })}>
              <SelectTrigger className="md:col-span-2"><SelectValue placeholder="اختر المشروع" /></SelectTrigger>
              <SelectContent>
                {projects.map((project) => <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input type="number" min={0} max={100} value={draft.plannedProgress} onChange={(event) => setDraft({ ...draft, plannedProgress: event.target.value })} placeholder="الإنجاز المخطط %" />
            <Input type="number" min={0} max={100} value={draft.actualProgress} onChange={(event) => setDraft({ ...draft, actualProgress: event.target.value })} placeholder="الإنجاز الفعلي %" />
            <Input type="number" min={0} value={draft.actualCost} onChange={(event) => setDraft({ ...draft, actualCost: event.target.value })} placeholder="التكلفة الفعلية" />
            <Textarea className="md:col-span-2" value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} placeholder="ملاحظات" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
            <Button disabled={!draft.projectId || saveMutation.isPending} onClick={() => saveMutation.mutate()}>
              <Save size={16} />
              {saveMutation.isPending ? "جاري الحفظ..." : "حفظ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-extrabold text-slate-900">{value}</p>
    </div>
  );
}

function getOperationAffectedPeriods(
  record: ProjectPerformanceRecord,
  periodType: KpiPeriodType,
  periodStart: string,
  periodEnd: string
) {
  return uniqueKpiPeriods([
    ...getRelatedKpiPeriods(periodType, periodStart, periodEnd),
    ...getRelatedKpiPeriods(record.period_type, record.period_start, record.period_end),
  ]);
}

function mergePerformanceUpdate(records: ProjectPerformanceRecord[], record: ProjectPerformanceRecord) {
  const exists = records.some((item) => item.id === record.id || isSamePerformancePeriod(item, record));
  if (exists) {
    return records.map((item) => (item.id === record.id || isSamePerformancePeriod(item, record) ? record : item));
  }
  return [record, ...records];
}

function isSamePerformancePeriod(left: ProjectPerformanceRecord, right: ProjectPerformanceRecord) {
  return left.project_id === right.project_id
    && left.period_type === right.period_type
    && left.period_start === right.period_start
    && left.period_end === right.period_end;
}

function isSameKpiPeriod(
  period: KpiPeriodOption,
  periodType: KpiPeriodType,
  periodStart: string,
  periodEnd: string
) {
  return period.periodType === periodType
    && period.periodStart === periodStart
    && period.periodEnd === periodEnd;
}
