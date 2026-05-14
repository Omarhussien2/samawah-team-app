"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Edit, PackagePlus, RefreshCw, Save, Trash2 } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { buildProductKpiValues } from "@/lib/kpis/auto-calculations";
import { getRelatedKpiPeriods, type KpiPeriodOption } from "@/lib/kpis/periods";
import { formatKpiValue } from "@/lib/kpis/status";
import {
  deleteIndicatorProduct,
  fetchIndicatorProducts,
  kpiKeys,
  mergeKpiValuesByKpiId,
  saveIndicatorProduct,
  upsertKpiValues,
} from "@/lib/queries/kpis";
import type { IndicatorProduct, KpiDefinition, KpiPeriodType, KpiValue, Profile } from "@/lib/supabase/types";

interface Props {
  currentUser: Profile;
  definitions: KpiDefinition[];
  initialProducts: IndicatorProduct[];
  periodType: KpiPeriodType;
  periodStart: string;
  periodEnd: string;
}

const blankDraft = {
  id: "",
  name: "",
  category: "",
  description: "",
  currentValue: "",
  targetValue: "",
  unit: "",
  kpiId: "none",
  status: "active",
  notes: "",
};

type Draft = typeof blankDraft;
type KpiSyncResult = {
  period: KpiPeriodOption;
  values: KpiValue[];
};

