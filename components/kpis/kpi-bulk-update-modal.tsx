"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { buildQuarterlyKpiValueRollups } from "@/lib/kpis/auto-calculations";
import { getKpiPeriodTarget } from "@/lib/kpis/aggregation";
import { getQuarterPeriodForDate } from "@/lib/kpis/periods";
import { calculateKpiStatus, formatKpiValue, getValueForKpi } from "@/lib/kpis/status";
import {
  fetchKpiValuesInRange,
  kpiKeys,
  mergeKpiValuesByKpiId,
  mergeKpiValuesByPeriod,
  upsertKpiValues,
  type KpiValueUpsert,
} from "@/lib/queries/kpis";
import type { KpiDefinition, KpiPeriodType, KpiValue } from "@/lib/supabase/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  definitions: KpiDefinition[];
  values: KpiValue[];
  currentUserId: string;
  periodType: KpiPeriodType;
  periodStart: string;
  periodEnd: string;
  periodLabel: string;
}

type DraftValue = {
  actualValue: string;
  notes: string;
};

export function KpiBulkUpdateModal({
  open,
  onOpenChange,
  definitions,
  values,
  currentUserId,
  periodType,
  periodStart,
  periodEnd,
  periodLabel,
}: Props) {
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, DraftValue>>({});
  const valuesQueryKey = kpiKeys.values(periodType, periodStart, periodEnd);

  useEffect(() => {
    if (!open) return;
    const nextDrafts = definitions.reduce<Record<string, DraftValue>>((acc, definition) => {
      const value = getValueForKpi(values, definition.id);
      acc[definition.id] = {
        actualValue: value?.actual_value === null || value?.actual_value === undefined ? "" : String(value.actual_value),
        notes: value?.notes ?? "",
      };
      return acc;
    }, {});
    setDrafts(nextDrafts);
  }, [definitions, open, values]);

  const mutation = useMutation({
    mutationFn: async () => {
      const updatedValues = await upsertKpiValues(payload);
      if (periodType === "quarterly") return { updatedValues, rollupValues: [], rollupPeriod: null };

      const rollupPeriod = getQuarterPeriodForDate(periodStart);
      const changedDefinitionIds = new Set(payload.map((value) => value.kpi_id));
      const changedDefinitions = definitions.filter((definition) => changedDefinitionIds.has(definition.id));
      const monthlyValues = await fetchKpiValuesInRange("monthly", rollupPeriod.periodStart, rollupPeriod.periodEnd);
      const rollupPayload = buildQuarterlyKpiValueRollups(monthlyValues, changedDefinitions, {
        periodStart: rollupPeriod.periodStart,
        periodEnd: rollupPeriod.periodEnd,
        userId: currentUserId,
      });
      const rollupValues = rollupPayload.length > 0 ? await upsertKpiValues(rollupPayload) : [];
      return { updatedValues, rollupValues, rollupPeriod };
    },
    onSuccess: ({ updatedValues, rollupValues, rollupPeriod }) => {
      toast.success("تم تحديث المؤشرات");
      queryClient.setQueryData(valuesQueryKey, (current: KpiValue[] | undefined) => mergeKpiValuesByKpiId(current, updatedValues));
      if (periodType === "quarterly") {
        queryClient.setQueryData(
          kpiKeys.yearValues(Number(periodStart.slice(0, 4))),
          (current: KpiValue[] | undefined) => mergeKpiValuesByPeriod(current, updatedValues)
        );
      }
      if (rollupPeriod && rollupValues.length > 0) {
        queryClient.setQueryData(
          kpiKeys.values("quarterly", rollupPeriod.periodStart, rollupPeriod.periodEnd),
          (current: KpiValue[] | undefined) => mergeKpiValuesByKpiId(current, rollupValues)
        );
        queryClient.setQueryData(
          kpiKeys.yearValues(Number(rollupPeriod.periodStart.slice(0, 4))),
          (current: KpiValue[] | undefined) => mergeKpiValuesByPeriod(current, rollupValues)
        );
      }
      queryClient.invalidateQueries({ queryKey: valuesQueryKey });
      if (rollupPeriod) {
        queryClient.invalidateQueries({ queryKey: kpiKeys.values("quarterly", rollupPeriod.periodStart, rollupPeriod.periodEnd) });
      }
      queryClient.invalidateQueries({ queryKey: kpiKeys.yearValues(Number(periodStart.slice(0, 4))) });
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "تعذر تحديث المؤشرات");
    },
  });

  const payload = useMemo<KpiValueUpsert[]>(() => {
    return definitions
      .map((definition) => {
        const draft = drafts[definition.id];
        if (!draft || draft.actualValue.trim() === "") return null;
        const numericValue = Number(draft.actualValue);
        if (Number.isNaN(numericValue)) return null;
        const periodTarget = getKpiPeriodTarget(definition, periodType);
        return {
          kpi_id: definition.id,
          period_type: periodType,
          period_start: periodStart,
          period_end: periodEnd,
          actual_value: numericValue,
          target_value: periodTarget,
          status: calculateKpiStatus({ ...definition, target_value: periodTarget }, numericValue),
          trend: "unknown",
          source: "manual",
          notes: draft.notes.trim() || null,
          updated_by: currentUserId,
        } satisfies KpiValueUpsert;
      })
      .filter(Boolean) as KpiValueUpsert[];
  }, [currentUserId, definitions, drafts, periodEnd, periodStart, periodType]);

  const groupedDefinitions = useMemo(() => {
    return definitions.reduce<Record<string, KpiDefinition[]>>((acc, definition) => {
      acc[definition.perspective] ??= [];
      acc[definition.perspective].push(definition);
      return acc;
    }, {});
  }, [definitions]);

  const updateDraft = (id: string, patch: Partial<DraftValue>) => {
    setDrafts((prev) => {
      const current = prev[id] ?? { actualValue: "", notes: "" };
      return { ...prev, [id]: { ...current, ...patch } };
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-5xl overflow-hidden p-0">
        <DialogHeader className="border-b border-slate-100 px-6 py-5">
          <DialogTitle>تحديث المؤشرات اليدوية</DialogTitle>
          <DialogDescription>
            الفترة الحالية: {periodLabel}. اترك الحقل فارغًا إذا لم يكن المؤشر جاهزًا للتحديث.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[65vh] overflow-y-auto px-6 py-5">
          <div className="space-y-6">
            {Object.entries(groupedDefinitions).map(([section, sectionDefinitions]) => (
              <section key={section} className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                <h3 className="mb-4 text-sm font-extrabold text-slate-900">{section}</h3>
                <div className="space-y-3">
                  {sectionDefinitions.map((definition) => (
                    <div key={definition.id} className="grid gap-3 rounded-lg border border-slate-100 bg-white p-3 md:grid-cols-[1.3fr_0.7fr_1fr]">
                      <div>
                        <p className="text-sm font-bold text-slate-900">{definition.name}</p>
                        <p className="mt-1 text-xs text-slate-500">المستهدف: {definition.target_text ?? formatKpiValue(definition.target_value, definition.target_unit)}</p>
                      </div>
                      <Input
                        type="number"
                        inputMode="decimal"
                        value={drafts[definition.id]?.actualValue ?? ""}
                        onChange={(event) => updateDraft(definition.id, { actualValue: event.target.value })}
                        placeholder="القيمة الحالية"
                      />
                      <Textarea
                        value={drafts[definition.id]?.notes ?? ""}
                        onChange={(event) => updateDraft(definition.id, { notes: event.target.value })}
                        placeholder="ملاحظات مختصرة"
                        className="min-h-9"
                      />
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>

        <DialogFooter className="border-t border-slate-100 px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            إلغاء
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || payload.length === 0}>
            <Save size={16} />
            {mutation.isPending ? "جاري الحفظ..." : `حفظ ${payload.length > 0 ? `${payload.length} مؤشر` : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
