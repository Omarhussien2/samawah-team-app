"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import {
  CHALLENGE_KIND_LABELS,
  RESPONSE_STRATEGY_LABELS,
  RISK_LEVEL_LABELS,
  calculateRiskScore,
  getChallengeRiskLevel,
  getChallengeRiskScore,
  summarizeChallenges,
  type ChallengeKind,
  type ChallengeResponseStrategy,
} from "@/lib/challenges/risk";
import { buildChallengeRiskKpiValues } from "@/lib/kpis/auto-calculations";
import { getCurrentKpiPeriod } from "@/lib/kpis/periods";
import { fetchChallengeRiskRecords, upsertKpiValues } from "@/lib/queries/kpis";
import { formatRelativeAr, getChallengeStatusLabel, cn } from "@/lib/utils";
import type { Challenge, Database, KpiDefinition, Profile } from "@/lib/supabase/types";

type ProjectChallenge = Challenge & {
  owner?: { id: string; full_name: string | null } | null;
  kpi?: { id: string; name: string; code: string } | null;
};

interface Props {
  challenges: ProjectChallenge[];
  profiles: Pick<Profile, "id" | "full_name" | "avatar_url">[];
  projectId: string;
  currentUser: Profile;
  kpiDefinitions: KpiDefinition[];
}

const RISK_LEVEL_COLORS = {
  low: "border-emerald-200 bg-emerald-50 text-emerald-700",
  medium: "border-amber-200 bg-amber-50 text-amber-700",
  high: "border-orange-200 bg-orange-50 text-orange-700",
  critical: "border-rose-200 bg-rose-50 text-rose-700",
};

const STATUS_COLORS: Record<Challenge["status"], string> = {
  open: "bg-rose-100 text-rose-700",
  in_progress: "bg-blue-100 text-blue-700",
  resolved: "bg-emerald-100 text-emerald-700",
  closed: "bg-slate-100 text-slate-500",
};

const FIELD_CLASS = "w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30";