export function ProductsWorkspace({
  currentUser,
  definitions,
  initialProducts,
  periodType,
  periodStart,
  periodEnd,
}: Props) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(blankDraft);
  const productDefinitions = definitions.filter((definition) => definition.auto_source === "indicator_products");
  const canManage = currentUser.role === "admin" || currentUser.role === "project_manager";

  const { data: products = initialProducts, isFetching } = useQuery({
    queryKey: kpiKeys.products(),
    queryFn: fetchIndicatorProducts,
    initialData: initialProducts,
  });

  const syncLinkedKpi = async (nextProducts: IndicatorProduct[]): Promise<KpiSyncResult[]> => {
    return Promise.all(getRelatedKpiPeriods(periodType, periodStart, periodEnd).map(async (period) => {
      const values = buildProductKpiValues(nextProducts, definitions, {
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
      const payload = {
        ...(draft.id ? { id: draft.id } : {}),
        name: draft.name.trim(),
        category: draft.category.trim() || null,
        description: draft.description.trim() || null,
        current_value: Number(draft.currentValue || 0),
        target_value: draft.targetValue.trim() ? Number(draft.targetValue) : null,
        unit: draft.unit.trim() || null,
        kpi_id: draft.kpiId === "none" ? null : draft.kpiId,
        status: draft.status as IndicatorProduct["status"],
        notes: draft.notes.trim() || null,
        created_by: currentUser.id,
      };
      const saved = await saveIndicatorProduct(payload);
      const nextProducts = draft.id ? products.map((item) => (item.id === saved.id ? saved : item)) : [saved, ...products];
      const syncResults = await syncLinkedKpi(nextProducts);
      return { nextProducts, syncResults };
    },
    onSuccess: ({ nextProducts, syncResults }) => {
      toast.success("تم حفظ المنتج وتحديث مؤشرات الفترة");
      queryClient.setQueryData(kpiKeys.products(), nextProducts);
      syncResults.forEach(({ period, values }) => {
        queryClient.setQueryData(
          kpiKeys.values(period.periodType, period.periodStart, period.periodEnd),
          (current: KpiValue[] | undefined) => mergeKpiValuesByKpiId(current, values)
        );
      });
      queryClient.invalidateQueries({ queryKey: kpiKeys.products() });
      syncResults.forEach(({ period }) => {
        queryClient.invalidateQueries({ queryKey: kpiKeys.values(period.periodType, period.periodStart, period.periodEnd) });
      });
      setOpen(false);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "تعذر حفظ المنتج"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (product: IndicatorProduct) => {
      await deleteIndicatorProduct(product.id);
      const nextProducts = products.filter((item) => item.id !== product.id);
      const syncResults = await syncLinkedKpi(nextProducts);
      return { nextProducts, syncResults };
    },
    onSuccess: ({ nextProducts, syncResults }) => {
      toast.success("تم حذف المنتج وتحديث مؤشرات الفترة");
      queryClient.setQueryData(kpiKeys.products(), nextProducts);
      syncResults.forEach(({ period, values }) => {
        queryClient.setQueryData(
          kpiKeys.values(period.periodType, period.periodStart, period.periodEnd),
          (current: KpiValue[] | undefined) => mergeKpiValuesByKpiId(current, values)
        );
      });
      queryClient.invalidateQueries({ queryKey: kpiKeys.products() });
      syncResults.forEach(({ period }) => {
        queryClient.invalidateQueries({ queryKey: kpiKeys.values(period.periodType, period.periodStart, period.periodEnd) });
      });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "تعذر حذف المنتج"),
  });

  const chartData = useMemo(
    () => products.filter((product) => product.status !== "archived").map((product) => ({
      name: product.name,
      value: Number(product.current_value ?? 0),
      target: product.target_value ?? 0,
    })),
    [products]
  );
  const totalValue = products.reduce((sum, product) => sum + Number(product.current_value ?? 0), 0);

  const editProduct = (product?: IndicatorProduct) => {
    setDraft(product ? {
      id: product.id,
      name: product.name,
      category: product.category ?? "",
      description: product.description ?? "",
      currentValue: String(product.current_value ?? 0),
      targetValue: product.target_value === null ? "" : String(product.target_value),
      unit: product.unit ?? "",
      kpiId: product.kpi_id ?? "none",
      status: product.status,
      notes: product.notes ?? "",
    } : blankDraft);
    setOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">عدد المنتجات</p>
          <p className="mt-2 text-3xl font-extrabold text-slate-900">{products.length}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">إجمالي القيمة الحالية</p>
          <p className="mt-2 text-3xl font-extrabold text-slate-900">{formatKpiValue(totalValue)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">منتجات مرتبطة بمؤشرات</p>
          <p className="mt-2 text-3xl font-extrabold text-slate-900">{products.filter((product) => product.kpi_id).length}</p>
        </div>
      </div>

      {isFetching && (
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
          <RefreshCw size={14} className="animate-spin" />
          يتم تحديث بيانات المنتجات...
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-base font-bold text-slate-900">لوحة المنتجات</h2>
          {canManage && (
            <Button onClick={() => editProduct()}>
              <PackagePlus size={16} />
              منتج جديد
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
              <Bar dataKey="value" name="القيمة الحالية" fill="#2563eb" radius={[6, 6, 0, 0]} />
              <Bar dataKey="target" name="المستهدف" fill="#94a3b8" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-right text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3">المنتج</th>
              <th className="px-4 py-3">القيمة الحالية</th>
              <th className="px-4 py-3">المؤشر المرتبط</th>
              <th className="px-4 py-3">الحالة</th>
              {canManage && <th className="px-4 py-3">إجراءات</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {products.map((product) => (
              <tr key={product.id}>
                <td className="px-4 py-3">
                  <p className="font-bold text-slate-900">{product.name}</p>
                  <p className="text-xs text-slate-500">{product.category ?? "بدون تصنيف"}</p>
                </td>
                <td className="px-4 py-3 font-bold">{formatKpiValue(product.current_value, product.unit)}</td>
                <td className="px-4 py-3 text-slate-600">{productDefinitions.find((definition) => definition.id === product.kpi_id)?.name ?? "غير مرتبط"}</td>
                <td className="px-4 py-3">{product.status === "active" ? "نشط" : product.status === "paused" ? "متوقف" : "مؤرشف"}</td>
                {canManage && (
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => editProduct(product)} disabled={deleteMutation.isPending}><Edit size={14} /></Button>
                      <Button variant="outline" size="sm" onClick={() => deleteMutation.mutate(product)} disabled={deleteMutation.isPending}><Trash2 size={14} /></Button>
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
            <DialogTitle>{draft.id ? "تعديل المنتج" : "إضافة منتج"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 md:grid-cols-2">
            <Input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="اسم المنتج" />
            <Input value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })} placeholder="التصنيف" />
            <Input type="number" value={draft.currentValue} onChange={(event) => setDraft({ ...draft, currentValue: event.target.value })} placeholder="القيمة الحالية" />
            <Input type="number" value={draft.targetValue} onChange={(event) => setDraft({ ...draft, targetValue: event.target.value })} placeholder="المستهدف" />
            <Input value={draft.unit} onChange={(event) => setDraft({ ...draft, unit: event.target.value })} placeholder="الوحدة" />
            <Select value={draft.kpiId} onValueChange={(value) => setDraft({ ...draft, kpiId: value })}>
              <SelectTrigger><SelectValue placeholder="المؤشر المرتبط" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">بدون ربط</SelectItem>
                {productDefinitions.map((definition) => <SelectItem key={definition.id} value={definition.id}>{definition.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Textarea className="md:col-span-2" value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} placeholder="وصف مختصر" />
            <Textarea className="md:col-span-2" value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} placeholder="ملاحظات" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
            <Button disabled={!draft.name.trim() || saveMutation.isPending} onClick={() => saveMutation.mutate()}>
              <Save size={16} />
              {saveMutation.isPending ? "جاري الحفظ..." : "حفظ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
