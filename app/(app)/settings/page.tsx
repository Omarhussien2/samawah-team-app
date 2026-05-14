"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Loader2, Save, Shield, User } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { NotificationPreference, Profile } from "@/lib/supabase/types";

const defaultPreferences: NotificationPreference = {
  user_id: "",
  in_app_enabled: true,
  email_enabled: true,
  important_email_only: true,
  daily_digest_enabled: true,
  weekly_digest_enabled: false,
  quiet_hours_start: null,
  quiet_hours_end: null,
  timezone: "Asia/Riyadh",
  created_at: "",
  updated_at: "",
};

export default function SettingsPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [preferences, setPreferences] = useState<NotificationPreference | null>(null);
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingNotifications, setSavingNotifications] = useState(false);
  const [activeTab, setActiveTab] = useState("profile");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setActiveTab(params.get("tab") ?? "profile");

    const supabase = createClient();

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;

      Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).single(),
        fetch("/api/notification-preferences").then((res) => (res.ok ? res.json() : null)),
      ]).then(([profileResult, preferenceResult]) => {
        const profileData = profileResult.data as Profile | null;
        if (profileData) {
          setProfile(profileData);
          setFullName(profileData.full_name ?? "");
        }
        setPreferences(preferenceResult?.preferences ?? { ...defaultPreferences, user_id: user.id });
        setLoading(false);
      });
    });
  }, []);

  const handleSaveProfile = async () => {
    if (!profile) return;
    setSavingProfile(true);
    const supabase = createClient();
    const { error } = await supabase.from("profiles").update({ full_name: fullName }).eq("id", profile.id);
    if (error) toast.error("فشل الحفظ");
    else {
      toast.success("تم الحفظ بنجاح");
      router.refresh();
    }
    setSavingProfile(false);
  };

  const updatePreference = <K extends keyof NotificationPreference>(key: K, value: NotificationPreference[K]) => {
    setPreferences((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const handleSaveNotifications = async () => {
    if (!preferences) return;
    setSavingNotifications(true);
    try {
      const res = await fetch("/api/notification-preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          in_app_enabled: preferences.in_app_enabled,
          email_enabled: preferences.email_enabled,
          important_email_only: preferences.important_email_only,
          daily_digest_enabled: preferences.daily_digest_enabled,
          weekly_digest_enabled: preferences.weekly_digest_enabled,
          quiet_hours_start: preferences.quiet_hours_start,
          quiet_hours_end: preferences.quiet_hours_end,
          timezone: preferences.timezone,
        }),
      });
      if (!res.ok) throw new Error("failed");
      const data = await res.json();
      setPreferences(data.preferences);
      toast.success("تم حفظ إعدادات الإشعارات");
    } catch {
      toast.error("فشل حفظ إعدادات الإشعارات");
    } finally {
      setSavingNotifications(false);
    }
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
              onChange={(event) => setFullName(event.target.value)}
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
            onClick={handleSaveProfile}
            disabled={savingProfile}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-lg hover:bg-primary/90 font-medium text-sm disabled:opacity-60"
          >
            {savingProfile ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            حفظ التغييرات
          </button>
        </div>
      )}

      {activeTab === "notifications" && (
        <div className="bg-white rounded-xl border border-border p-6">
          <h2 className="font-semibold text-foreground mb-4">إعدادات الإشعارات</h2>
          {!preferences ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={20} className="animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-5">
              {[
                { key: "in_app_enabled", label: "إشعارات داخل المنصة", helper: "القناة الأساسية للتنبيهات والمتابعة." },
                { key: "email_enabled", label: "البريد الإلكتروني", helper: "يستخدم للحالات المهمة فقط حسب الإعداد التالي." },
                { key: "important_email_only", label: "إرسال البريد عند المهم فقط", helper: "يقلل الضوضاء ويمنع رسائل غير ضرورية." },
                { key: "daily_digest_enabled", label: "الملخص اليومي", helper: "ملخص يومي عند وجود متابعة مهمة." },
                { key: "weekly_digest_enabled", label: "الملخص الأسبوعي", helper: "مؤجل افتراضيًا ويمكن تشغيله لاحقًا." },
              ].map((item) => (
                <div key={item.key} className="flex items-center justify-between gap-4 py-3 border-b border-border last:border-0">
                  <div>
                    <p className="text-sm font-medium text-foreground">{item.label}</p>
                    <p className="text-xs text-muted-foreground mt-1">{item.helper}</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                    <input
                      type="checkbox"
                      checked={Boolean(preferences[item.key as keyof NotificationPreference])}
                      onChange={(event) =>
                        updatePreference(
                          item.key as keyof NotificationPreference,
                          event.target.checked as never
                        )
                      }
                      className="sr-only peer"
                    />
                    <div className="w-10 h-5 bg-muted rounded-full peer peer-checked:bg-primary transition-colors" />
                    <div className="absolute right-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform peer-checked:translate-x-[-20px]" />
                  </label>
                </div>
              ))}

              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="block text-sm font-medium mb-1.5">بداية الهدوء</label>
                  <input
                    type="time"
                    value={preferences.quiet_hours_start ?? ""}
                    onChange={(event) => updatePreference("quiet_hours_start", event.target.value || null)}
                    className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">نهاية الهدوء</label>
                  <input
                    type="time"
                    value={preferences.quiet_hours_end ?? ""}
                    onChange={(event) => updatePreference("quiet_hours_end", event.target.value || null)}
                    className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">المنطقة الزمنية</label>
                  <select
                    value={preferences.timezone}
                    onChange={(event) => updatePreference("timezone", event.target.value)}
                    className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    <option value="Asia/Riyadh">الرياض</option>
                    <option value="Asia/Dubai">دبي</option>
                    <option value="Africa/Cairo">القاهرة</option>
                  </select>
                </div>
              </div>

              <button
                onClick={handleSaveNotifications}
                disabled={savingNotifications}
                className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-lg hover:bg-primary/90 font-medium text-sm disabled:opacity-60"
              >
                {savingNotifications ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                حفظ إعدادات الإشعارات
              </button>
            </div>
          )}
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
                <p className="text-xs text-blue-600 mt-1">لتغيير كلمة المرور، استخدم خيار نسيت كلمة المرور في صفحة الدخول</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <Shield size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-amber-800 text-sm">جلسات الدخول</p>
                <p className="text-xs text-amber-600 mt-1">تتم إدارة الجلسات تلقائيًا عبر Supabase Auth</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
