"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import {
  BarChart3,
  Edit3,
  Loader2,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { KpiCard } from "@/components/kpis/kpi-card";
import { buildOperationsKpiValues, buildProductKpiValues, buildQuarterlyKpiValueRollups, buildSimpleWorkspaceKpiValues, calculateSimpleWorkspaceActuals } from "@/lib/kpis/auto-calculations";
import { calculateProjectPerformance } from "@/lib/kpis/operations";
import { getQuarterPeriodForDate } from "@/lib/kpis/periods";
import { formatKpiValue, getValueForKpi } from "@/lib/kpis/status";
import { PROJECT_TYPE_OPTIONS, cn, getProjectType, getProjectTypeLabel } from "@/lib/utils";
import {
  deleteIndicatorProduct,
  deleteProjectPerformanceUpdate,
  deleteSimpleWorkspaceRecord,
  fetchActiveProjectsForPerformance,
  fetchKpiValuesInRange,
  fetchProjectPerformanceUpdates,
  fetchSimpleWorkspaceRecords,
  fetchIndicatorProducts,
  kpiKeys,
  mergeKpiValuesByKpiId,
  mergeKpiValuesByPeriod,
  saveIndicatorProduct,
  saveProjectPerformanceUpdate,
  saveSimpleWorkspaceRecord,
  upsertKpiValues,
  type ProjectPerformanceRecord,
  type SimpleWorkspaceKind,
  type SimpleWorkspacePayload,
  type SimpleWorkspaceRecord,
} from "@/lib/queries/kpis";
import type {
  IndicatorProduct,
  KpiDefinition,
  KpiPeriodType,
  KpiValue,
  Project,
  ProjectPerformanceUpdate,
} from "@/lib/supabase/types";

type WorkspaceKind = SimpleWorkspaceKind | "products" | "operations";

interface KpiWorkspaceProps {
  kind: WorkspaceKind;
  title: string;
  definitions: KpiDefinition[];
  values: KpiValue[];
  currentUserId: string;
  periodType: KpiPeriodType;
  periodStart: string;
  periodEnd: string;
  periodLabel: string;
  canManage: boolean;
}

type FieldOption = { value: string; label: string };
type FieldConfig = {
  name: string;
  label: string;
  type?: "text" | "number" | "date" | "textarea" | "select";
  required?: boolean;
  options?: FieldOption[];
};

type DraftRecord = Record<string, string>;

const SIMPLE_WORKSPACE_META: Record<SimpleWorkspaceKind, { primary: string; date: string; fields: FieldConfig[] }> = {
  revenue: {
    primary: "client_name",
    date: "entry_date",
    fields: [
      { name: "entry_date", label: "التاريخ", type: "date", required: true },
      {
        name: "revenue_type",
        label: "نوع الإيراد",
        type: "select",
        required: true,
        options: [
          { value: "government", label: "حكومي" },
          { value: "non_government", label: "غير حكومي" },
          { value: "product", label: "منتج" },
        ],
      },
      { name: "amount", label: "المبلغ", type: "number", required: true },
      {
        name: "status",
        label: "الحالة",
        type: "select",
        options: [
          { value: "expected", label: "متوقع" },
          { value: "confirmed", label: "مؤكد" },
          { value: "collected", label: "محصل" },
        ],
      },
      { name: "client_name", label: "العميل", type: "text" },
      { name: "notes", label: "ملاحظات", type: "textarea" },
    ],
  },
  clients: {
    primary: "client_name",
    date: "submitted_at",
    fields: [
      { name: "client_name", label: "اسم العميل", type: "text", required: true },
      { name: "client_type", label: "نوع العميل", type: "text" },
      {
        name: "record_type",
        label: "نوع السجل",
        type: "select",
        required: true,
        options: [
          { value: "strategic_client", label: "عميل نوعي" },
          { value: "new_client", label: "عميل جديد" },
          { value: "proposal", label: "عرض" },
          { value: "repeat_client", label: "عميل متكرر" },
          { value: "satisfaction", label: "رضا العملاء" },
        ],
      },
      {
        name: "status",
        label: "الحالة",
        type: "select",
        options: [
          { value: "contacted", label: "تم التواصل" },
          { value: "proposal_submitted", label: "تم إرسال العرض" },
          { value: "won", label: "مغلق بنجاح" },
          { value: "lost", label: "خاسر" },
          { value: "repeat", label: "متكرر" },
        ],
      },
      { name: "submitted_at", label: "تاريخ السجل", type: "date" },
      { name: "opportunity_value", label: "قيمة الفرصة", type: "number" },
      { name: "satisfaction_score", label: "رضا العملاء %", type: "number" },
      { name: "notes", label: "ملاحظات", type: "textarea" },
    ],
  },
  audience: {
    primary: "platform",
    date: "metric_date",
    fields: [
      { name: "metric_date", label: "تاريخ القياس", type: "date", required: true },
      { name: "platform", label: "المنصة", type: "text", required: true },
      { name: "subscribers", label: "المشتركون", type: "number" },
      { name: "paid_views_avg", label: "متوسط المشاهدات المدفوعة", type: "number" },
      { name: "organic_views_avg", label: "متوسط المشاهدات العضوية", type: "number" },
      { name: "top_episode_views", label: "أعلى حلقة", type: "number" },
      { name: "influencer_reach", label: "وصول المؤثرين", type: "number" },
      { name: "notes", label: "ملاحظات", type: "textarea" },
    ],
  },
  services: {
    primary: "name",
    date: "delivery_date",
    fields: [
      { name: "name", label: "اسم المخرج", type: "text", required: true },
      {
        name: "output_type",
        label: "نوع المخرج",
        type: "select",
        required: true,
        options: [
          { value: "podcast", label: "بودكاست" },
          { value: "youtube_program", label: "برنامج يوتيوب" },
          { value: "media_report", label: "تقرير إعلامي" },
          { value: "other", label: "أخرى" },
        ],
      },
      { name: "quantity", label: "الكمية", type: "number" },
      {
        name: "status",
        label: "الحالة",
        type: "select",
        options: [
          { value: "planned", label: "مخطط" },
          { value: "in_progress", label: "قيد التنفيذ" },
          { value: "completed", label: "مكتمل" },
          { value: "cancelled", label: "ملغى" },
        ],
      },
      { name: "delivery_date", label: "تاريخ التسليم", type: "date" },
      { name: "notes", label: "ملاحظات", type: "textarea" },
    ],
  },
  partnerships: {
    primary: "entity_name",
    date: "activity_date",
    fields: [
      { name: "entity_name", label: "الجهة", type: "text", required: true },
      {
        name: "activity_type",
        label: "نوع النشاط",
        type: "select",
        required: true,
        options: [
          { value: "award", label: "جائزة" },
          { value: "sponsorship", label: "رعاية" },
          { value: "event", label: "فعالية" },
          { value: "partnership", label: "شراكة" },
          { value: "speaker", label: "تحدث" },
          { value: "product_sponsor", label: "راعي منتج" },
        ],
      },
      {
        name: "status",
        label: "الحالة",
        type: "select",
        options: [
          { value: "planned", label: "مخطط" },
          { value: "contacted", label: "تم التواصل" },
          { value: "confirmed", label: "مؤكد" },
          { value: "completed", label: "مكتمل" },
          { value: "cancelled", label: "ملغى" },
        ],
      },
      { name: "activity_date", label: "تاريخ النشاط", type: "date" },
      { name: "impact_value", label: "قيمة الأثر", type: "number" },
      { name: "notes", label: "ملاحظات", type: "textarea" },
    ],
  },
};

