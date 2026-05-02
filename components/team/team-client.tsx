"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Plus, Search } from "lucide-react";
import { getAvatarUrl, cn } from "@/lib/utils";
import Image from "next/image";
import type { Profile } from "@/lib/supabase/types";

const ROLE_LABELS: Record<string, string> = {
  admin: "مدير النظام",
  project_manager: "مدير مشروع",
  member: "عضو الفريق",
};

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-purple-100 text-purple-700",
  project_manager: "bg-blue-100 text-blue-700",
  member: "bg-gray-100 text-gray-600",
};

interface Props {
  profiles: Profile[];
  currentUser: Profile;
}

export function TeamClient({ profiles, currentUser }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Profile["role"]>("member");
  const [saving, setSaving] = useState(false);

  const filtered = profiles.filter((p) =>
    !search ||
    p.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    p.email?.toLowerCase().includes(search.toLowerCase())
  );

  const handleToggleActive = async (profile: Profile) => {
    if (currentUser.role !== "admin") return;
    const supabase = createClient();
    const { error } = await supabase.from("profiles").update({ active: !profile.active }).eq("id", profile.id);
    if (error) toast.error("فشل تحديث الحالة");
    else { toast.success("تم التحديث"); router.refresh(); }
  };

  const handleChangeRole = async (profileId: string, role: Profile["role"]) => {
    if (currentUser.role !== "admin") return;
    const supabase = createClient();
    const { error } = await supabase.from("profiles").update({ role }).eq("id", profileId);
    if (error) toast.error("فشل تغيير الدور");
    else { toast.success("تم تغيير الدور"); router.refresh(); }
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.auth.admin.inviteUserByEmail(inviteEmail.trim());
    if (error) {
      toast.error("يرجى إرسال رابط الدعوة يدوياً من Supabase Dashboard");
    } else {
      toast.success("تم إرسال الدعوة");
      setShowInvite(false);
      setInviteEmail("");
    }
    setSaving(false);
  };

  return (
    <>
      <div className="section-header">
        <div>
          <h1 className="text-2xl font-bold text-foreground">الفريق</h1>
          <p className="text-muted-foreground text-sm mt-1">{profiles.length} عضو</p>
        </div>
        {currentUser.role === "admin" && (
          <button
            onClick={() => setShowInvite(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 font-medium text-sm"
          >
            <Plus size={16} />
            دعوة عضو
          </button>
        )}
      </div>

      <div className="relative mb-6 max-w-sm">
        <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="البحث بالاسم أو البريد..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pr-9 pl-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((profile) => (
          <div key={profile.id} className={cn("bg-white rounded-xl border p-5 transition-all", profile.active ? "border-border" : "border-border opacity-60")}>
            <div className="flex items-center gap-3 mb-4">
              <Image
                src={profile.avatar_url ?? getAvatarUrl(profile.full_name)}
                alt={profile.full_name ?? ""}
                width={48}
                height={48}
                className="w-12 h-12 rounded-full object-cover"
              />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-foreground line-clamp-1">{profile.full_name ?? "—"}</p>
                <p className="text-xs text-muted-foreground line-clamp-1">{profile.email}</p>
              </div>
              {profile.active ? (
                <span className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" title="نشط" />
              ) : (
                <span className="w-2 h-2 rounded-full bg-gray-300 flex-shrink-0" title="غير نشط" />
              )}
            </div>

            <div className="flex items-center justify-between">
              {currentUser.role === "admin" && profile.id !== currentUser.id ? (
                <select
                  value={profile.role}
                  onChange={(e) => handleChangeRole(profile.id, e.target.value as Profile["role"])}
                  className={cn("text-xs px-2 py-1 rounded-full font-medium border-0 focus:outline-none cursor-pointer", ROLE_COLORS[profile.role])}
                >
                  <option value="admin">مدير النظام</option>
                  <option value="project_manager">مدير مشروع</option>
                  <option value="member">عضو</option>
                </select>
              ) : (
                <span className={cn("text-xs px-2 py-1 rounded-full font-medium", ROLE_COLORS[profile.role])}>
                  {ROLE_LABELS[profile.role]}
                </span>
              )}

              {currentUser.role === "admin" && profile.id !== currentUser.id && (
                <button
                  onClick={() => handleToggleActive(profile)}
                  className={cn("text-xs px-2 py-1 rounded-lg transition-colors", profile.active ? "text-red-600 hover:bg-red-50" : "text-green-600 hover:bg-green-50")}
                >
                  {profile.active ? "تعطيل" : "تفعيل"}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Invite Modal */}
      {showInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold mb-1">دعوة عضو جديد</h2>
            <p className="text-sm text-muted-foreground mb-4">سيتلقى العضو رابط الدعوة عبر البريد الإلكتروني</p>
            <div className="space-y-3">
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="البريد الإلكتروني *"
                className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as Profile["role"])}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none bg-white"
              >
                <option value="member">عضو فريق</option>
                <option value="project_manager">مدير مشروع</option>
                <option value="admin">مدير النظام</option>
              </select>
            </div>
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-3">
              ملاحظة: تأكد من تفعيل Email Auth في Supabase Dashboard لإرسال الدعوات.
            </p>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowInvite(false)} className="flex-1 py-2.5 border border-border rounded-lg text-sm">إلغاء</button>
              <button onClick={handleInvite} disabled={saving} className="flex-1 py-2.5 bg-primary text-white rounded-lg text-sm font-medium disabled:opacity-60">
                {saving ? "جارٍ الإرسال..." : "إرسال الدعوة"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
