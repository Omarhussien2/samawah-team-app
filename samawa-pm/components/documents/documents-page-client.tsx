"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, ExternalLink } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { formatRelativeAr } from "@/lib/utils";
import type { Document, Profile, Project } from "@/lib/supabase/types";

interface Props {
  documents: (Document & {
    creator?: { id: string; full_name: string | null } | null;
    project?: { id: string; name: string } | null;
  })[];
  projects: Pick<Project, "id" | "name">[];
  currentUser: Profile;
}

const DOC_TYPES = ["تقرير", "عقد", "خطة", "تصميم", "مرجع", "أخرى"];

const TYPE_ICONS: Record<string, string> = {
  "تقرير": "📄", "عقد": "📋", "خطة": "🗺️", "تصميم": "🎨", "مرجع": "📚", "أخرى": "📎",
};

export function DocumentsPageClient({ documents, projects, currentUser }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: "", project_id: "", url: "", type: "أخرى" });
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    return documents.filter((d) => {
      if (search && !d.title.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterType && d.type !== filterType) return false;
      return true;
    });
  }, [documents, search, filterType]);

  const handleCreate = async () => {
    if (!form.title || !form.project_id) { toast.error("العنوان والمشروع مطلوبان"); return; }
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from("documents").insert({
      title: form.title, project_id: form.project_id, url: form.url || null, type: form.type,
      created_by: currentUser.id,
    });
    if (error) toast.error("فشل إنشاء المستند");
    else { toast.success("تم إنشاء المستند"); setShowCreate(false); setForm({ title: "", project_id: "", url: "", type: "أخرى" }); router.refresh(); }
    setSaving(false);
  };

  return (
    <>
      <div className="section-header">
        <div>
          <h1 className="text-2xl font-bold text-foreground">المستندات</h1>
          <p className="text-muted-foreground text-sm mt-1">{filtered.length} مستند</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 font-medium text-sm">
          <Plus size={16} /> مستند جديد
        </button>
      </div>

      <div className="flex gap-3 mb-6">
        <div className="relative flex-1 max-w-xs">
          <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input type="text" placeholder="البحث..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pr-9 pl-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30" />
        </div>
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)}
          className="px-3 py-2 text-sm border border-border rounded-lg focus:outline-none bg-white">
          <option value="">كل الأنواع</option>
          {DOC_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <div className="text-5xl mb-4">📂</div>
          <p className="font-medium">لا توجد مستندات</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((doc) => (
            <div key={doc.id} className="bg-white rounded-xl border border-border p-4 hover:shadow-md transition-all hover:border-primary/30">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-xl flex-shrink-0">
                  {TYPE_ICONS[doc.type ?? "أخرى"] ?? "📎"}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-foreground text-sm line-clamp-1">{doc.title}</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">{doc.project?.name ?? "—"}</p>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                <span>{doc.type ?? "—"}</span>
                <span>{formatRelativeAr(doc.created_at)}</span>
              </div>
              {doc.url && (
                <a href={doc.url} target="_blank" rel="noreferrer"
                  className="mt-3 flex items-center gap-1.5 text-xs text-primary hover:underline">
                  <ExternalLink size={12} /> فتح الرابط
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold mb-4">مستند جديد</h2>
            <div className="space-y-3">
              <input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                placeholder="عنوان المستند *" className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30" />
              <select value={form.project_id} onChange={(e) => setForm((p) => ({ ...p, project_id: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none bg-white">
                <option value="">اختر المشروع *</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <select value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none bg-white">
                {DOC_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <input value={form.url} onChange={(e) => setForm((p) => ({ ...p, url: e.target.value }))}
                placeholder="رابط المستند (اختياري)" className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowCreate(false)} className="flex-1 py-2.5 border border-border rounded-lg text-sm">إلغاء</button>
              <button onClick={handleCreate} disabled={saving} className="flex-1 py-2.5 bg-primary text-white rounded-lg text-sm font-medium disabled:opacity-60">
                {saving ? "جارٍ الحفظ..." : "إنشاء"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
