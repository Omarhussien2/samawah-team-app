"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Edit3, Plus, Search, ShieldAlert, X } from "lucide-react";
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
import {
  PROJECT_TYPE_OPTIONS,
  cn,
  formatRelativeAr,
  getChallengeStatusLabel,
  getProjectType,
  getProjectTypeBadgeClass,
  getProjectTypeLabel,
} from "@/lib/utils";
import { createSearchMatcher } from "@/lib/utils/search";
import type { Challenge, Database, KpiDefinition, Profile, Project } from "@/lib/supabase/types";

type ChallengeWithRelations = Challenge & {
  owner?: { id: string; full_name: string | null } | null;
  project?: Pick<Project, "id" | "name"> & Partial<Pick<Project, "project_type">> | null;
  task?: { id: string; title: string } | null;
  kpi?: { id: string; name: string; code: string } | null;
};

type ChallengeDraft = {
  title: string;
  project_id: string;
  description: string;
  kind: ChallengeKind;
  risk_type: string;
  probability_score: string;
  impact_score: string;
  response_strategy: ChallengeResponseStrategy;
  mitigation_plan: string;
  contingency_plan: string;
  due_date: string;
  kpi_id: string;
};

interface Props {
  challenges: ChallengeWithRelations[];
  profiles: Pick<Profile, "id" | "full_name" | "avatar_url">[];
  projects: (Pick<Project, "id" | "name"> & Partial<Pick<Project, "project_type">>)[];
  kpiDefinitions: KpiDefinition[];
  currentUser: Profile;
}

const STATUS_COLORS: Record<Challenge["status"], string> = {
  open: "bg-rose-100 text-rose-700",
  in_progress: "bg-blue-100 text-blue-700",
  resolved: "bg-emerald-100 text-emerald-700",
  closed: "bg-slate-100 text-slate-500",
};

const RISK_LEVEL_COLORS = {
  low: "border-emerald-200 bg-emerald-50 text-emerald-700",
  medium: "border-amber-200 bg-amber-50 text-amber-700",
  high: "border-orange-200 bg-orange-50 text-orange-700",
  critical: "border-rose-200 bg-rose-50 text-rose-700",
};

const DEFAULT_DRAFT: ChallengeDraft = {
  title: "",
  project_id: "",
  description: "",
  kind: "challenge",
  risk_type: "",
  probability_score: "3",
  impact_score: "3",
  response_strategy: "mitigate",
  mitigation_plan: "",
  contingency_plan: "",
  due_date: "",
  kpi_id: "",
};

const FIELD_CLASS = "w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30";

