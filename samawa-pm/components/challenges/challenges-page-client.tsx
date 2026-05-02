"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { formatRelativeAr, getChallengeStatusLabel, cn } from "@/lib/utils";
import type { Challenge, Profile, Project } from "@/lib/supabase/types";

interface Props {
  challenges: (Challenge & {
    owner?: { id: string; full_name: string | null } | null;
    project?: { id: string; name: string } | null;
    task?: { id: string; title: string } | null;
  })[];
  profiles: Pick<Profile, "id" | "full_name" | "avatar_url">[];
  projects: Pick<Project, "id" | "name">[];
  currentUser: Profile;
}

const RISK_COLORS: Record<string, string> = {
  High: "bg-red-50 text-red-700 border-red-200",
  Medium: "bg-amber-50 text-amber-700 border-amber-200",
  Low: "bg-green-50 text-green-700 border-green-200",
};

const STATUS_COLORS: Record<string, string> = {
  open: "bg-red-100 text-red-700",
  in_progress: "bg-blue-100 text-blue-700",
  resolved: "bg-green-100 text-green-700",
  closed: "bg-gray-100 text-gray-500",
};

export function ChallengesPageClient({ challenges, profiles, projects, currentUser }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newChallenge, setNewChallenge] = useState({ title: "", project_id: "", description: "", risk_impact: "Medium", risk_type: "" });
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    return challenges.filter((c) => {
      if (search && !c.title.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterStatus && c.status !== filterStatus) return false;
      return true;
    });
  }, [challenges, search, filterStatus]);

  const handleCreate = async () => {
    if (!newChallenge.title || !newChallenge.project_id) {
      toast.error("العنوان والمشروع مطلوبان");
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from("challenges").insert({
      title: newChallenge.title,
      project_id: newChallenge.project_id,
      description: newChallenge.description || null,
      risk_impact: newChallenge.risk_impact || null,
      risk_type: newChallenge.risk_type || null,
      owner_id: currentUser.id,
      status: "open",
    });
    if (error) toast.error("فشل إنشاء التحدي");
    else {
      toast.success("تم إنشاء التحدي");
      setShowCreate(false);
      setNewChallenge({ title: "", project_id: "", description: "", risk_impact: "Medium", risk_type: "" });
      router.refresh();
    }
    setSaving(false);
  };

  return (
    <>
      <div className="section-header">
        <div>
          <h1 className="text-2xl font-bold text-foreground">التحديات</h1>
          <p className="text-muted-foreground text-sm mt-1">{filtered.length} تحدٍ</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 font-medium text-sm">
          <Plus size={16} />
          تحدٍ جديد
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6">
        <div className="relative flex-1 max-w-xs">
          <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input type="text" placeholder="البحث..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pr-9 pl-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30" />
        </div>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white">
          <option value="">كل الحالات</option>
          <option value="open">مفتوح</option>
          <option value="in_progress">قيد المعالجة</option>
          <option value="resolved">تم الحل</option>
          <option value="closed">مغلق</option>
        </select>
      </div>

      {/* Challenges Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <div className="text-5xl mb-4">🎯</div>
          <p className="font-medium">لا توجد تحديات</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((c) => (
            <div key={c.id} className={cn("bg-white rounded-xl border p-5", RISK_COLORS[c.risk_impact ?? "Medium"] ?? "border-border")}>
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle size={16} className="text-amber-500 mt-0.5 flex-shrink-0" />
                  <h3 className="font-semibold text-foreground text-sm">{c.title}</h3>
                </div>
                <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0", STATUS_COLORS[c.status] ?? "bg-gray-100")}>
                  {getChallengeStatusLabel(c.status)}
                </span>
              </div>
              {c.description && <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{c.description}</p>}
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex flex-wrap gap-2">
                  {c.project && <span className="bg-accent px-2 py-0.5 rounded-full">{c.project.name}</span>}
                  {c.risk_type && <span className="bg-accent px-2 py-0.5 rounded-full">{c.risk_type}</span>}
                </div>
                <span>{formatRelativeAr(c.created_at)}</span>
              </div>
              {c.owner && <p className="text-xs text-muted-foreground mt-2">المسؤول: {c.owner.full_name}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold mb-4">تحدٍ جديد</h2>
            <div className="space-y-3">
              <input value={newChallenge.title} onChange={(e) => setNewChallenge((p) => ({ ...p, title: e.target.value }))}
                placeholder="عنوان التحدي *" className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30" />
              <select value={newChallenge.project_id} onChange={(e) => setNewChallenge((p) => ({ ...p, project_id: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white">
                <option value="">اختر المشروع *</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <textarea value={newChallenge.description} onChange={(e) => setNewChallenge((p) => ({ ...p, description: e.target.value }))}
                placeholder="وصف التحدي" rows={3} className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
              <div className="grid grid-cols-2 gap-3">
                <select value={newChallenge.risk_impact} onChange={(e) => setNewChallenge((p) => ({ ...p, risk_impact: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none bg-white">
                  <option value="Low">تأثير منخفض</option>
                  <option value="Medium">تأثير متوسط</option>
                  <option value="High">تأثير عالٍ</option>
                </select>
                <input value={newChallenge.risk_type} onChange={(e) => setNewChallenge((p) => ({ ...p, risk_type: e.target.value }))}
                  placeholder="نوع الخطر" className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowCreate(false)} className="flex-1 py-2.5 border border-border rounded-lg text-sm hover:bg-accent">إلغاء</button>
              <button onClick={handleCreate} disabled={saving} className="flex-1 py-2.5 bg-primary text-white rounded-lg text-sm hover:bg-primary/90 font-medium disabled:opacity-60">
                {saving ? "جارٍ الحفظ..." : "إنشاء"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
