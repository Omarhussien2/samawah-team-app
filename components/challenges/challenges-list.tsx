"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Edit3, Plus, X } from "lucide-react";
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
import { fetchChallengeRiskRecords, fetchRiskRegisterProjects, upsertKpiValues } from "@/lib/queries/kpis";
import { cn, formatRelativeAr, getChallengeStatusLabel } from "@/lib/utils";
import type { Challenge, Database, KpiDefinition, Profile } from "@/lib/supabase/types";

type ProjectChallenge = Challenge & {
  owner?: { id: string; full_name: string | null } | null;
  kpi?: { id: string; name: string; code: string } | null;
};

type ChallengeDraft = {
  title: string;
  description: string;
  status: Challenge["status"];
  kind: ChallengeKind;
  risk_type: string;
  probability_score: string;
  impact_score: string;
  response_strategy: ChallengeResponseStrategy;
  mitigation_plan: string;
  contingency_plan: string;
  due_date: string;
  kpi_id: string;
  resolution: string;
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
  const [editing, setEditing] = useState<ProjectChallenge | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<ChallengeDraft>(() => createDefaultDraft(kpiDefinitions));
  const summary = useMemo(() => summarizeChallenges(challenges), [challenges]);

  const openCreate = () => {
    setEditing(null);
    setDraft(createDefaultDraft(kpiDefinitions));
    setShowForm(true);
  };

  const openEdit = (challenge: ProjectChallenge) => {
    setEditing(challenge);
    setDraft({
      title: challenge.title,
      description: challenge.description ?? "",
      status: challenge.status,
      kind: challenge.kind ?? "challenge",
      risk_type: challenge.risk_type ?? "",
      probability_score: String(challenge.probability_score ?? 3),
      impact_score: String(challenge.impact_score ?? 3),
      response_strategy: challenge.response_strategy ?? "mitigate",
      mitigation_plan: challenge.mitigation_plan ?? "",
      contingency_plan: challenge.contingency_plan ?? "",
      due_date: challenge.due_date ?? "",
      kpi_id: challenge.kpi_id ?? "",
      resolution: challenge.resolution ?? "",
    });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditing(null);
    setDraft(createDefaultDraft(kpiDefinitions));
  };

  const handleSave = async () => {
    if (!draft.title.trim()) {
      toast.error("عنوان التحدي مطلوب");
      return;
    }

    setSaving(true);
    const supabase = createClient();
    const score = calculateRiskScore(Number(draft.probability_score), Number(draft.impact_score));
    const isResolved = draft.status === "resolved" || draft.status === "closed";
    const basePayload: Database["public"]["Tables"]["challenges"]["Update"] = {
      project_id: projectId,
      title: draft.title.trim(),
      description: emptyToNull(draft.description),
      status: draft.status,
      kind: draft.kind,
      risk_type: emptyToNull(draft.risk_type),
      probability_score: toRiskNumber(draft.probability_score),
      impact_score: toRiskNumber(draft.impact_score),
      response_strategy: draft.response_strategy,
      mitigation_plan: emptyToNull(draft.mitigation_plan),
      contingency_plan: emptyToNull(draft.contingency_plan),
      due_date: emptyToNull(draft.due_date),
      kpi_id: emptyToNull(draft.kpi_id),
      resolution: isResolved ? emptyToNull(draft.resolution) : null,
      resolved_at: isResolved ? editing?.resolved_at ?? new Date().toISOString() : null,
      risk_impact: score >= 12 ? "High" : score >= 6 ? "Medium" : "Low",
    };

    const result = editing
      ? await supabase.from("challenges").update(basePayload).eq("id", editing.id)
      : await supabase.from("challenges").insert({
          ...basePayload,
          project_id: projectId,
          owner_id: currentUser.id,
        });

    if (result.error) {
      toast.error(editing ? "تعذر تحديث التحدي" : "فشل إنشاء التحدي");
      setSaving(false);
      return;
    }

    if (currentUser.role !== "member") await syncRiskKpi(kpiDefinitions, currentUser.id);
    toast.success(editing ? "تم تحديث التحدي" : "تم إنشاء التحدي");
    closeForm();
    setSaving(false);
    router.refresh();
  };

  const handleStatusChange = async (challenge: ProjectChallenge, status: Challenge["status"]) => {
    if (challenge.status === status) return;

    const isResolved = status === "resolved" || status === "closed";
    const supabase = createClient();
    const { error } = await supabase
      .from("challenges")
      .update({
        status,
        resolved_at: isResolved ? challenge.resolved_at ?? new Date().toISOString() : null,
        resolution: isResolved ? challenge.resolution : null,
      })
      .eq("id", challenge.id);

    if (error) {
      toast.error("تعذر تحديث حالة التحدي");
      return;
    }

    if (currentUser.role !== "member") await syncRiskKpi(kpiDefinitions, currentUser.id);
    toast.success(status === "resolved" ? "تم تحديد التحدي كمحلول" : "تم تحديث حالة التحدي");
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
        <button onClick={openCreate} className="flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary/90">
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
            <ProjectChallengeCard
              key={challenge.id}
              challenge={challenge}
              onEdit={() => openEdit(challenge)}
              onStatusChange={(status) => handleStatusChange(challenge, status)}
            />
          ))}
        </div>
      )}

      {showForm && (
        <ChallengeFormModal
          draft={draft}
          editing={editing}
          kpiDefinitions={kpiDefinitions}
          saving={saving}
          onChange={(patch) => setDraft((current) => ({ ...current, ...patch }))}
          onClose={closeForm}
          onSave={handleSave}
        />
      )}
    </div>
  );
}