export function ChallengesPageClient({ challenges, profiles: _profiles, projects, kpiDefinitions, currentUser }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterLevel, setFilterLevel] = useState("");
  const [filterProjectType, setFilterProjectType] = useState("");
  const [filterProject, setFilterProject] = useState("");
  const [editing, setEditing] = useState<ChallengeWithRelations | null>(null);
  const [draft, setDraft] = useState<ChallengeDraft>(DEFAULT_DRAFT);
  const [saving, setSaving] = useState(false);

  const visibleProjects = useMemo(
    () => projects.filter((project) => !filterProjectType || getProjectType(project) === filterProjectType),
    [filterProjectType, projects]
  );

  const filtered = useMemo(() => {
    const matchesSearch = createSearchMatcher(search);

    return challenges.filter((challenge) => {
      if (
        !matchesSearch([
          challenge.title,
          challenge.description,
          challenge.project?.name,
          getProjectTypeLabel(getProjectType(challenge.project)),
          challenge.task?.title,
          challenge.owner?.full_name,
          challenge.status,
          getChallengeStatusLabel(challenge.status),
          challenge.risk_type,
          challenge.mitigation_plan,
          challenge.contingency_plan,
          challenge.kpi?.name,
          challenge.kpi?.code,
        ])
      ) {
        return false;
      }
      if (filterStatus && challenge.status !== filterStatus) return false;
      if (filterLevel && getChallengeRiskLevel(challenge) !== filterLevel) return false;
      if (filterProjectType && getProjectType(challenge.project) !== filterProjectType) return false;
      if (filterProject && challenge.project_id !== filterProject) return false;
      return true;
    });
  }, [challenges, filterLevel, filterProject, filterProjectType, filterStatus, search]);

  const summary = useMemo(() => summarizeChallenges(filtered), [filtered]);

  const openCreate = () => {
    setEditing(null);
    setDraft({ ...DEFAULT_DRAFT, project_id: visibleProjects[0]?.id ?? "", kpi_id: kpiDefinitions.find((kpi) => kpi.code === "OPS_RISK_COVERAGE")?.id ?? "" });
  };

  const openEdit = (challenge: ChallengeWithRelations) => {
    setEditing(challenge);
    setDraft({
      title: challenge.title,
      project_id: challenge.project_id,
      description: challenge.description ?? "",
      kind: challenge.kind ?? "challenge",
      risk_type: challenge.risk_type ?? "",
      probability_score: String(challenge.probability_score ?? 3),
      impact_score: String(challenge.impact_score ?? 3),
      response_strategy: challenge.response_strategy ?? "mitigate",
      mitigation_plan: challenge.mitigation_plan ?? "",
      contingency_plan: challenge.contingency_plan ?? "",
      due_date: challenge.due_date ?? "",
      kpi_id: challenge.kpi_id ?? "",
    });
  };

  const closeModal = () => {
    setEditing(null);
    setDraft(DEFAULT_DRAFT);
  };

  const handleSave = async () => {
    if (!draft.title.trim() || !draft.project_id) {
      toast.error("العنوان والمشروع مطلوبان");
      return;
    }

    setSaving(true);
    const supabase = createClient();
    const payload: Database["public"]["Tables"]["challenges"]["Insert"] = {
      title: draft.title.trim(),
      project_id: draft.project_id,
      description: emptyToNull(draft.description),
      kind: draft.kind,
      risk_type: emptyToNull(draft.risk_type),
      probability_score: toRiskNumber(draft.probability_score),
      impact_score: toRiskNumber(draft.impact_score),
      response_strategy: draft.response_strategy,
      mitigation_plan: emptyToNull(draft.mitigation_plan),
      contingency_plan: emptyToNull(draft.contingency_plan),
      due_date: emptyToNull(draft.due_date),
      kpi_id: emptyToNull(draft.kpi_id),
      risk_impact: riskImpactFromScore(calculateRiskScore(Number(draft.probability_score), Number(draft.impact_score))),
      owner_id: editing?.owner_id ?? currentUser.id,
      status: editing?.status ?? "open",
    };

    const result = editing
      ? await supabase.from("challenges").update(payload).eq("id", editing.id)
      : await supabase.from("challenges").insert(payload);

    if (result.error) {
      toast.error(editing ? "تعذر تحديث التحدي" : "تعذر إنشاء التحدي");
      setSaving(false);
      return;
    }

    if (currentUser.role !== "member") await syncRiskKpi(kpiDefinitions, currentUser.id);
    toast.success(editing ? "تم تحديث التحدي" : "تم إنشاء التحدي");
    closeModal();
    router.refresh();
    setSaving(false);
  };

  const handleStatusChange = async (challenge: ChallengeWithRelations, status: Challenge["status"]) => {
    const supabase = createClient();
    const { error } = await supabase
      .from("challenges")
      .update({
        status,
        resolved_at: status === "resolved" || status === "closed" ? new Date().toISOString() : null,
      })
      .eq("id", challenge.id);

    if (error) {
      toast.error("تعذر تحديث حالة التحدي");
      return;
    }
    if (currentUser.role !== "member") await syncRiskKpi(kpiDefinitions, currentUser.id);
    toast.success("تم تحديث حالة التحدي");
    router.refresh();
  };

  return (
    <>
      <div className="section-header">
        <div>
          <h1 className="text-2xl font-bold text-foreground">التحديات والمخاطر</h1>
          <p className="mt-1 text-sm text-muted-foreground">سجل تشغيلي مرتبط بمؤشرات أداء المشروع</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90">
          <Plus size={16} />
          بند جديد
        </button>
      </div>

      <div className="mb-6 grid gap-3 md:grid-cols-4">
        <MetricCard label="إجمالي البنود" value={summary.total} />
        <MetricCard label="مفتوحة" value={summary.open} />
        <MetricCard label="حرجة" value={summary.critical} tone={summary.critical > 0 ? "danger" : "default"} />
        <MetricCard label="تغطية المخاطر" value={`${summary.riskCoverage}%`} tone={summary.riskCoverage < 80 ? "warning" : "success"} />
      </div>

      <div className="mb-6 flex flex-col gap-3 lg:flex-row">
        <div className="relative max-w-sm flex-1">
          <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="البحث..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full rounded-lg border border-border py-2 pl-9 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          {search && (
            <button
              type="button"
              aria-label="مسح البحث"
              onClick={() => setSearch("")}
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition hover:bg-accent hover:text-foreground"
            >
              <X size={14} />
            </button>
          )}
        </div>
        <select value={filterStatus} onChange={(event) => setFilterStatus(event.target.value)} className="rounded-lg border border-border bg-white px-3 py-2 text-sm">
          <option value="">كل الحالات</option>
          <option value="open">مفتوح</option>
          <option value="in_progress">قيد المعالجة</option>
          <option value="resolved">تم الحل</option>
          <option value="closed">مغلق</option>
        </select>
        <select value={filterLevel} onChange={(event) => setFilterLevel(event.target.value)} className="rounded-lg border border-border bg-white px-3 py-2 text-sm">
          <option value="">كل مستويات المخاطر</option>
          <option value="critical">حرج</option>
          <option value="high">مرتفع</option>
          <option value="medium">متوسط</option>
          <option value="low">منخفض</option>
        </select>
        <select
          value={filterProjectType}
          onChange={(event) => {
            setFilterProjectType(event.target.value);
            setFilterProject("");
          }}
          className="rounded-lg border border-border bg-white px-3 py-2 text-sm"
        >
          <option value="">كل أنواع المشاريع</option>
          {PROJECT_TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        <select value={filterProject} onChange={(event) => setFilterProject(event.target.value)} className="rounded-lg border border-border bg-white px-3 py-2 text-sm">
          <option value="">كل المشاريع</option>
          {visibleProjects.map((project) => (
            <option key={project.id} value={project.id}>{project.name}</option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="py-20 text-center text-muted-foreground">
          <ShieldAlert size={44} className="mx-auto mb-4 text-slate-300" />
          <p className="font-medium">لا توجد تحديات أو مخاطر مطابقة</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {filtered.map((challenge) => (
            <ChallengeCard
              key={challenge.id}
              challenge={challenge}
              onEdit={() => openEdit(challenge)}
              onStatusChange={(status) => handleStatusChange(challenge, status)}
            />
          ))}
        </div>
      )}

      {(editing || draft !== DEFAULT_DRAFT) && (
        <ChallengeFormModal
          draft={draft}
          editing={editing}
          projects={projects}
          kpiDefinitions={kpiDefinitions}
          saving={saving}
          onChange={(patch) => setDraft((current) => ({ ...current, ...patch }))}
          onClose={closeModal}
          onSave={handleSave}
        />
      )}
    </>
  );
}

