"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Edit, Plus, RefreshCw, Save, Trash2 } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { buildSimpleWorkspaceKpiValues } from "@/lib/kpis/auto-calculations";
import { formatKpiValue } from "@/lib/kpis/status";
import {
  deleteSimpleWorkspaceRecord,
  fetchSimpleWorkspaceRecords,
  kpiKeys,
  mergeKpiValuesByKpiId,
  saveSimpleWorkspaceRecord,
  upsertKpiValues,
  type SimpleWorkspaceKind,
  type SimpleWorkspacePayload,
  type SimpleWorkspaceRecord,
} from "@/lib/queries/kpis";
import type { KpiDefinition, KpiPeriodType, KpiValue, Profile } from "@/lib/supabase/types";

interface Props {
  kind: SimpleWorkspaceKind;
  section: string;
  currentUser: Profile;
  definitions: KpiDefinition[];
  initialRecords: SimpleWorkspaceRecord[];
  periodType: KpiPeriodType;
  periodStart: string;
  periodEnd: string;
}

type Field = {
  key: string;
  label: string;
  type: "text" | "number" | "date" | "textarea" | "select";
  required?: boolean;
  options?: { value: string; label: string }[];
};

const configs: Record<SimpleWorkspaceKind, { title: string; action: string; fields: Field[] }> = {
  revenue: {
    title: "مساحة الإيرادات",
    action: "إيراد جديد",
    fields: [
      { key: "entry_date", label: "تاريخ الإيراد", type: "date", required: true },
      { key: "revenue_type", label: "نوع الإيراد", type: "select", required: true, options: [
        { value: "government", label: "حكومي" },
        { value: "non_government", label: "غير حكومي" },
        { value: "product", label: "منتجات" },
      ] },
      { key: "client_name", label: "اسم العميل", type: "text" },
      { key: "amount", label: "المبلغ", type: "number", required: true },
      { key: "status", label: "الحالة", type: "select", options: [
        { value: "expected", label: "متوقع" },
        { value: "confirmed", label: "مؤكد" },
        { value: "collected", label: "محصل" },
      ] },
      { key: "notes", label: "ملاحظات", type: "textarea" },
    ],
  },
  clients: {
    title: "مساحة العقود والعملاء",
    action: "فرصة جديدة",
    fields: [
      { key: "client_name", label: "اسم العميل", type: "text", required: true },
      { key: "record_type", label: "نوع السجل", type: "select", required: true, options: [
        { value: "strategic_client", label: "عميل نوعي" },
        { value: "new_client", label: "عميل جديد" },
        { value: "proposal", label: "عرض مقدم" },
        { value: "repeat_client", label: "عميل متكرر" },
        { value: "satisfaction", label: "رضا العملاء" },
      ] },
      { key: "status", label: "الحالة", type: "select", options: [
        { value: "contacted", label: "تواصل" },
        { value: "proposal_submitted", label: "تم تقديم عرض" },
        { value: "won", label: "مكتسب" },
        { value: "lost", label: "خاسر" },
        { value: "repeat", label: "متكرر" },
      ] },
      { key: "opportunity_value", label: "قيمة الفرصة", type: "number" },
      { key: "satisfaction_score", label: "درجة الرضا", type: "number" },
      { key: "submitted_at", label: "تاريخ السجل", type: "date" },
      { key: "notes", label: "ملاحظات", type: "textarea" },
    ],
  },
  audience: {
    title: "مساحة الجمهور والمشتركين",
    action: "قياس جديد",
    fields: [
      { key: "metric_date", label: "تاريخ القياس", type: "date", required: true },
      { key: "platform", label: "المنصة", type: "text", required: true },
      { key: "subscribers", label: "المشتركون", type: "number" },
      { key: "paid_views_avg", label: "متوسط المشاهدات المدفوعة", type: "number" },
      { key: "organic_views_avg", label: "متوسط المشاهدات العضوية", type: "number" },
      { key: "top_episode_views", label: "أعلى مشاهدة لحلقة", type: "number" },
      { key: "influencer_reach", label: "وصول المؤثرين", type: "number" },
      { key: "notes", label: "ملاحظات", type: "textarea" },
    ],
  },
  services: {
    title: "مساحة البرامج والخدمات",
    action: "مخرج جديد",
    fields: [
      { key: "name", label: "اسم المخرج", type: "text", required: true },
      { key: "output_type", label: "نوع المخرج", type: "select", required: true, options: [
        { value: "podcast", label: "بودكاست" },
        { value: "youtube_program", label: "برنامج يوتيوب" },
        { value: "media_report", label: "تقرير إعلامي" },
        { value: "other", label: "أخرى" },
      ] },
      { key: "quantity", label: "الكمية", type: "number" },
      { key: "status", label: "الحالة", type: "select", options: [
        { value: "planned", label: "مخطط" },
        { value: "in_progress", label: "قيد التنفيذ" },
        { value: "completed", label: "مكتمل" },
        { value: "cancelled", label: "ملغي" },
      ] },
      { key: "delivery_date", label: "تاريخ التسليم", type: "date" },
      { key: "notes", label: "ملاحظات", type: "textarea" },
    ],
  },
  partnerships: {
    title: "مساحة الشراكات والتموضع",
    action: "نشاط جديد",
    fields: [
      { key: "entity_name", label: "الجهة / النشاط", type: "text", required: true },
      { key: "activity_type", label: "نوع النشاط", type: "select", required: true, options: [
        { value: "award", label: "جائزة" },
        { value: "sponsorship", label: "رعاية" },
        { value: "event", label: "فعالية" },
        { value: "partnership", label: "شراكة" },
        { value: "speaker", label: "تحدث" },
        { value: "product_sponsor", label: "راعي منتج" },
      ] },
      { key: "status", label: "الحالة", type: "select", options: [
        { value: "planned", label: "مخطط" },
        { value: "contacted", label: "تواصل" },
        { value: "confirmed", label: "مؤكد" },
        { value: "completed", label: "مكتمل" },
        { value: "cancelled", label: "ملغي" },
      ] },
      { key: "impact_value", label: "قيمة الأثر", type: "number" },
      { key: "activity_date", label: "تاريخ النشاط", type: "date" },
      { key: "notes", label: "ملاحظات", type: "textarea" },
    ],
  },
};