const PRODUCT_FIELDS: FieldConfig[] = [
  { name: "name", label: "اسم المنتج", type: "text", required: true },
  { name: "category", label: "التصنيف", type: "text" },
  { name: "current_value", label: "القيمة الحالية", type: "number" },
  { name: "target_value", label: "المستهدف", type: "number" },
  { name: "unit", label: "الوحدة", type: "text" },
  {
    name: "status",
    label: "الحالة",
    type: "select",
    options: [
      { value: "active", label: "نشط" },
      { value: "paused", label: "متوقف مؤقتا" },
      { value: "archived", label: "مؤرشف" },
    ],
  },
  { name: "description", label: "الوصف", type: "textarea" },
  { name: "notes", label: "ملاحظات", type: "textarea" },
];

export function KpiWorkspace(props: KpiWorkspaceProps) {
  if (props.kind === "products") return <ProductsWorkspace {...props} />;
  if (props.kind === "operations") return <OperationsWorkspace {...props} />;
  return <SimpleWorkspace {...props} kind={props.kind} />;
}

function ProductsWorkspace({
  title,
  definitions,
  values,
  currentUserId,
  periodType,
  periodStart,
  periodEnd,
  periodLabel,
  canManage,
}: KpiWorkspaceProps) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<IndicatorProduct | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const productDefinitions = definitions.filter((definition) => definition.auto_source === "indicator_products");
  const { data: products = [], isFetching } = useQuery({
    queryKey: kpiKeys.products(),
    queryFn: fetchIndicatorProducts,
  });

  const saveMutation = useMutation({
    mutationFn: async (draft: DraftRecord) => {
      const payload = normalizeProductPayload(draft, currentUserId, editing?.id);
      const saved = await saveIndicatorProduct(payload);
      const nextProducts = replaceById(products, saved);
      await syncKpiValues({
        queryClient,
        definitions: productDefinitions,
        values: buildProductKpiValues(nextProducts, productDefinitions, {
          periodType,
          periodStart,
          periodEnd,
          userId: currentUserId,
        }),
        periodType,
        periodStart,
        periodEnd,
        userId: currentUserId,
      });
      return { saved, nextProducts };
    },
    onSuccess: ({ nextProducts }) => {
      queryClient.setQueryData(kpiKeys.products(), nextProducts);
      queryClient.invalidateQueries({ queryKey: kpiKeys.products() });
      toast.success("تم حفظ المنتج وتحديث مؤشراته");
      setFormOpen(false);
      setEditing(null);
    },
    onError: showMutationError("تعذر حفظ المنتج"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (product: IndicatorProduct) => {
      await deleteIndicatorProduct(product.id);
      const nextProducts = products.filter((item) => item.id !== product.id);
      await syncKpiValues({
        queryClient,
        definitions: productDefinitions,
        values: buildProductKpiValues(nextProducts, productDefinitions, {
          periodType,
          periodStart,
          periodEnd,
          userId: currentUserId,
        }),
        periodType,
        periodStart,
        periodEnd,
        userId: currentUserId,
      });
      return nextProducts;
    },
    onSuccess: (nextProducts) => {
      queryClient.setQueryData(kpiKeys.products(), nextProducts);
      queryClient.invalidateQueries({ queryKey: kpiKeys.products() });
      toast.success("تم حذف المنتج وتحديث المؤشرات");
    },
    onError: showMutationError("تعذر حذف المنتج"),
  });

  const stats = [
    { label: "المنتجات", value: products.length },
    { label: "النشطة", value: products.filter((product) => product.status === "active").length },
    { label: "القيمة الحالية", value: formatKpiValue(sum(products, "current_value"), null) },
  ];

  return (
    <WorkspaceShell
      title={title}
      periodLabel={periodLabel}
      isFetching={isFetching || saveMutation.isPending || deleteMutation.isPending}
      canManage={canManage}
      onAdd={() => {
        setEditing(null);
        setFormOpen(true);
      }}
      stats={stats}
      chartData={products.map((product) => ({ name: product.name, value: product.current_value ?? 0 })).slice(0, 8)}
      definitions={definitions}
      values={values}
      periodType={periodType}
    >
      <RecordsTable
        headers={["المنتج", "المؤشر", "القيمة", "الحالة", "آخر تحديث"]}
        rows={products}
        renderRow={(product) => [
          <RecordTitle key="name" title={product.name} subtitle={product.category ?? product.description} />,
          productDefinitions.find((definition) => definition.id === product.kpi_id)?.name ?? "غير مرتبط",
          formatKpiValue(product.current_value, product.unit),
          getProductStatusLabel(product.status),
          formatDate(product.updated_at),
        ]}
        canManage={canManage}
        onEdit={(product) => {
          setEditing(product);
          setFormOpen(true);
        }}
        onDelete={(product) => confirmDelete("حذف هذا المنتج؟") && deleteMutation.mutate(product)}
      />

      <RecordFormDialog
        open={formOpen}
        title={editing ? "تعديل منتج" : "إضافة منتج"}
        description={periodLabel}
        fields={[
          ...PRODUCT_FIELDS,
          {
            name: "kpi_id",
            label: "المؤشر المرتبط",
            type: "select",
            options: productDefinitions.map((definition) => ({ value: definition.id, label: definition.name })),
          },
        ]}
        initialDraft={productToDraft(editing, productDefinitions[0]?.id)}
        isSaving={saveMutation.isPending}
        onOpenChange={setFormOpen}
        onSubmit={(draft) => saveMutation.mutate(draft)}
      />
    </WorkspaceShell>
  );
}