function ProjectChallengeCard({
  challenge,
  onEdit,
  onStatusChange,
}: {
  challenge: ProjectChallenge;
  onEdit: () => void;
  onStatusChange: (status: Challenge["status"]) => void;
}) {
  const level = getChallengeRiskLevel(challenge);
  const isResolved = challenge.status === "resolved" || challenge.status === "closed";

  return (
    <div className={cn("rounded-lg border bg-white p-4", RISK_LEVEL_COLORS[level])}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <div className="min-w-0">
            <div className="mb-1 flex flex-wrap gap-2">
              <span className="rounded-full bg-white/70 px-2 py-0.5 text-xs font-bold">{CHALLENGE_KIND_LABELS[challenge.kind ?? "challenge"]}</span>
              <span className={cn("rounded-full px-2 py-0.5 text-xs font-bold", STATUS_COLORS[challenge.status])}>{getChallengeStatusLabel(challenge.status)}</span>
            </div>
            <h4 className="font-extrabold text-slate-900">{challenge.title}</h4>
            {challenge.description && <p className="mt-1 text-sm text-slate-600">{challenge.description}</p>}
          </div>
        </div>
        <div className="flex shrink-0 items-start gap-2">
          <div className="rounded-lg bg-white/80 px-3 py-2 text-center">
            <p className="text-[11px] font-bold text-slate-500">الخطر</p>
            <p className="text-lg font-black text-slate-900">{getChallengeRiskScore(challenge)}</p>
          </div>
          <button onClick={onEdit} className="rounded-lg border border-white/70 bg-white/80 p-2 text-slate-600 hover:text-slate-900" aria-label="تعديل التحدي">
            <Edit3 size={16} />
          </button>
        </div>
      </div>

      <div className="mt-3 grid gap-2 text-xs font-semibold text-slate-600 md:grid-cols-4">
        <span>المستوى: {RISK_LEVEL_LABELS[level]}</span>
        <span>الاحتمالية/الأثر: {challenge.probability_score}/5 - {challenge.impact_score}/5</span>
        <span>{RESPONSE_STRATEGY_LABELS[challenge.response_strategy ?? "mitigate"]}</span>
        <span>{challenge.kpi ? `المؤشر: ${challenge.kpi.code}` : "غير مرتبط بمؤشر"}</span>
      </div>

      {challenge.mitigation_plan && (
        <div className="mt-3 rounded-lg bg-white/70 p-3 text-sm text-slate-700">
          <span className="font-bold">خطة التعامل: </span>
          {challenge.mitigation_plan}
        </div>
      )}

      {challenge.resolution && isResolved && (
        <div className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
          <span className="font-bold">طريقة الحل: </span>
          {challenge.resolution}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-white/70 pt-3 text-xs text-slate-500">
        <span>{challenge.owner?.full_name ? `المسؤول: ${challenge.owner.full_name}` : "لا يوجد مسؤول"}</span>
        <span>{formatRelativeAr(challenge.updated_at ?? challenge.created_at)}</span>
        <div className="flex flex-wrap items-center gap-2">
          {!isResolved && (
            <button
              type="button"
              onClick={() => onStatusChange("resolved")}
              className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-700"
            >
              <CheckCircle2 size={14} />
              تم الحل
            </button>
          )}
          <select value={challenge.status} onChange={(event) => onStatusChange(event.target.value as Challenge["status"])} className="rounded-md border border-white/70 bg-white px-2 py-1.5 text-xs">
            <option value="open">مفتوح</option>
            <option value="in_progress">قيد المعالجة</option>
            <option value="resolved">تم الحل</option>
            <option value="closed">مغلق</option>
          </select>
        </div>
      </div>
    </div>
  );
}

function ChallengeFormModal({
  draft,
  editing,
  kpiDefinitions,
  saving,
  onChange,
  onClose,
  onSave,
}: {
  draft: ChallengeDraft;
  editing: ProjectChallenge | null;
  kpiDefinitions: KpiDefinition[];
  saving: boolean;
  onChange: (patch: Partial<ChallengeDraft>) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const score = calculateRiskScore(Number(draft.probability_score), Number(draft.impact_score));
  const level = getRiskLevelFromScore(score);
  const showResolution = draft.status === "resolved" || draft.status === "closed";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
          <div>
            <h3 className="font-bold">{editing ? "تعديل تحدي أو مخاطرة" : "بند تحديات ومخاطر جديد"}</h3>
            <p className="mt-1 text-sm text-slate-500">حدّد درجة المخاطر وخطة التعامل، ثم غيّر الحالة عند المعالجة أو الحل.</p>
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="إغلاق">
            <X size={18} />
          </button>
        </div>
        <div className="grid max-h-[62vh] gap-4 overflow-y-auto px-6 py-5 md:grid-cols-2">
          <Field label="العنوان" className="md:col-span-2">
            <input value={draft.title} onChange={(event) => onChange({ title: event.target.value })} className={FIELD_CLASS} />
          </Field>
          <Field label="الحالة">
            <select value={draft.status} onChange={(event) => onChange({ status: event.target.value as Challenge["status"] })} className={cn(FIELD_CLASS, "bg-white")}>
              <option value="open">مفتوح</option>
              <option value="in_progress">قيد المعالجة</option>
              <option value="resolved">تم الحل</option>
              <option value="closed">مغلق</option>
            </select>
          </Field>
          <Field label="النوع">
            <select value={draft.kind} onChange={(event) => onChange({ kind: event.target.value as ChallengeKind })} className={cn(FIELD_CLASS, "bg-white")}>
              <option value="challenge">تحدي</option>
              <option value="risk">مخاطر</option>
              <option value="issue">عائق قائم</option>
            </select>
          </Field>
          <Field label="التصنيف">
            <input value={draft.risk_type} onChange={(event) => onChange({ risk_type: event.target.value })} placeholder="تشغيلي، مالي، جودة..." className={FIELD_CLASS} />
          </Field>
          <Field label="المؤشر المرتبط">
            <select value={draft.kpi_id} onChange={(event) => onChange({ kpi_id: event.target.value })} className={cn(FIELD_CLASS, "bg-white")}>
              <option value="">غير مرتبط</option>
              {kpiDefinitions.map((kpi) => <option key={kpi.id} value={kpi.id}>{kpi.name} ({kpi.code})</option>)}
            </select>
          </Field>
          <Field label="الاحتمالية">
            <input type="number" min={1} max={5} value={draft.probability_score} onChange={(event) => onChange({ probability_score: event.target.value })} className={FIELD_CLASS} />
          </Field>
          <Field label="الأثر">
            <input type="number" min={1} max={5} value={draft.impact_score} onChange={(event) => onChange({ impact_score: event.target.value })} className={FIELD_CLASS} />
          </Field>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 md:col-span-2">
            <p className="text-xs font-bold text-slate-500">درجة المخاطر المحسوبة</p>
            <p className="mt-1 text-xl font-black text-slate-900">{score} - {RISK_LEVEL_LABELS[level]}</p>
          </div>
          <Field label="استراتيجية التعامل">
            <select value={draft.response_strategy} onChange={(event) => onChange({ response_strategy: event.target.value as ChallengeResponseStrategy })} className={cn(FIELD_CLASS, "bg-white")}>
              <option value="mitigate">تخفيف الأثر</option>
              <option value="avoid">تجنب</option>
              <option value="transfer">نقل/تصعيد</option>
              <option value="accept">قبول ومراقبة</option>
              <option value="monitor">مراقبة</option>
            </select>
          </Field>
          <Field label="تاريخ المتابعة">
            <input type="date" value={draft.due_date} onChange={(event) => onChange({ due_date: event.target.value })} className={FIELD_CLASS} />
          </Field>
          <Field label="الوصف" className="md:col-span-2">
            <textarea value={draft.description} onChange={(event) => onChange({ description: event.target.value })} rows={3} className={cn(FIELD_CLASS, "resize-none")} />
          </Field>
          <Field label="خطة التعامل" className="md:col-span-2">
            <textarea value={draft.mitigation_plan} onChange={(event) => onChange({ mitigation_plan: event.target.value })} rows={3} className={cn(FIELD_CLASS, "resize-none")} />
          </Field>
          <Field label="خطة بديلة / تصعيد" className="md:col-span-2">
            <textarea value={draft.contingency_plan} onChange={(event) => onChange({ contingency_plan: event.target.value })} rows={2} className={cn(FIELD_CLASS, "resize-none")} />
          </Field>
          {showResolution && (
            <Field label="كيف تم الحل؟" className="md:col-span-2">
              <textarea value={draft.resolution} onChange={(event) => onChange({ resolution: event.target.value })} rows={2} className={cn(FIELD_CLASS, "resize-none")} />
            </Field>
          )}
        </div>
        <div className="flex gap-3 border-t border-slate-100 px-6 py-4">
          <button onClick={onClose} className="flex-1 rounded-lg border border-border py-2 text-sm">إلغاء</button>
          <button onClick={onSave} disabled={saving} className="flex-1 rounded-lg bg-primary py-2 text-sm text-white disabled:opacity-60">
            {saving ? "جاري الحفظ..." : editing ? "حفظ التعديل" : "إنشاء"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={cn("grid gap-2 text-sm font-bold text-slate-700", className)}>
      {label}
      {children}
    </label>
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
  const [records, projects] = await Promise.all([
    fetchChallengeRiskRecords(),
    fetchRiskRegisterProjects(),
  ]);
  const values = buildChallengeRiskKpiValues(records, riskDefinitions, {
    periodType: period.periodType,
    periodStart: period.periodStart,
    periodEnd: period.periodEnd,
    userId,
  }, projects);
  await upsertKpiValues(values);
}

function createDefaultDraft(kpiDefinitions: KpiDefinition[]): ChallengeDraft {
  return {
    title: "",
    description: "",
    status: "open",
    kind: "challenge",
    risk_type: "",
    probability_score: "3",
    impact_score: "3",
    response_strategy: "mitigate",
    mitigation_plan: "",
    contingency_plan: "",
    due_date: "",
    kpi_id: kpiDefinitions.find((kpi) => kpi.code === "OPS_RISK_COVERAGE")?.id ?? "",
    resolution: "",
  };
}

function toRiskNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(1, Math.min(5, Math.round(parsed))) : 3;
}

function emptyToNull(value: string | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed ? trimmed : null;
}

function getRiskLevelFromScore(score: number) {
  if (score >= 20) return "critical";
  if (score >= 12) return "high";
  if (score >= 6) return "medium";
  return "low";
}