export function ChallengesList({ challenges, profiles: _profiles, projectId, currentUser, kpiDefinitions }: Props) {
  const router = useRouter();
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({
    title: "",
    description: "",
    kind: "challenge" as ChallengeKind,
    risk_type: "",
    probability_score: "3",
    impact_score: "3",
    response_strategy: "mitigate" as ChallengeResponseStrategy,
    mitigation_plan: "",
    due_date: "",
    kpi_id: kpiDefinitions.find((kpi) => kpi.code === "OPS_RISK_COVERAGE")?.id ?? "",
  });
  const summary = useMemo(() => summarizeChallenges(challenges), [challenges]);

  const handleAdd = async () => {
    if (!draft.title.trim()) {
      toast.error("عنوان التحدي مطلوب");
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const score = calculateRiskScore(Number(draft.probability_score), Number(draft.impact_score));
    const payload: Database["public"]["Tables"]["challenges"]["Insert"] = {
      project_id: projectId,
      title: draft.title.trim(),
      description: emptyToNull(draft.description),
      status: "open",
      owner_id: currentUser.id,
      kind: draft.kind,
      risk_type: emptyToNull(draft.risk_type),
      probability_score: toRiskNumber(draft.probability_score),
      impact_score: toRiskNumber(draft.impact_score),
      response_strategy: draft.response_strategy,
      mitigation_plan: emptyToNull(draft.mitigation_plan),
      due_date: emptyToNull(draft.due_date),
      kpi_id: emptyToNull(draft.kpi_id),
      risk_impact: score >= 12 ? "High" : score >= 6 ? "Medium" : "Low",
    };

    const { error } = await supabase.from("challenges").insert(payload);
    if (error) {
      toast.error("فشل إنشاء التحدي");
      setSaving(false);
      return;
    }

    if (currentUser.role !== "member") await syncRiskKpi(kpiDefinitions, currentUser.id);
    toast.success("تم إنشاء التحدي");
    setShowAdd(false);
    setSaving(false);
    router.refresh();
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-4">
        <SummaryCard label="إجمالي البنود" value={summary.total} />
        <SummaryCard label="مفتوحة" value={summary.open} />
        <SummaryCard label="حرجة" value={summary.critical} tone={summary.critical > 0 ? "danger" : "default"} />
        <SummaryCard label="تغطية المخاطر" value={`${summary.riskCoverage}%`} tone={summary.riskCoverage < 80 ? "warning" : "success"} />
      </div>

      <div className="flex justify-end">
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary/90">
          <Plus size={15} /> بند جديد
        </button>
      </div>

      {challenges.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 bg-white py-10 text-center text-muted-foreground">
          لا توجد تحديات أو مخاطر في هذا المشروع
        </div>
      ) : (
        <div className="space-y-3">
          {challenges.map((challenge) => (
            <ProjectChallengeCard key={challenge.id} challenge={challenge} />
          ))}
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <h3 className="font-bold">بند تحديات ومخاطر جديد</h3>
                <p className="mt-1 text-sm text-slate-500">حدد درجة المخاطر وخطة التعامل ليظهر أثرها في مؤشرات المشروع.</p>
              </div>
              <button onClick={() => setShowAdd(false)} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="إغلاق">
                <X size={18} />
              </button>
            </div>
            <div className="grid max-h-[62vh] gap-4 overflow-y-auto px-6 py-5 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-bold text-slate-700 md:col-span-2">
                العنوان
                <input value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} className={FIELD_CLASS} />
              </label>
              <label className="grid gap-2 text-sm font-bold text-slate-700">
                النوع
                <select value={draft.kind} onChange={(event) => setDraft((current) => ({ ...current, kind: event.target.value as ChallengeKind }))} className={cn(FIELD_CLASS, "bg-white")}>
                  <option value="challenge">تحدي</option>
                  <option value="risk">مخاطر</option>
                  <option value="issue">عائق قائم</option>
                </select>
              </label>
              <label className="grid gap-2 text-sm font-bold text-slate-700">
                التصنيف
                <input value={draft.risk_type} onChange={(event) => setDraft((current) => ({ ...current, risk_type: event.target.value }))} className={FIELD_CLASS} />
              </label>
              <label className="grid gap-2 text-sm font-bold text-slate-700">
                الاحتمالية
                <input type="number" min={1} max={5} value={draft.probability_score} onChange={(event) => setDraft((current) => ({ ...current, probability_score: event.target.value }))} className={FIELD_CLASS} />
              </label>
              <label className="grid gap-2 text-sm font-bold text-slate-700">
                الأثر
                <input type="number" min={1} max={5} value={draft.impact_score} onChange={(event) => setDraft((current) => ({ ...current, impact_score: event.target.value }))} className={FIELD_CLASS} />
              </label>
              <label className="grid gap-2 text-sm font-bold text-slate-700">
                استراتيجية التعامل
                <select value={draft.response_strategy} onChange={(event) => setDraft((current) => ({ ...current, response_strategy: event.target.value as ChallengeResponseStrategy }))} className={cn(FIELD_CLASS, "bg-white")}>
                  <option value="mitigate">تخفيف الأثر</option>
                  <option value="avoid">تجنب</option>
                  <option value="transfer">نقل/تصعيد</option>
                  <option value="accept">قبول ومراقبة</option>
                  <option value="monitor">مراقبة</option>
                </select>
              </label>
              <label className="grid gap-2 text-sm font-bold text-slate-700">
                تاريخ المتابعة
                <input type="date" value={draft.due_date} onChange={(event) => setDraft((current) => ({ ...current, due_date: event.target.value }))} className={FIELD_CLASS} />
              </label>
              <label className="grid gap-2 text-sm font-bold text-slate-700 md:col-span-2">
                المؤشر المرتبط
                <select value={draft.kpi_id} onChange={(event) => setDraft((current) => ({ ...current, kpi_id: event.target.value }))} className={cn(FIELD_CLASS, "bg-white")}>
                  <option value="">غير مرتبط</option>
                  {kpiDefinitions.map((kpi) => <option key={kpi.id} value={kpi.id}>{kpi.name} ({kpi.code})</option>)}
                </select>
              </label>
              <label className="grid gap-2 text-sm font-bold text-slate-700 md:col-span-2">
                الوصف
                <textarea value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} rows={3} className={cn(FIELD_CLASS, "resize-none")} />
              </label>
              <label className="grid gap-2 text-sm font-bold text-slate-700 md:col-span-2">
                خطة التعامل
                <textarea value={draft.mitigation_plan} onChange={(event) => setDraft((current) => ({ ...current, mitigation_plan: event.target.value }))} rows={3} className={cn(FIELD_CLASS, "resize-none")} />
              </label>
            </div>
            <div className="flex gap-3 border-t border-slate-100 px-6 py-4">
              <button onClick={() => setShowAdd(false)} className="flex-1 rounded-lg border border-border py-2 text-sm">إلغاء</button>
              <button onClick={handleAdd} disabled={saving} className="flex-1 rounded-lg bg-primary py-2 text-sm text-white disabled:opacity-60">
                {saving ? "جاري الحفظ..." : "إنشاء"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ProjectChallengeCard({ challenge }: { challenge: ProjectChallenge }) {
  const level = getChallengeRiskLevel(challenge);
  return (
    <div className={cn("rounded-lg border bg-white p-4", RISK_LEVEL_COLORS[level])}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <div>
            <div className="mb-1 flex flex-wrap gap-2">
              <span className="rounded-full bg-white/70 px-2 py-0.5 text-xs font-bold">{CHALLENGE_KIND_LABELS[challenge.kind ?? "challenge"]}</span>
              <span className={cn("rounded-full px-2 py-0.5 text-xs font-bold", STATUS_COLORS[challenge.status])}>{getChallengeStatusLabel(challenge.status)}</span>
            </div>
            <h4 className="font-extrabold text-slate-900">{challenge.title}</h4>
            {challenge.description && <p className="mt-1 text-sm text-slate-600">{challenge.description}</p>}
          </div>
        </div>
        <div className="rounded-lg bg-white/80 px-3 py-2 text-center">
          <p className="text-[11px] font-bold text-slate-500">الخطر</p>
          <p className="text-lg font-black text-slate-900">{getChallengeRiskScore(challenge)}</p>
        </div>
      </div>
      <div className="mt-3 grid gap-2 text-xs font-semibold text-slate-600 md:grid-cols-4">
        <span>المستوى: {RISK_LEVEL_LABELS[level]}</span>
        <span>الاحتمالية/الأثر: {challenge.probability_score}/5 - {challenge.impact_score}/5</span>
        <span>{RESPONSE_STRATEGY_LABELS[challenge.response_strategy ?? "mitigate"]}</span>
        <span>{challenge.kpi ? `المؤشر: ${challenge.kpi.code}` : "غير مرتبط بمؤشر"}</span>
      </div>
      <div className="mt-3 flex justify-between border-t border-white/70 pt-3 text-xs text-slate-500">
        <span>{challenge.owner?.full_name ? `المسؤول: ${challenge.owner.full_name}` : "لا يوجد مسؤول"}</span>
        <span>{formatRelativeAr(challenge.updated_at)}</span>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, tone = "default" }: { label: string; value: string | number; tone?: "default" | "success" | "warning" | "danger" }) {
  const toneClass = {
    default: "text-slate-900",
    success: "text-emerald-700",
    warning: "text-amber-700",
    danger: "text-rose-700",
  }[tone];
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-bold text-slate-500">{label}</p>
      <p className={cn("mt-2 text-2xl font-black", toneClass)}>{value}</p>
    </div>
  );
}

async function syncRiskKpi(kpiDefinitions: KpiDefinition[], userId: string) {
  const riskDefinitions = kpiDefinitions.filter((kpi) => kpi.code === "OPS_RISK_COVERAGE");
  if (riskDefinitions.length === 0) return;
  const period = getCurrentKpiPeriod("monthly");
  const records = await fetchChallengeRiskRecords();
  const values = buildChallengeRiskKpiValues(records, riskDefinitions, {
    periodType: period.periodType,
    periodStart: period.periodStart,
    periodEnd: period.periodEnd,
    userId,
  });
  await upsertKpiValues(values);
}

function toRiskNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(1, Math.min(5, Math.round(parsed))) : 3;
}

function emptyToNull(value: string | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed ? trimmed : null;
}
