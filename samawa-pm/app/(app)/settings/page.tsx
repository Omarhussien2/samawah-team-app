"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Loader2, Save, User, Bell, Shield } from "lucide-react";
import type { Profile } from "@/lib/supabase/types";

export default function SettingsPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("profile");

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase.from("profiles").select("*").eq("id", user.id).single().then(({ data }) => {
        if (data) { setProfile(data); setFullName(data.full_name ?? ""); }
        setLoading(false);
      });
    });
  }, []);

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from("profiles").update({ full_name: fullName }).eq("id", profile.id);
    if (error) toast.error("فشل الحفظ");
    else { toast.success("تم الحفظ بنجاح"); router.refresh(); }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="page-container flex items-center justify-center h-40">
        <Loader2 className="animate-spin text-primary" size={28} />
      </div>
    );
  }

  const tabs = [
    { key: "profile", label: "الملف الشخصي", icon: User },
    { key: "notifications", label: "الإشعارات", icon: Bell },
    { key: "security", label: "الأمان", icon: Shield },
  ];

  return (
    <div className="page-container max-w-3xl">
      <h1 className="text-2xl font-bold text-foreground mb-6">الإعدادات</h1>

      {/* Tabs */}
      <div className="flex border-b border-border mb-6">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {activeTab === "profile" && (
        <div className="bg-white rounded-xl border border-border p-6 space-y-4">
          <h2 className="font-semibold text-foreground">المعلومات الشخصية</h2>

          <div>
            <label className="block text-sm font-medium mb-1.5">الاسم الكامل</label>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">البريد الإلكتروني</label>
            <input
              value={profile?.email ?? ""}
              disabled
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-muted text-muted-foreground"
            />
            <p className="text-xs text-muted-foreground mt-1">لا يمكن تغيير البريد من هنا</p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">الدور</label>
            <input
              value={profile?.role === "admin" ? "مدير النظام" : profile?.role === "project_manager" ? "مدير مشروع" : "عضو فريق"}
              disabled
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-muted text-muted-foreground"
            />
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-lg hover:bg-primary/90 font-medium text-sm disabled:opacity-60"
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            حفظ التغييرات
          </button>
        </div>
      )}

      {activeTab === "notifications" && (
        <div className="bg-white rounded-xl border border-border p-6">
          <h2 className="font-semibold text-foreground mb-4">إعدادات الإشعارات</h2>
          <div className="space-y-4">
            {[
              { label: "إشعار عند تغيير حالة المهمة", defaultChecked: true },
              { label: "إشعار عند إضافة تحدي", defaultChecked: true },
              { label: "تذكير يومي بالمهام", defaultChecked: true },
              { label: "ملخص أسبوعي", defaultChecked: false },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <span className="text-sm text-foreground">{item.label}</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" defaultChecked={item.defaultChecked} className="sr-only peer" />
                  <div className="w-10 h-5 bg-muted rounded-full peer peer-checked:bg-primary transition-colors" />
                  <div className="absolute right-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform peer-checked:translate-x-[-20px]" />
                </label>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === "security" && (
        <div className="bg-white rounded-xl border border-border p-6">
          <h2 className="font-semibold text-foreground mb-4">الأمان</h2>
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <Shield size={18} className="text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-blue-800 text-sm">تغيير كلمة المرور</p>
                <p className="text-xs text-blue-600 mt-1">لتغيير كلمة المرور، استخدم خيار "نسيت كلمة المرور" في صفحة الدخول</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <Shield size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-amber-800 text-sm">جلسات الدخول</p>
                <p className="text-xs text-amber-600 mt-1">يتم إدارة الجلسات تلقائياً عبر Supabase Auth</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
