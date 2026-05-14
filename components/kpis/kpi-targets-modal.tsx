"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Save, Target } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { kpiKeys, updateKpiDefinitionTarget } from "@/lib/queries/kpis";
import type { KpiDefinition } from "@/lib/supabase/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  definitions: KpiDefinition[];
}

type DraftTarget = {
  targetValue: string;
  targetText: string;
  targetUnit: string;
};

export function KpiTargetsModal({ open, onOpenChange, definitions }: Props) {
  const queryClient = useQueryClient();
  const [section, setSection] = useState("all");
  const [drafts, setDrafts] = useState<Record<string, DraftTarget>>({});

  const sections = useMemo(() => Array.from(new Set(definitions.map((definition) => definition.perspective))), [definitions]);
  const visibleDefinitions = section === "all" ? definitions : definitions.filter((definition) => definition.perspective === section);

  useEffect(() => {
    if (!open) return;
    setDrafts(
      definitions.reduce<Record<string, DraftTarget>>((acc, definition) => {
        acc[definition.id] = {
          targetValue: definition.target_value === null ? "" : String(definition.target_value),
          targetText: definition.target_text ?? "",
          targetUnit: definition.target_unit ?? "",
        };
        return acc;
      }, {})
    );
  }, [definitions, open]);

  const mutation = useMutation({
    mutationFn: async () => {
      const changed = definitions.filter((definition) => {
        const draft = drafts[definition.id];
        if (!draft) return false;
        return (
          draft.targetValue !== (definition.target_value === null ? "" : String(definition.target_value)) ||
          draft.targetText !== (definition.target_text ?? "") ||
          draft.targetUnit !== (definition.target_unit ?? "")
        );
      });

      const updates = await Promise.all(
        changed.map((definition) => {
          const draft = drafts[definition.id];
          return updateKpiDefinitionTarget({
            id: definition.id,
            target_value: draft.targetValue.trim() ? Number(draft.targetValue) : null,
            target_text: draft.targetText.trim() || null,
            target_unit: draft.targetUnit.trim() || null,
          });
        })
      );
      return updates;
    },
    onSuccess: (updatedDefinitions) => {
      toast.success("تم تحديث المستهدفات");
      queryClient.setQueryData(kpiKeys.definitions(), (current: KpiDefinition[] | undefined) => {
        const currentDefinitions = current ?? definitions;
        return currentDefinitions.map((definition) => updatedDefinitions.find((item) => item.id === definition.id) ?? definition);
      });
      queryClient.invalidateQueries({ queryKey: kpiKeys.definitions() });
      onOpenChange(false);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "تعذر تحديث المستهدفات"),
  });

  const updateDraft = (id: string, patch: Partial<DraftTarget>) => {
    setDrafts((current) => ({ ...current, [id]: { ...current[id], ...patch } }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-5xl overflow-hidden p-0">
        <DialogHeader className="border-b border-slate-100 px-6 py-5">
          <div className="flex items-center gap-2">
            <Target size={18} className="text-indigo-600" />
            <DialogTitle>تعديل مستهدفات المؤشرات</DialogTitle>
          </div>
          <DialogDescription>
            المستهدفات الافتراضية تأتي من ملف مؤشرات سماوة 2026، ويمكن تعديلها هنا في أي وقت حسب تحديثات الإدارة.
          </DialogDescription>
        </DialogHeader>

        <div className="border-b border-slate-100 px-6 py-4">
          <Select value={section} onValueChange={setSection}>
            <SelectTrigger className="max-w-sm bg-white">
              <SelectValue placeholder="القسم" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الأقسام</SelectItem>
              {sections.map((item) => (
                <SelectItem key={item} value={item}>{item}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="max-h-[58vh] overflow-y-auto px-6 py-5">
          <div className="space-y-3">
            {visibleDefinitions.map((definition) => (
              <div key={definition.id} className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-[1.2fr_0.5fr_0.7fr_0.4fr]">
                <div>
                  <p className="text-xs font-bold text-slate-500">{definition.perspective}</p>
                  <p className="mt-1 text-sm font-extrabold text-slate-900">{definition.name}</p>
                </div>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={drafts[definition.id]?.targetValue ?? ""}
                  onChange={(event) => updateDraft(definition.id, { targetValue: event.target.value })}
                  placeholder="القيمة"
                />
                <Input
                  value={drafts[definition.id]?.targetText ?? ""}
                  onChange={(event) => updateDraft(definition.id, { targetText: event.target.value })}
                  placeholder="وصف المستهدف"
                />
                <Input
                  value={drafts[definition.id]?.targetUnit ?? ""}
                  onChange={(event) => updateDraft(definition.id, { targetUnit: event.target.value })}
                  placeholder="الوحدة"
                />
              </div>
            ))}
          </div>
        </div>

        <DialogFooter className="border-t border-slate-100 px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            <Save size={16} />
            حفظ المستهدفات
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
