"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { formatRelativeAr, getChallengeStatusLabel, cn } from "@/lib/utils";
import type { Challenge, Profile } from "@/lib/supabase/types";

interface Props {
  challenges: (Challenge & { owner?: { id: string; full_name: string | null } | null })[];
  profiles: Pick<Profile, "id" | "full_name" | "avatar_url">[];
  projectId: string;
}

const STATUS_COLORS: Record<string, string> = {
  open: "bg-red-100 text-red-700",
  in_progress: "bg-blue-100 text-blue-700",
  resolved: "bg-green-100 text-green-700",
  closed: "bg-gray-100 text-gray-500",
};

export function ChallengesList({ challenges, profiles, projectId }: Props) {
  const router = useRouter();
  const [showAdd, setShowAdd] = useState(false);
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    if (!title.trim()) return;
    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("challenges").insert({
      project_id: projectId, title: title.trim(), status: "open", owner_id: user.id,
    });
    if (error) toast.error("فشل إنشاء التحدي");
    else { toast.success("تم إنشاء التحدي"); setTitle(""); setShowAdd(false); router.refresh(); }
    setSaving(false);
  };

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-3 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary/90 font-medium">
          <Plus size={15} /> تحدٍ جديد
        </button>
      </div>

      {challenges.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">لا توجد تحديات في هذا المشروع</div>
      ) : (
        <div className="space-y-3">
          {challenges.map((c) => (
            <div key={c.id} className="bg-white rounded-xl border border-border p-4">
              <div className="flex items-center justify-between gap-3">
                <h4 className="font-medium text-foreground">{c.title}</h4>
                <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", STATUS_COLORS[c.status])}>
                  {getChallengeStatusLabel(c.status)}
                </span>
              </div>
              {c.description && <p className="text-sm text-muted-foreground mt-1">{c.description}</p>}
              <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                {c.owner && <span>{c.owner.full_name}</span>}
                <span>•</span>
                <span>{formatRelativeAr(c.created_at)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="font-bold mb-4">تحدٍ جديد</h3>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="عنوان التحدي"
              className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 mb-4" />
            <div className="flex gap-3">
              <button onClick={() => setShowAdd(false)} className="flex-1 py-2 border border-border rounded-lg text-sm">إلغاء</button>
              <button onClick={handleAdd} disabled={saving} className="flex-1 py-2 bg-primary text-white rounded-lg text-sm disabled:opacity-60">إنشاء</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
