"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, FileText, ExternalLink } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { formatRelativeAr } from "@/lib/utils";
import type { Document, Profile } from "@/lib/supabase/types";

interface Props {
  documents: (Document & { creator?: { id: string; full_name: string | null } | null })[];
  projectId: string;
  currentUser: Profile;
}

export function DocumentsList({ documents, projectId, currentUser }: Props) {
  const router = useRouter();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ title: "", url: "", type: "أخرى" });
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    if (!form.title) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from("documents").insert({
      title: form.title, project_id: projectId, url: form.url || null, type: form.type, created_by: currentUser.id,
    });
    if (error) toast.error("فشل إنشاء المستند");
    else { toast.success("تم إنشاء المستند"); setShowAdd(false); setForm({ title: "", url: "", type: "أخرى" }); router.refresh(); }
    setSaving(false);
  };

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-3 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary/90 font-medium">
          <Plus size={15} /> مستند جديد
        </button>
      </div>
      {documents.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">لا توجد مستندات في هذا المشروع</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {documents.map((doc) => (
            <div key={doc.id} className="bg-white rounded-xl border border-border p-4 flex items-center gap-3">
              <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
                <FileText size={16} className="text-blue-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-foreground line-clamp-1">{doc.title}</p>
                <p className="text-xs text-muted-foreground">{formatRelativeAr(doc.created_at)}</p>
              </div>
              {doc.url && (
                <a href={doc.url} target="_blank" rel="noreferrer" className="text-primary hover:text-primary/80">
                  <ExternalLink size={15} />
                </a>
              )}
            </div>
          ))}
        </div>
      )}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="font-bold mb-4">مستند جديد</h3>
            <div className="space-y-3">
              <input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} placeholder="العنوان *"
                className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30" />
              <input value={form.url} onChange={(e) => setForm((p) => ({ ...p, url: e.target.value }))} placeholder="الرابط"
                className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={() => setShowAdd(false)} className="flex-1 py-2 border border-border rounded-lg text-sm">إلغاء</button>
              <button onClick={handleAdd} disabled={saving} className="flex-1 py-2 bg-primary text-white rounded-lg text-sm disabled:opacity-60">إضافة</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
