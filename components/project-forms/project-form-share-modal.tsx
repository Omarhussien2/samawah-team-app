"use client";

import { useState } from "react";
import { Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/supabase/types";
import type { ProjectFormInstanceWithRelations } from "@/lib/project-forms/types";

interface Props {
  open: boolean;
  instance: ProjectFormInstanceWithRelations | null;
  profiles: Pick<Profile, "id" | "full_name" | "avatar_url">[];
  currentUser: Profile;
  onClose: () => void;
  onShared: () => void;
}

export function ProjectFormShareModal({ open, instance, profiles, currentUser, onClose, onShared }: Props) {
  const [userId, setUserId] = useState("");
  const [permission, setPermission] = useState<"view" | "edit">("view");
  const [saving, setSaving] = useState(false);

  if (!open || !instance) return null;

  const handleShare = async () => {
    if (!userId) {
      toast.error("اختر المستخدم أولًا");
      return;
    }

    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from("project_form_shares").upsert({
      form_instance_id: instance.id,
      shared_with_user_id: userId,
      permission,
      created_by: currentUser.id,
    }, { onConflict: "form_instance_id,shared_with_user_id" });

    if (error) toast.error(`ما نجحت المشاركة: ${error.message}`);
    else {
      toast.success("تمت المشاركة داخليًا");
      setUserId("");
      setPermission("view");
      onShared();
      onClose();
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="font-black text-slate-900">مشاركة النموذج</h2>
            <p className="text-xs text-slate-500">مشاركة داخلية فقط مع مستخدمي المنصة</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <X size={18} />
          </button>
        </div>
        <div className="space-y-4 p-5">
          <div>
            <label className="mb-1.5 block text-xs font-bold text-slate-600">المستخدم</label>
            <select value={userId} onChange={(e) => setUserId(e.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100">
              <option value="">اختر مستخدمًا</option>
              {profiles.map((profile) => (
                <option key={profile.id} value={profile.id}>{profile.full_name ?? profile.id}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold text-slate-600">الصلاحية</label>
            <select value={permission} onChange={(e) => setPermission(e.target.value as "view" | "edit")} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100">
              <option value="view">عرض فقط</option>
              <option value="edit">عرض وتعديل</option>
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="flex-1 rounded-lg border border-slate-200 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50">إلغاء</button>
            <button onClick={handleShare} disabled={saving} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-indigo-600 py-2 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-60">
              {saving && <Loader2 size={15} className="animate-spin" />}
              مشاركة
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