function ChallengeCard({
  challenge,
  onEdit,
  onStatusChange,
}: {
  challenge: ChallengeWithRelations;
  onEdit: () => void;
  onStatusChange: (status: Challenge["status"]) => void;
}) {
  const level = getChallengeRiskLevel(challenge);
  const score = getChallengeRiskScore(challenge);

  return (
    <article className={cn("rounded-lg border bg-white p-5 shadow-sm", RISK_LEVEL_COLORS[level])}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-white/70 px-2 py-0.5 text-xs font-bold">{CHALLENGE_KIND_LABELS[challenge.kind ?? "challenge"]}</span>
            <span className={cn("rounded-full px-2 py-0.5 text-xs font-bold", STATUS_COLORS[challenge.status])}>
              {getChallengeStatusLabel(challenge.status)}
            </span>
            <span className={cn("rounded-full border px-2 py-0.5 text-xs font-bold", getProjectTypeBadgeClass(getProjectType(challenge.project)))}>
              {getProjectTypeLabel(getProjectType(challenge.project))}
            </span>
          </div>
          <h3 className="text-base font-extrabold text-slate-900">{challenge.title}</h3>
          {challenge.description && <p className="mt-2 line-clamp-2 text-sm text-slate-600">{challenge.description}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <div className="rounded-lg bg-white/80 px-3 py-2 text-center shadow-sm">
            <p className="text-[11px] font-bold text-slate-500">درجة الخطر</p>
            <p className="text-lg font-black text-slate-900">{score}</p>
          </div>
          <button onClick={onEdit} className="rounded-lg border border-white/70 bg-white/80 p-2 text-slate-600 hover:text-slate-900" aria-label="تعديل">
            <Edit3 size={16} />
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 text-xs text-slate-600 sm:grid-cols-2">
        <Info label="المشروع" value={challenge.project?.name ?? "غير محدد"} />
        <Info label="مستوى المخاطر" value={RISK_LEVEL_LABELS[level]} />
        <Info label="الاحتمالية / الأثر" value={`${challenge.probability_score}/5 - ${challenge.impact_score}/5`} />
        <Info label="استراتيجية التعامل" value={RESPONSE_STRATEGY_LABELS[challenge.response_strategy ?? "mitigate"]} />
        <Info label="المؤشر المرتبط" value={challenge.kpi ? `${challenge.kpi.name} (${challenge.kpi.code})` : "غير مرتبط"} />
        <Info label="تاريخ المتابعة" value={challenge.due_date ? new Date(challenge.due_date).toLocaleDateString("ar-SA") : "غير محدد"} />
      </div>

      {challenge.mitigation_plan && (
        <div className="mt-4 rounded-lg bg-white/70 p-3 text-sm text-slate-700">
          <span className="font-bold">خطة التعامل: </span>
          {challenge.mitigation_plan}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/70 pt-3 text-xs text-slate-500">
        <span>{challenge.owner?.full_name ? `المسؤول: ${challenge.owner.full_name}` : "لا يوجد مسؤول"}</span>
        <span>{formatRelativeAr(challenge.updated_at ?? challenge.created_at)}</span>
        <select value={challenge.status} onChange={(event) => onStatusChange(event.target.value as Challenge["status"])} className="rounded-md border border-white/70 bg-white px-2 py-1 text-xs">
          <option value="open">مفتوح</option>
          <option value="in_progress">قيد المعالجة</option>
          <option value="resolved">تم الحل</option>
          <option value="closed">مغلق</option>
        </select>
      </div>
    </article>
  );
}

function ChallengeFormModal({
  draft,
  editing,
  projects,
  kpiDefinitions,
  saving,
  onChange,
  onClose,
  onSave,
}: {
  draft: ChallengeDraft;
  editing: ChallengeWithRelations | null;
  projects: (Pick<Project, "id" | "name"> & Partial<Pick<Project, "project_type">>)[];
  kpiDefinitions: KpiDefinition[];
  saving: boolean;
  onChange: (patch: Partial<ChallengeDraft>) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const score = calculateRiskScore(Number(draft.probability_score), Number(draft.impact_score));
  const level = RISK_LEVEL_LABELS[getRiskLevelFromScore(score)];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="border-b border-slate-100 px-6 py-5">
          <h2 className="text-lg font-bold">{editing ? "تعديل تحدي أو مخاطرة" : "بند تحديات ومخاطر جديد"}</h2>
          <p className="mt-1 text-sm text-slate-500">اربط البند بالمشروع والمؤشر، ثم حدد الاحتمالية والأثر وخطة التعامل.</p>
        </div>

        <div className="grid max-h-[62vh] gap-4 overflow-y-auto px-6 py-5 md:grid-cols-2">
          <Field label="العنوان" className="md:col-span-2">
            <input value={draft.title} onChange={(event) => onChange({ title: event.target.value })} className={FIELD_CLASS} />
          </Field>
          <Field label="المشروع">
            <select value={draft.project_id} onChange={(event) => onChange({ project_id: event.target.value })} className={cn(FIELD_CLASS, "bg-white")}>
              <option value="">اختر المشروع</option>
              {projects.map((project) => <option key={project.id} value={project.id}>{project.name} - {getProjectTypeLabel(getProjectType(project))}</option>)}
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
            <p className="mt-1 text-xl font-black text-slate-900">{score} - {level}</p>
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
        </div>

        <div className="flex gap-3 border-t border-slate-100 px-6 py-4">
          <button onClick={onClose} className="flex-1 rounded-lg border border-border py-2.5 text-sm hover:bg-accent">إلغاء</button>
          <button onClick={onSave} disabled={saving} className="flex-1 rounded-lg bg-primary py-2.5 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-60">
            {saving ? "جاري الحفظ..." : "حفظ"}
          </button>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, tone = "default" }: { label: string; value: string | number; tone?: "default" | "success" | "warning" | "danger" }) {
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

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-bold text-slate-500">{label}</p>
      <p className="mt-0.5 font-semibold text-slate-800">{value}</p>
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

function riskImpactFromScore(score: number) {
  if (score >= 12) return "High";
  if (score >= 6) return "Medium";
  return "Low";
}

function getRiskLevelFromScore(score: number) {
  if (score >= 20) return "critical";
  if (score >= 12) return "high";
  if (score >= 6) return "medium";
  return "low";
}

function emptyToNull(value: string | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed ? trimmed : null;
}