function OperationsWorkspace({
  title,
  definitions,
  values,
  currentUserId,
  periodType,
  periodStart,
  periodEnd,
  periodLabel,
  canManage,
}: KpiWorkspaceProps) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<ProjectPerformanceRecord | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [projectTypeFilter, setProjectTypeFilter] = useState<Project["project_type"] | "all">("all");
  const performanceKey = kpiKeys.projectPerformance(periodType, periodStart, periodEnd);
  const { data: projects = [] } = useQuery({
    queryKey: [...kpiKeys.all, "active-projects"],
    queryFn: fetchActiveProjectsForPerformance,
  });
  const { data: records = [], isFetching } = useQuery({
    queryKey: performanceKey,
    queryFn: () => fetchProjectPerformanceUpdates(periodType, periodStart, periodEnd),
  });

  const saveMutation = useMutation({
    mutationFn: async (draft: DraftRecord) => {
      const payload = normalizePerformancePayload(draft, currentUserId, periodType, periodStart, periodEnd, editing?.id);
      const saved = await saveProjectPerformanceUpdate(payload);
      const savedWithProject = attachProject(saved, projects);
      const nextRecords = replaceById(records, savedWithProject);
      await syncKpiValues({
        queryClient,
        definitions,
        values: buildOperationsKpiValues(nextRecords, definitions, projects.length, {
          periodType,
          periodStart,
          periodEnd,
          userId: currentUserId,
        }),
        periodType,
        periodStart,
        periodEnd,
        userId: currentUserId,
      });
      return { savedWithProject, nextRecords };
    },
    onSuccess: ({ nextRecords }) => {
      queryClient.setQueryData(performanceKey, nextRecords);
      queryClient.invalidateQueries({ queryKey: performanceKey });
      toast.success("تم حفظ أداء المشروع وتحديث CPI/SPI");
      setFormOpen(false);
      setEditing(null);
    },
    onError: showMutationError("تعذر حفظ أداء المشروع"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (record: ProjectPerformanceRecord) => {
      await deleteProjectPerformanceUpdate(record.id);
      const nextRecords = records.filter((item) => item.id !== record.id);
      await syncKpiValues({
        queryClient,
        definitions,
        values: buildOperationsKpiValues(nextRecords, definitions, projects.length, {
          periodType,
          periodStart,
          periodEnd,
          userId: currentUserId,
        }),
        periodType,
        periodStart,
        periodEnd,
        userId: currentUserId,
      });
      return nextRecords;
    },
    onSuccess: (nextRecords) => {
      queryClient.setQueryData(performanceKey, nextRecords);
      queryClient.invalidateQueries({ queryKey: performanceKey });
      toast.success("تم حذف تحديث الأداء وتحديث المؤشرات");
    },
    onError: showMutationError("تعذر حذف تحديث الأداء"),
  });

  const filteredProjects = projects.filter(
    (project) => projectTypeFilter === "all" || getProjectType(project) === projectTypeFilter
  );
  const filteredProjectIds = new Set(filteredProjects.map((project) => project.id));
  const visibleRecords = records.filter(
    (record) =>
      projectTypeFilter === "all" ||
      getProjectType(record.project) === projectTypeFilter ||
      filteredProjectIds.has(record.project_id)
  );
  const calculatedRows = visibleRecords.map((record) => ({ record, metrics: calculateProjectPerformance(record) }));
  const cpiAverage = average(calculatedRows.map(({ metrics }) => metrics.cpi));
  const spiAverage = average(calculatedRows.map(({ metrics }) => metrics.spi));
  const stats = [
    { label: "تحديثات الأداء", value: visibleRecords.length },
    { label: "متوسط CPI", value: cpiAverage === null ? "غير متاح" : cpiAverage.toFixed(2) },
    { label: "متوسط SPI", value: spiAverage === null ? "غير متاح" : spiAverage.toFixed(2) },
  ];

  return (
    <WorkspaceShell
      title={title}
      periodLabel={periodLabel}
      isFetching={isFetching || saveMutation.isPending || deleteMutation.isPending}
      canManage={canManage}
      onAdd={() => {
        setEditing(null);
        setFormOpen(true);
      }}
      stats={stats}
      chartData={calculatedRows.map(({ record, metrics }) => ({ name: record.project?.name ?? "مشروع", value: metrics.cpi ?? 0 })).slice(0, 8)}
      definitions={definitions}
      values={values}
      periodType={periodType}
    >
      <RecordsTable
        toolbar={
          <div className="mb-4 flex justify-end">
            <Select
              value={projectTypeFilter}
              onValueChange={(value) => setProjectTypeFilter(value as Project["project_type"] | "all")}
            >
              <SelectTrigger className="w-full sm:w-56">
                <SelectValue placeholder="نوع المشروع" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل أنواع المشاريع</SelectItem>
                {PROJECT_TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
        headers={["المشروع", "المخطط/الفعلي", "التكلفة", "CPI", "SPI", "الحالة"]}
        rows={calculatedRows}
        renderRow={({ record, metrics }) => [
          <RecordTitle key="project" title={record.project?.name ?? "مشروع بدون اسم"} subtitle={`${getProjectTypeLabel(getProjectType(record.project))} · ${record.period_type === "monthly" ? "شهري" : "ربع سنوي"} · ${record.period_start}`} />,
          `${record.planned_progress}% / ${record.actual_progress}%`,
          formatKpiValue(record.actual_cost, "ريال"),
          metrics.cpi === null ? "غير متاح" : metrics.cpi.toFixed(2),
          metrics.spi === null ? "غير متاح" : metrics.spi.toFixed(2),
          getPerformanceStatusLabel(metrics.status),
        ]}
        canManage={canManage}
        onEdit={({ record }) => {
          setEditing(record);
          setFormOpen(true);
        }}
        onDelete={({ record }) => confirmDelete("حذف تحديث أداء المشروع؟") && deleteMutation.mutate(record)}
      />

      <RecordFormDialog
        open={formOpen}
        title={editing ? "تعديل أداء مشروع" : "إضافة أداء مشروع"}
        description={periodLabel}
        fields={[
          {
            name: "project_id",
            label: "المشروع",
            type: "select",
            required: true,
            options: filteredProjects.map((project) => ({ value: project.id, label: `${project.name} - ${getProjectTypeLabel(getProjectType(project))}` })),
          },
          { name: "planned_progress", label: "الإنجاز المخطط %", type: "number" },
          { name: "actual_progress", label: "الإنجاز الفعلي %", type: "number" },
          { name: "actual_cost", label: "التكلفة الفعلية", type: "number" },
          { name: "notes", label: "ملاحظات", type: "textarea" },
        ]}
        initialDraft={performanceToDraft(editing, filteredProjects[0]?.id)}
        isSaving={saveMutation.isPending}
        onOpenChange={setFormOpen}
        onSubmit={(draft) => saveMutation.mutate(draft)}
      />
    </WorkspaceShell>
  );
}

function SimpleWorkspace({
  kind,
  title,
  definitions,
  values,
  currentUserId,
  periodType,
  periodStart,
  periodEnd,
  periodLabel,
  canManage,
}: KpiWorkspaceProps & { kind: SimpleWorkspaceKind }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<SimpleWorkspaceRecord | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const meta = SIMPLE_WORKSPACE_META[kind];
  const recordsKey = kpiKeys.simpleWorkspace(kind, periodType, periodStart, periodEnd);
  const { data: records = [], isFetching } = useQuery({
    queryKey: recordsKey,
    queryFn: () => fetchSimpleWorkspaceRecords(kind, periodStart, periodEnd),
  });

  const saveMutation = useMutation({
    mutationFn: async (draft: DraftRecord) => {
      const payload = normalizeSimplePayload(kind, draft, currentUserId, editing?.id);
      const saved = await saveSimpleWorkspaceRecord(kind, payload);
      const nextRecords = replaceById(records, saved);
      await syncKpiValues({
        queryClient,
        definitions,
        values: buildSimpleWorkspaceKpiValues(kind, nextRecords, definitions, {
          periodType,
          periodStart,
          periodEnd,
          userId: currentUserId,
        }),
        periodType,
        periodStart,
        periodEnd,
        userId: currentUserId,
      });
      return nextRecords;
    },
    onSuccess: (nextRecords) => {
      queryClient.setQueryData(recordsKey, nextRecords);
      queryClient.invalidateQueries({ queryKey: recordsKey });
      toast.success("تم حفظ السجل وتحديث المؤشرات");
      setFormOpen(false);
      setEditing(null);
    },
    onError: showMutationError("تعذر حفظ السجل"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (record: SimpleWorkspaceRecord) => {
      await deleteSimpleWorkspaceRecord(kind, record.id);
      const nextRecords = records.filter((item) => item.id !== record.id);
      await syncKpiValues({
        queryClient,
        definitions,
        values: buildSimpleWorkspaceKpiValues(kind, nextRecords, definitions, {
          periodType,
          periodStart,
          periodEnd,
          userId: currentUserId,
        }),
        periodType,
        periodStart,
        periodEnd,
        userId: currentUserId,
      });
      return nextRecords;
    },
    onSuccess: (nextRecords) => {
      queryClient.setQueryData(recordsKey, nextRecords);
      queryClient.invalidateQueries({ queryKey: recordsKey });
      toast.success("تم حذف السجل وتحديث المؤشرات");
    },
    onError: showMutationError("تعذر حذف السجل"),
  });

  const actuals = calculateSimpleWorkspaceActuals(kind, records);
  const stats = [
    { label: "السجلات", value: records.length },
    ...definitions.slice(0, 2).map((definition) => ({
      label: definition.measurement_label ?? definition.name,
      value: formatKpiValue(actuals[definition.code] ?? getValueForKpi(values, definition.id)?.actual_value ?? null, definition.target_unit),
    })),
  ];
  const chartData = definitions
    .map((definition) => ({
      name: shortLabel(definition.name),
      value: Number(actuals[definition.code] ?? getValueForKpi(values, definition.id)?.actual_value ?? 0),
    }))
    .slice(0, 8);

  return (
    <WorkspaceShell
      title={title}
      periodLabel={periodLabel}
      isFetching={isFetching || saveMutation.isPending || deleteMutation.isPending}
      canManage={canManage}
      onAdd={() => {
        setEditing(null);
        setFormOpen(true);
      }}
      stats={stats}
      chartData={chartData}
      definitions={definitions}
      values={values}
      periodType={periodType}
    >
      <RecordsTable
        headers={["السجل", "التاريخ", "القيمة", "الحالة"]}
        rows={records}
        renderRow={(record) => [
          <RecordTitle key="title" title={getRecordPrimary(record, meta.primary)} subtitle={getRecordSecondary(kind, record)} />,
          getRecordDate(record, meta.date),
          getRecordValue(kind, record),
          getRecordStatus(record),
        ]}
        canManage={canManage}
        onEdit={(record) => {
          setEditing(record);
          setFormOpen(true);
        }}
        onDelete={(record) => confirmDelete("حذف هذا السجل؟") && deleteMutation.mutate(record)}
      />

      <RecordFormDialog
        open={formOpen}
        title={editing ? "تعديل سجل" : "إضافة سجل"}
        description={periodLabel}
        fields={meta.fields}
        initialDraft={simpleRecordToDraft(kind, editing, periodStart)}
        isSaving={saveMutation.isPending}
        onOpenChange={setFormOpen}
        onSubmit={(draft) => saveMutation.mutate(draft)}
      />
    </WorkspaceShell>
  );
}

function WorkspaceShell({
  title,
  periodLabel,
  isFetching,
  canManage,
  onAdd,
  stats,
  chartData,
  definitions,
  values,
  periodType,
  children,
}: {
  title: string;
  periodLabel: string;
  isFetching: boolean;
  canManage: boolean;
  onAdd: () => void;
  stats: { label: string; value: string | number }[];
  chartData: { name: string; value: number }[];
  definitions: KpiDefinition[];
  values: KpiValue[];
  periodType: KpiPeriodType;
  children: ReactNode;
}) {
  return (
    <section className="space-y-5">
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-teal-700">
              <span className="rounded-full bg-teal-50 px-2.5 py-1">{title}</span>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">{periodLabel}</span>
              {isFetching && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-amber-700">
                  <Loader2 size={12} className="animate-spin" />
                  تحديث
                </span>
              )}
            </div>
            <h3 className="mt-3 text-xl font-black text-slate-950">مساحة {title}</h3>
          </div>
          {canManage && (
            <Button onClick={onAdd}>
              <Plus size={16} />
              إضافة سجل
            </Button>
          )}
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-lg border border-slate-100 bg-slate-50 p-4">
              <p className="text-xs font-bold text-slate-500">{stat.label}</p>
              <p className="mt-1 text-xl font-black text-slate-950">{stat.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2 text-sm font-extrabold text-slate-900">
              <BarChart3 size={17} className="text-teal-600" />
              مؤشرات الفترة
            </div>
            <div className="h-64" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#0f766e" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          {children}
        </div>

        <aside className="space-y-3">
          {definitions.map((definition) => (
            <KpiCard
              key={definition.id}
              definition={definition}
              value={getValueForKpi(values, definition.id)}
              periodType={periodType}
            />
          ))}
        </aside>
      </div>
    </section>
  );
}

function RecordsTable<T>({
  toolbar,
  headers,
  rows,
  renderRow,
  canManage,
  onEdit,
  onDelete,
}: {
  toolbar?: ReactNode;
  headers: string[];
  rows: T[];
  renderRow: (row: T) => React.ReactNode[];
  canManage: boolean;
  onEdit: (row: T) => void;
  onDelete: (row: T) => void;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      {toolbar && <div className="border-b border-slate-100 p-4">{toolbar}</div>}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-right text-sm">
          <thead className="bg-slate-50 text-xs font-bold text-slate-500">
            <tr>
              {headers.map((header) => (
                <th key={header} className="px-4 py-3">{header}</th>
              ))}
              {canManage && <th className="px-4 py-3">إجراءات</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={headers.length + (canManage ? 1 : 0)} className="px-4 py-10 text-center text-sm font-semibold text-slate-500">
                  لا توجد سجلات لهذه الفترة.
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr key={getRowKey(row, index)} className="hover:bg-slate-50/80">
                  {renderRow(row).map((cell, cellIndex) => (
                    <td key={cellIndex} className="px-4 py-3 align-top text-slate-700">{cell}</td>
                  ))}
                  {canManage && (
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline" onClick={() => onEdit(row)} aria-label="تعديل">
                          <Edit3 size={14} />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => onDelete(row)} aria-label="حذف" className="text-rose-600 hover:text-rose-700">
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RecordFormDialog({
  open,
  title,
  description,
  fields,
  initialDraft,
  isSaving,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  title: string;
  description: string;
  fields: FieldConfig[];
  initialDraft: DraftRecord;
  isSaving: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (draft: DraftRecord) => void;
}) {
  const [draft, setDraft] = useState<DraftRecord>(initialDraft);

  useEffect(() => {
    if (open) setDraft(initialDraft);
  }, [initialDraft, open]);

  const updateDraft = (name: string, value: string) => {
    setDraft((current) => ({ ...current, [name]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-hidden p-0">
        <DialogHeader className="border-b border-slate-100 px-6 py-5">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="grid max-h-[62vh] gap-4 overflow-y-auto px-6 py-5 md:grid-cols-2">
          {fields.map((field) => (
            <FormField
              key={field.name}
              field={field}
              value={draft[field.name] ?? ""}
              onChange={(value) => updateDraft(field.name, value)}
            />
          ))}
        </div>
        <DialogFooter className="border-t border-slate-100 px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button onClick={() => onSubmit(draft)} disabled={isSaving || !hasRequiredFields(fields, draft)}>
            <Save size={16} />
            {isSaving ? "جاري الحفظ..." : "حفظ"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FormField({ field, value, onChange }: { field: FieldConfig; value: string; onChange: (value: string) => void }) {
  const className = field.type === "textarea" ? "md:col-span-2" : "";
  return (
    <label className={cn("grid gap-2 text-sm font-bold text-slate-700", className)}>
      {field.label}
      {field.type === "select" ? (
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger className="bg-white">
            <SelectValue placeholder={field.label} />
          </SelectTrigger>
          <SelectContent>
            {(field.options ?? []).map((option) => (
              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : field.type === "textarea" ? (
        <Textarea value={value} onChange={(event) => onChange(event.target.value)} />
      ) : (
        <Input
          type={field.type ?? "text"}
          inputMode={field.type === "number" ? "decimal" : undefined}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </label>
  );
}

function RecordTitle({ title, subtitle }: { title: string; subtitle?: string | null }) {
  return (
    <div>
      <p className="font-extrabold text-slate-900">{title}</p>
      {subtitle && <p className="mt-1 text-xs font-semibold text-slate-500">{subtitle}</p>}
    </div>
  );
}

async function syncKpiValues({
  queryClient,
  definitions,
  values,
  periodType,
  periodStart,
  periodEnd,
  userId,
}: {
  queryClient: QueryClient;
  definitions: KpiDefinition[];
  values: Parameters<typeof upsertKpiValues>[0];
  periodType: KpiPeriodType;
  periodStart: string;
  periodEnd: string;
  userId: string;
}) {
  if (values.length === 0) return;
  const updatedValues = await upsertKpiValues(values);
  applyKpiValueCache(queryClient, periodType, periodStart, periodEnd, updatedValues);

  if (periodType === "monthly") {
    const rollupPeriod = getQuarterPeriodForDate(periodStart);
    const changedDefinitions = definitions.filter((definition) => values.some((value) => value.kpi_id === definition.id));
    const monthlyValues = await fetchKpiValuesInRange("monthly", rollupPeriod.periodStart, rollupPeriod.periodEnd);
    const rollupPayload = buildQuarterlyKpiValueRollups(
      mergeKpiValuesByPeriod(monthlyValues, updatedValues),
      changedDefinitions,
      {
        periodStart: rollupPeriod.periodStart,
        periodEnd: rollupPeriod.periodEnd,
        userId,
      }
    );
    if (rollupPayload.length > 0) {
      const rollupValues = await upsertKpiValues(rollupPayload);
      applyKpiValueCache(queryClient, "quarterly", rollupPeriod.periodStart, rollupPeriod.periodEnd, rollupValues);
      queryClient.invalidateQueries({ queryKey: kpiKeys.values("quarterly", rollupPeriod.periodStart, rollupPeriod.periodEnd) });
    }
  }

  queryClient.invalidateQueries({ queryKey: kpiKeys.values(periodType, periodStart, periodEnd) });
  queryClient.invalidateQueries({ queryKey: kpiKeys.yearValues(Number(periodStart.slice(0, 4))) });
}

function applyKpiValueCache(
  queryClient: QueryClient,
  periodType: KpiPeriodType,
  periodStart: string,
  periodEnd: string,
  values: KpiValue[]
) {
  queryClient.setQueryData(
    kpiKeys.values(periodType, periodStart, periodEnd),
    (current: KpiValue[] | undefined) => mergeKpiValuesByKpiId(current, values)
  );
  if (periodType === "quarterly") {
    queryClient.setQueryData(
      kpiKeys.yearValues(Number(periodStart.slice(0, 4))),
      (current: KpiValue[] | undefined) => mergeKpiValuesByPeriod(current, values)
    );
  }
}

function normalizeProductPayload(draft: DraftRecord, currentUserId: string, id?: string) {
  return {
    ...(id ? { id } : {}),
    name: draft.name.trim(),
    category: emptyToNull(draft.category),
    description: emptyToNull(draft.description),
    kpi_id: emptyToNull(draft.kpi_id),
    current_value: toNumber(draft.current_value) ?? 0,
    target_value: toNumber(draft.target_value),
    unit: emptyToNull(draft.unit),
    status: (draft.status || "active") as IndicatorProduct["status"],
    notes: emptyToNull(draft.notes),
    created_by: currentUserId,
  };
}

function normalizePerformancePayload(
  draft: DraftRecord,
  currentUserId: string,
  periodType: KpiPeriodType,
  periodStart: string,
  periodEnd: string,
  id?: string
) {
  return {
    ...(id ? { id } : {}),
    project_id: draft.project_id,
    period_type: periodType,
    period_start: periodStart,
    period_end: periodEnd,
    planned_progress: clampPercent(toNumber(draft.planned_progress) ?? 0),
    actual_progress: clampPercent(toNumber(draft.actual_progress) ?? 0),
    actual_cost: Math.max(toNumber(draft.actual_cost) ?? 0, 0),
    notes: emptyToNull(draft.notes),
    updated_by: currentUserId,
  };
}

function normalizeSimplePayload(kind: SimpleWorkspaceKind, draft: DraftRecord, currentUserId: string, id?: string): SimpleWorkspacePayload {
  const withId = id ? { id } : {};
  if (kind === "revenue") {
    return {
      ...withId,
      entry_date: draft.entry_date,
      revenue_type: draft.revenue_type,
      amount: toNumber(draft.amount) ?? 0,
      status: draft.status || "confirmed",
      client_name: emptyToNull(draft.client_name),
      notes: emptyToNull(draft.notes),
      created_by: currentUserId,
    } as SimpleWorkspacePayload;
  }
  if (kind === "clients") {
    return {
      ...withId,
      client_name: draft.client_name,
      client_type: emptyToNull(draft.client_type),
      record_type: draft.record_type,
      status: draft.status || "contacted",
      submitted_at: emptyToNull(draft.submitted_at),
      opportunity_value: toNumber(draft.opportunity_value),
      satisfaction_score: toNumber(draft.satisfaction_score),
      notes: emptyToNull(draft.notes),
      created_by: currentUserId,
    } as SimpleWorkspacePayload;
  }
  if (kind === "audience") {
    return {
      ...withId,
      metric_date: draft.metric_date,
      platform: draft.platform,
      subscribers: toNumber(draft.subscribers) ?? 0,
      paid_views_avg: toNumber(draft.paid_views_avg) ?? 0,
      organic_views_avg: toNumber(draft.organic_views_avg) ?? 0,
      top_episode_views: toNumber(draft.top_episode_views) ?? 0,
      influencer_reach: toNumber(draft.influencer_reach) ?? 0,
      notes: emptyToNull(draft.notes),
      created_by: currentUserId,
    } as SimpleWorkspacePayload;
  }
  if (kind === "services") {
    return {
      ...withId,
      name: draft.name,
      output_type: draft.output_type,
      quantity: toNumber(draft.quantity) ?? 1,
      status: draft.status || "planned",
      delivery_date: emptyToNull(draft.delivery_date),
      notes: emptyToNull(draft.notes),
      created_by: currentUserId,
    } as SimpleWorkspacePayload;
  }
  return {
    ...withId,
    entity_name: draft.entity_name,
    activity_type: draft.activity_type,
    status: draft.status || "planned",
    activity_date: emptyToNull(draft.activity_date),
    impact_value: toNumber(draft.impact_value),
    notes: emptyToNull(draft.notes),
    created_by: currentUserId,
  } as SimpleWorkspacePayload;
}

function productToDraft(product: IndicatorProduct | null, fallbackKpiId?: string): DraftRecord {
  return {
    name: product?.name ?? "",
    category: product?.category ?? "",
    description: product?.description ?? "",
    kpi_id: product?.kpi_id ?? fallbackKpiId ?? "",
    current_value: stringifyNumber(product?.current_value),
    target_value: stringifyNumber(product?.target_value),
    unit: product?.unit ?? "",
    status: product?.status ?? "active",
    notes: product?.notes ?? "",
  };
}

function performanceToDraft(record: ProjectPerformanceRecord | null, fallbackProjectId?: string): DraftRecord {
  return {
    project_id: record?.project_id ?? fallbackProjectId ?? "",
    planned_progress: stringifyNumber(record?.planned_progress),
    actual_progress: stringifyNumber(record?.actual_progress),
    actual_cost: stringifyNumber(record?.actual_cost),
    notes: record?.notes ?? "",
  };
}

function simpleRecordToDraft(kind: SimpleWorkspaceKind, record: SimpleWorkspaceRecord | null, periodStart: string): DraftRecord {
  const source = record ? (record as unknown as Record<string, unknown>) : {};
  const draft: DraftRecord = {};
  SIMPLE_WORKSPACE_META[kind].fields.forEach((field) => {
    const value = source[field.name];
    draft[field.name] = value === null || value === undefined ? defaultFieldValue(field, periodStart) : String(value);
  });
  return draft;
}

function defaultFieldValue(field: FieldConfig, periodStart: string) {
  if (field.type === "date") return periodStart;
  if (field.type === "select") return field.options?.[0]?.value ?? "";
  if (field.type === "number") return "";
  return "";
}

function attachProject(
  saved: ProjectPerformanceUpdate,
  projects: (Pick<Project, "id" | "name" | "manager_id" | "total_budget" | "progress"> & Partial<Pick<Project, "project_type">>)[]
): ProjectPerformanceRecord {
  return {
    ...saved,
    project: projects.find((project) => project.id === saved.project_id) ?? null,
  };
}

function replaceById<T extends { id: string }>(rows: T[], row: T) {
  return rows.some((item) => item.id === row.id)
    ? rows.map((item) => (item.id === row.id ? row : item))
    : [row, ...rows];
}

function sum<T>(rows: T[], key: keyof T) {
  return rows.reduce((total, row) => total + Number(row[key] ?? 0), 0);
}

function average(values: (number | null)[]) {
  const usable = values.filter((value): value is number => value !== null && Number.isFinite(value));
  return usable.length ? usable.reduce((total, value) => total + value, 0) / usable.length : null;
}

function getProductStatusLabel(status: IndicatorProduct["status"]) {
  if (status === "active") return "نشط";
  if (status === "paused") return "متوقف مؤقتا";
  return "مؤرشف";
}

function getPerformanceStatusLabel(status: ReturnType<typeof calculateProjectPerformance>["status"]) {
  if (status === "green") return "مستقر";
  if (status === "yellow") return "يحتاج متابعة";
  if (status === "red") return "متعثر";
  return "محايد";
}

function getRecordPrimary(record: SimpleWorkspaceRecord, key: string) {
  const value = (record as unknown as Record<string, unknown>)[key];
  return value ? String(value) : "سجل";
}

function getRecordSecondary(kind: SimpleWorkspaceKind, record: SimpleWorkspaceRecord) {
  const source = record as unknown as Record<string, unknown>;
  if (kind === "revenue") return getRevenueTypeLabel(String(source.revenue_type ?? ""));
  if (kind === "clients") return getClientRecordTypeLabel(String(source.record_type ?? ""));
  if (kind === "audience") return "قياس جمهور";
  if (kind === "services") return getServiceOutputLabel(String(source.output_type ?? ""));
  return getPartnershipActivityLabel(String(source.activity_type ?? ""));
}

function getRecordDate(record: SimpleWorkspaceRecord, key: string) {
  const value = (record as unknown as Record<string, unknown>)[key];
  return typeof value === "string" && value ? value : "غير محدد";
}

function getRecordValue(kind: SimpleWorkspaceKind, record: SimpleWorkspaceRecord) {
  const source = record as unknown as Record<string, unknown>;
  if (kind === "revenue") return formatKpiValue(Number(source.amount ?? 0), "ريال");
  if (kind === "clients") return source.satisfaction_score ? `${source.satisfaction_score}%` : formatKpiValue(Number(source.opportunity_value ?? 0), "ريال");
  if (kind === "audience") return formatKpiValue(Number(source.subscribers ?? 0), "مشترك");
  if (kind === "services") return formatKpiValue(Number(source.quantity ?? 0), "مخرج");
  return source.impact_value ? formatKpiValue(Number(source.impact_value), null) : "غير محدد";
}

function getRecordStatus(record: SimpleWorkspaceRecord) {
  const source = record as unknown as Record<string, unknown>;
  return String(source.status ?? "غير محدد");
}

function getRevenueTypeLabel(value: string) {
  if (value === "government") return "حكومي";
  if (value === "non_government") return "غير حكومي";
  if (value === "product") return "منتج";
  return value;
}

function getClientRecordTypeLabel(value: string) {
  if (value === "strategic_client") return "عميل نوعي";
  if (value === "new_client") return "عميل جديد";
  if (value === "proposal") return "عرض";
  if (value === "repeat_client") return "عميل متكرر";
  if (value === "satisfaction") return "رضا العملاء";
  return value;
}

function getServiceOutputLabel(value: string) {
  if (value === "podcast") return "بودكاست";
  if (value === "youtube_program") return "برنامج يوتيوب";
  if (value === "media_report") return "تقرير إعلامي";
  return "أخرى";
}

function getPartnershipActivityLabel(value: string) {
  if (value === "award") return "جائزة";
  if (value === "sponsorship") return "رعاية";
  if (value === "event") return "فعالية";
  if (value === "partnership") return "شراكة";
  if (value === "speaker") return "تحدث";
  if (value === "product_sponsor") return "راعي منتج";
  return value;
}

function getRowKey(row: unknown, index: number) {
  if (typeof row === "object" && row && "id" in row) return String((row as { id: string }).id);
  if (typeof row === "object" && row && "record" in row) {
    const nested = (row as { record?: { id?: string } }).record;
    if (nested?.id) return nested.id;
  }
  return String(index);
}

function hasRequiredFields(fields: FieldConfig[], draft: DraftRecord) {
  return fields.every((field) => !field.required || Boolean(draft[field.name]?.trim()));
}

function showMutationError(fallback: string) {
  return (error: unknown) => toast.error(error instanceof Error ? error.message : fallback);
}

function confirmDelete(message: string) {
  return window.confirm(message);
}

function emptyToNull(value: string | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed ? trimmed : null;
}

function toNumber(value: string | undefined) {
  if (!value?.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function stringifyNumber(value: number | null | undefined) {
  return value === null || value === undefined ? "" : String(value);
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, value));
}

function formatDate(value: string | null | undefined) {
  return value ? new Date(value).toLocaleDateString("ar-SA") : "غير محدد";
}

function shortLabel(value: string) {
  return value.length > 18 ? `${value.slice(0, 18)}...` : value;
}
