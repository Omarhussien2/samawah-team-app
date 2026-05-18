import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth/get-user";
import { formatDateShort } from "@/lib/utils";
import { Zap, Clock, CheckCircle, XCircle, AlertCircle } from "lucide-react";

export default async function AutomationsPage() {
  await getUser();
  const supabase = await createClient();

  const { data: logs } = await supabase
    .from("automation_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  const automations = [
    {
      name: "ملخص يومي",
      description: "يرسل ملخصاً يومياً لمديري المشاريع في الساعة 8 صباحًا",
      endpoint: "/api/cron/daily-digest",
      schedule: "يومياً 8:00 ص",
      icon: "📋",
    },
    {
      name: "تذكير المهام",
      description: "يُرسل تنبيهات للمهام المتأخرة فقط",
      endpoint: "/api/cron/task-reminders",
      schedule: "الأحد والثلاثاء والخميس 9:00 ص",
      icon: "⏰",
    },
    {
      name: "تحديث المهام",
      description: "يُذكّر الفريق بتسجيل وتحديث المهام ومدخلاتها",
      endpoint: "/api/cron/task-update-reminders",
      schedule: "الاثنين والأربعاء 9:00 ص",
      icon: "✍️",
    },
    {
      name: "ملخص أسبوعي",
      description: "يُرسل تقريراً أسبوعياً كل أحد",
      endpoint: "/api/cron/weekly-summary",
      schedule: "الأحد 8:00 ص",
      icon: "📊",
    },
  ];

  const statusColors: Record<string, string> = {
    success: "bg-green-100 text-green-700",
    error: "bg-red-100 text-red-700",
    running: "bg-blue-100 text-blue-700",
  };

  const statusIcons: Record<string, React.ElementType> = {
    success: CheckCircle,
    error: XCircle,
    running: Clock,
  };

  return (
    <div className="page-container">
      <div className="section-header">
        <div>
          <h1 className="text-2xl font-bold text-foreground">الأتمتة</h1>
          <p className="text-muted-foreground text-sm mt-1">إدارة المهام الآلية ومراقبة سجلاتها</p>
        </div>
      </div>

      {/* Automation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        {automations.map((auto) => (
          <div key={auto.name} className="bg-white rounded-xl border border-border p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-xl">
                {auto.icon}
              </div>
              <div>
                <h3 className="font-semibold text-foreground">{auto.name}</h3>
                <p className="text-xs text-muted-foreground">{auto.schedule}</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-3">{auto.description}</p>
            <div className="flex items-center justify-between">
              <code className="text-xs bg-muted px-2 py-1 rounded text-muted-foreground">{auto.endpoint}</code>
              <span className="flex items-center gap-1 text-xs text-green-600">
                <CheckCircle size={13} />
                مفعّل
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Logs */}
      <div className="bg-white rounded-xl border border-border overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center gap-2">
          <Zap size={18} className="text-primary" />
          <h3 className="font-semibold">سجل التشغيل</h3>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full mr-auto">{logs?.length ?? 0} سجل</span>
        </div>

        {!logs || logs.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground text-sm">
            لا توجد سجلات بعد — ستظهر هنا عند تشغيل أي مهمة آلية
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/40 border-b border-border">
              <tr>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">النوع</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">الحالة</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">الخطأ</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">التاريخ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {logs.map((log) => {
                const StatusIcon = statusIcons[log.status ?? ""] ?? AlertCircle;
                return (
                  <tr key={log.id} className="hover:bg-accent/30">
                    <td className="px-4 py-3 font-medium">{log.type}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[log.status ?? ""] ?? "bg-gray-100 text-gray-600"}`}>
                        <StatusIcon size={11} />
                        {log.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs hidden md:table-cell max-w-xs truncate">
                      {log.error ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDateShort(log.created_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