const defaults: Record<SimpleWorkspaceKind, Record<string, string>> = {
  revenue: { entry_date: today(), revenue_type: "government", amount: "0", status: "confirmed", client_name: "", notes: "" },
  clients: { client_name: "", record_type: "new_client", status: "contacted", opportunity_value: "", satisfaction_score: "", submitted_at: today(), notes: "" },
  audience: { metric_date: today(), platform: "", subscribers: "0", paid_views_avg: "0", organic_views_avg: "0", top_episode_views: "0", influencer_reach: "0", notes: "" },
  services: { name: "", output_type: "podcast", quantity: "1", status: "planned", delivery_date: today(), notes: "" },
  partnerships: { entity_name: "", activity_type: "award", status: "planned", impact_value: "", activity_date: today(), notes: "" },
};

export function SimpleSectionWorkspace({
  kind,
  section,
  currentUser,
  definitions,
  initialRecords,
  periodType,
  periodStart,
  periodEnd,
}: Props) {
  const queryClient = useQueryClient();
  const config = configs[kind];
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>(defaults[kind]);
  const canManage = kind === "revenue" ? currentUser.role === "admin" : currentUser.role === "admin" || currentUser.role === "project_manager";
  const recordsQueryKey = kpiKeys.simpleWorkspace(kind, periodType, periodStart, periodEnd);
  const valuesQueryKey = kpiKeys.values(periodType, periodStart, periodEnd);

  const { data: records = [], isFetching } = useQuery({
    queryKey: recordsQueryKey,
    queryFn: () => fetchSimpleWorkspaceRecords(kind, periodStart, periodEnd),
    initialData: initialRecords,
  });

  const sectionDefinitions = definitions.filter((definition) => definition.perspective === section);
  const chartData = useMemo(() => summarizeRecords(kind, records), [kind, records]);
  const totalValue = chartData.reduce((sum, item) => sum + item.value, 0);

  const syncKpis = async (nextRecords: SimpleWorkspaceRecord[]) => {
    const values = buildSimpleWorkspaceKpiValues(kind, nextRecords, definitions, {
      periodType,
      periodStart,
      periodEnd,
      userId: currentUser.id,
    });
    return values.length > 0 ? upsertKpiValues(values) : [];
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const saved = await saveSimpleWorkspaceRecord(kind, toPayload(kind, draft, currentUser.id));
      const nextRecords = mergeSimpleRecord(records, saved, kind, periodStart, periodEnd);
      const kpiValues = await syncKpis(nextRecords);
      return { kpiValues, nextRecords };
    },
    onSuccess: ({ kpiValues, nextRecords }) => {
      toast.success("تم حفظ السجل");
      queryClient.setQueryData(recordsQueryKey, nextRecords);
      queryClient.setQueryData(valuesQueryKey, (current: KpiValue[] | undefined) => mergeKpiValuesByKpiId(current, kpiValues));
      queryClient.invalidateQueries({ queryKey: kpiKeys.simpleWorkspace(kind) });
      queryClient.invalidateQueries({ queryKey: valuesQueryKey });
      setOpen(false);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "تعذر حفظ السجل"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (record: SimpleWorkspaceRecord) => {
      await deleteSimpleWorkspaceRecord(kind, record.id);
      const nextRecords = records.filter((item) => item.id !== record.id);
      const kpiValues = await syncKpis(nextRecords);
      return { kpiValues, nextRecords };
    },
    onSuccess: ({ kpiValues, nextRecords }) => {
      toast.success("تم حذف السجل");
      queryClient.setQueryData(recordsQueryKey, nextRecords);
      queryClient.setQueryData(valuesQueryKey, (current: KpiValue[] | undefined) => mergeKpiValuesByKpiId(current, kpiValues));
      queryClient.invalidateQueries({ queryKey: kpiKeys.simpleWorkspace(kind) });
      queryClient.invalidateQueries({ queryKey: valuesQueryKey });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "تعذر حذف السجل"),
  });

  const editRecord = (record?: SimpleWorkspaceRecord) => {
    setDraft(record ? fromRecord(kind, record) : defaults[kind]);
    setOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Stat label="عدد السجلات" value={records.length} />
        <Stat label="إجمالي القيمة" value={formatKpiValue(totalValue)} />
        <Stat label="مؤشرات هذا القسم" value={sectionDefinitions.length} />
      </div>

      {isFetching && (
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
          <RefreshCw size={14} className="animate-spin" />
          يتم تحديث سجلات الفترة...
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">{config.title}</h2>
            <p className="mt-1 text-xs text-slate-500">إدخال بسيط يغذي مؤشرات القسم عند وضوح الربط.</p>
          </div>
          {canManage && (
            <Button onClick={() => editRecord()}>
              <Plus size={16} />
              {config.action}
            </Button>
          )}
        </div>
        <div className="h-72" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ right: 16, left: 16 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" name="القيمة" fill="#0f766e" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-right text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3">السجل</th>
              <th className="px-4 py-3">النوع</th>
              <th className="px-4 py-3">القيمة</th>
              <th className="px-4 py-3">الحالة</th>
              {canManage && <th className="px-4 py-3">إجراءات</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {records.map((record) => {
              const row = toRow(kind, record);
              return (
                <tr key={record.id}>
                  <td className="px-4 py-3">
                    <p className="font-bold text-slate-900">{row.title}</p>
                    <p className="text-xs text-slate-500">{row.description || row.date || "بدون تاريخ"}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{row.type}</td>
                  <td className="px-4 py-3 font-bold">{formatKpiValue(row.value, row.unit)}</td>
                  <td className="px-4 py-3">{row.status}</td>
                  {canManage && (
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => editRecord(record)} disabled={deleteMutation.isPending}><Edit size={14} /></Button>
                        <Button variant="outline" size="sm" onClick={() => deleteMutation.mutate(record)} disabled={deleteMutation.isPending}><Trash2 size={14} /></Button>
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{draft.id ? "تعديل السجل" : config.action}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 md:grid-cols-2">
            {config.fields.map((field) => (
              <FieldInput key={field.key} field={field} value={draft[field.key] ?? ""} onChange={(value) => setDraft({ ...draft, [field.key]: value })} />
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
            <Button disabled={!isValid(config.fields, draft) || saveMutation.isPending} onClick={() => saveMutation.mutate()}>
              <Save size={16} />
              {saveMutation.isPending ? "جاري الحفظ..." : "حفظ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FieldInput({ field, value, onChange }: { field: Field; value: string; onChange: (value: string) => void }) {
  if (field.type === "select") {
    return (
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger><SelectValue placeholder={field.label} /></SelectTrigger>
        <SelectContent>
          {field.options?.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
        </SelectContent>
      </Select>
    );
  }

  if (field.type === "textarea") {
    return <Textarea className="md:col-span-2" value={value} onChange={(event) => onChange(event.target.value)} placeholder={field.label} />;
  }

  return <Input type={field.type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={field.label} />;
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-extrabold text-slate-900">{value}</p>
    </div>
  );
}

function mergeSimpleRecord(
  records: SimpleWorkspaceRecord[],
  record: SimpleWorkspaceRecord,
  kind: SimpleWorkspaceKind,
  periodStart: string,
  periodEnd: string
) {
  const withoutRecord = records.filter((item) => item.id !== record.id);
  if (!isRecordInPeriod(kind, record, periodStart, periodEnd)) return withoutRecord;
  return [record, ...withoutRecord];
}

function isRecordInPeriod(kind: SimpleWorkspaceKind, record: SimpleWorkspaceRecord, periodStart: string, periodEnd: string) {
  const recordDate = getRecordDate(kind, record);
  return Boolean(recordDate && recordDate >= periodStart && recordDate <= periodEnd);
}

function getRecordDate(kind: SimpleWorkspaceKind, record: SimpleWorkspaceRecord) {
  if (kind === "revenue" && isRevenue(record)) return record.entry_date;
  if (kind === "clients" && isClient(record)) return record.submitted_at;
  if (kind === "audience" && isAudience(record)) return record.metric_date;
  if (kind === "services" && isService(record)) return record.delivery_date;
  if (kind === "partnerships" && isPartnership(record)) return record.activity_date;
  return null;
}

function summarizeRecords(kind: SimpleWorkspaceKind, records: SimpleWorkspaceRecord[]) {
  if (kind === "audience") {
    const rows = records.filter(isAudience);
    return [
      { name: "المشتركون", value: sum(rows, "subscribers") },
      { name: "مشاهدات مدفوعة", value: average(rows.map((row) => row.paid_views_avg)) ?? 0 },
      { name: "مشاهدات عضوية", value: average(rows.map((row) => row.organic_views_avg)) ?? 0 },
      { name: "أعلى حلقة", value: Math.max(0, ...rows.map((row) => row.top_episode_views)) },
      { name: "وصول المؤثرين", value: sum(rows, "influencer_reach") },
    ];
  }

  const grouped = records.reduce<Record<string, number>>((acc, record) => {
    const row = toRow(kind, record);
    acc[row.type] = (acc[row.type] ?? 0) + row.value;
    return acc;
  }, {});
  return Object.entries(grouped).map(([name, value]) => ({ name, value }));
}

function toPayload(kind: SimpleWorkspaceKind, draft: Record<string, string>, userId: string): SimpleWorkspacePayload {
  const base = { ...(draft.id ? { id: draft.id } : {}), created_by: userId, notes: draft.notes?.trim() || null };
  if (kind === "revenue") return { ...base, entry_date: draft.entry_date, revenue_type: draft.revenue_type as "government", client_name: draft.client_name || null, amount: number(draft.amount), status: draft.status as "confirmed" };
  if (kind === "clients") return { ...base, client_name: draft.client_name, record_type: draft.record_type as "new_client", status: draft.status as "contacted", opportunity_value: optionalNumber(draft.opportunity_value), satisfaction_score: optionalNumber(draft.satisfaction_score), submitted_at: draft.submitted_at || null };
  if (kind === "audience") return { ...base, metric_date: draft.metric_date, platform: draft.platform, subscribers: number(draft.subscribers), paid_views_avg: number(draft.paid_views_avg), organic_views_avg: number(draft.organic_views_avg), top_episode_views: number(draft.top_episode_views), influencer_reach: number(draft.influencer_reach) };
  if (kind === "services") return { ...base, name: draft.name, output_type: draft.output_type as "podcast", quantity: number(draft.quantity), status: draft.status as "planned", delivery_date: draft.delivery_date || null };
  return { ...base, entity_name: draft.entity_name, activity_type: draft.activity_type as "award", status: draft.status as "planned", impact_value: optionalNumber(draft.impact_value), activity_date: draft.activity_date || null };
}

function fromRecord(kind: SimpleWorkspaceKind, record: SimpleWorkspaceRecord) {
  if (kind === "revenue" && isRevenue(record)) return { id: record.id, entry_date: record.entry_date, revenue_type: record.revenue_type, client_name: record.client_name ?? "", amount: String(record.amount), status: record.status, notes: record.notes ?? "" };
  if (kind === "clients" && isClient(record)) return { id: record.id, client_name: record.client_name, record_type: record.record_type, status: record.status, opportunity_value: value(record.opportunity_value), satisfaction_score: value(record.satisfaction_score), submitted_at: record.submitted_at ?? "", notes: record.notes ?? "" };
  if (kind === "audience" && isAudience(record)) return { id: record.id, metric_date: record.metric_date, platform: record.platform, subscribers: String(record.subscribers), paid_views_avg: String(record.paid_views_avg), organic_views_avg: String(record.organic_views_avg), top_episode_views: String(record.top_episode_views), influencer_reach: String(record.influencer_reach), notes: record.notes ?? "" };
  if (kind === "services" && isService(record)) return { id: record.id, name: record.name, output_type: record.output_type, quantity: String(record.quantity), status: record.status, delivery_date: record.delivery_date ?? "", notes: record.notes ?? "" };
  if (kind === "partnerships" && isPartnership(record)) return { id: record.id, entity_name: record.entity_name, activity_type: record.activity_type, status: record.status, impact_value: value(record.impact_value), activity_date: record.activity_date ?? "", notes: record.notes ?? "" };
  return defaults[kind];
}

function toRow(kind: SimpleWorkspaceKind, record: SimpleWorkspaceRecord) {
  if (kind === "revenue" && isRevenue(record)) return { title: record.client_name ?? "إيراد", type: record.revenue_type, value: record.amount, unit: "ريال", status: record.status, date: record.entry_date, description: "" };
  if (kind === "clients" && isClient(record)) return { title: record.client_name, type: record.record_type, value: record.satisfaction_score ?? record.opportunity_value ?? 1, unit: record.satisfaction_score !== null ? "%" : "", status: record.status, date: record.submitted_at, description: "" };
  if (kind === "audience" && isAudience(record)) {
    const metricValue = record.subscribers || record.paid_views_avg || record.organic_views_avg || record.top_episode_views || record.influencer_reach;
    return {
      title: record.platform,
      type: "جمهور",
      value: metricValue,
      unit: record.subscribers ? "مشترك" : "",
      status: "محدث",
      date: record.metric_date,
      description: `مشتركين: ${formatKpiValue(record.subscribers)} | مدفوع: ${formatKpiValue(record.paid_views_avg)} | عضوي: ${formatKpiValue(record.organic_views_avg)} | أعلى حلقة: ${formatKpiValue(record.top_episode_views)} | مؤثرين: ${formatKpiValue(record.influencer_reach)}`,
    };
  }
  if (kind === "services" && isService(record)) return { title: record.name, type: record.output_type, value: record.quantity, unit: "", status: record.status, date: record.delivery_date, description: "" };
  if (kind === "partnerships" && isPartnership(record)) return { title: record.entity_name, type: record.activity_type, value: record.impact_value ?? 1, unit: "", status: record.status, date: record.activity_date, description: "" };
  return { title: "سجل", type: "غير محدد", value: 0, unit: "", status: "", date: "", description: "" };
}

function isValid(fields: Field[], draft: Record<string, string>) {
  return fields.every((field) => !field.required || Boolean(draft[field.key]?.trim()));
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function number(input?: string) {
  const parsed = Number(input || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function optionalNumber(input?: string) {
  if (!input?.trim()) return null;
  return number(input);
}

function value(input: number | null) {
  return input === null ? "" : String(input);
}

function sum<T>(rows: T[], key: keyof T) {
  return rows.reduce((total, row) => total + Number(row[key] ?? 0), 0);
}

function average(values: (number | null)[]) {
  const usable = values.filter((item): item is number => item !== null && Number.isFinite(item));
  return usable.length ? usable.reduce((total, item) => total + item, 0) / usable.length : null;
}

function isRevenue(record: SimpleWorkspaceRecord): record is Extract<SimpleWorkspaceRecord, { revenue_type: string }> {
  return "revenue_type" in record;
}
function isClient(record: SimpleWorkspaceRecord): record is Extract<SimpleWorkspaceRecord, { client_name: string; record_type: string }> {
  return "record_type" in record;
}
function isAudience(record: SimpleWorkspaceRecord): record is Extract<SimpleWorkspaceRecord, { platform: string }> {
  return "platform" in record;
}
function isService(record: SimpleWorkspaceRecord): record is Extract<SimpleWorkspaceRecord, { output_type: string }> {
  return "output_type" in record;
}
function isPartnership(record: SimpleWorkspaceRecord): record is Extract<SimpleWorkspaceRecord, { activity_type: string }> {
  return "activity_type" in record;
}
