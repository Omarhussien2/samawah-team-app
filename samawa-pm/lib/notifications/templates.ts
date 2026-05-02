const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://your-app.vercel.app";

interface DailyDigestData {
  managerName: string;
  overdueTasks: { title: string; project: string; dueDate: string }[];
  todayTasks: { title: string; project: string }[];
  openChallenges: { title: string; project: string }[];
}

export function dailyDigestTemplate(data: DailyDigestData): string {
  return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #f8f9fa; margin: 0; padding: 20px; direction: rtl; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.08); }
    .header { background: #4f46e5; padding: 24px; color: white; }
    .header h1 { margin: 0; font-size: 20px; }
    .header p { margin: 8px 0 0; opacity: 0.85; font-size: 14px; }
    .content { padding: 24px; }
    .section { margin-bottom: 24px; }
    .section h2 { font-size: 16px; color: #374151; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px; margin-bottom: 12px; }
    .task-item { padding: 10px 12px; border-radius: 8px; margin-bottom: 8px; border-right: 3px solid; }
    .overdue { background: #fef2f2; border-color: #ef4444; }
    .today { background: #eff6ff; border-color: #3b82f6; }
    .challenge { background: #fffbeb; border-color: #f59e0b; }
    .task-title { font-weight: 600; font-size: 14px; color: #111827; }
    .task-meta { font-size: 12px; color: #6b7280; margin-top: 2px; }
    .empty { text-align: center; color: #9ca3af; font-size: 13px; padding: 12px; }
    .btn { display: inline-block; background: #4f46e5; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; }
    .footer { text-align: center; padding: 20px; color: #9ca3af; font-size: 12px; border-top: 1px solid #e5e7eb; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>ملخص يومي - سماوة</h1>
      <p>مرحباً ${data.managerName}، إليك ملخص اليوم</p>
    </div>
    <div class="content">
      <div class="section">
        <h2>⚠️ المهام المتأخرة (${data.overdueTasks.length})</h2>
        ${data.overdueTasks.length === 0 ? '<p class="empty">لا توجد مهام متأخرة 🎉</p>' : data.overdueTasks.map(t => `
          <div class="task-item overdue">
            <div class="task-title">${t.title}</div>
            <div class="task-meta">${t.project} · استحق في ${t.dueDate}</div>
          </div>
        `).join("")}
      </div>
      <div class="section">
        <h2>📅 مستحقة اليوم (${data.todayTasks.length})</h2>
        ${data.todayTasks.length === 0 ? '<p class="empty">لا توجد مهام مستحقة اليوم</p>' : data.todayTasks.map(t => `
          <div class="task-item today">
            <div class="task-title">${t.title}</div>
            <div class="task-meta">${t.project}</div>
          </div>
        `).join("")}
      </div>
      <div class="section">
        <h2>🚨 التحديات المفتوحة (${data.openChallenges.length})</h2>
        ${data.openChallenges.length === 0 ? '<p class="empty">لا توجد تحديات مفتوحة</p>' : data.openChallenges.map(c => `
          <div class="task-item challenge">
            <div class="task-title">${c.title}</div>
            <div class="task-meta">${c.project}</div>
          </div>
        `).join("")}
      </div>
      <div style="text-align:center; margin-top: 20px;">
        <a href="${APP_URL}/dashboard" class="btn">فتح لوحة التحكم</a>
      </div>
    </div>
    <div class="footer">
      <p>هذا البريد أُرسل تلقائياً من نظام سماوة</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

interface TaskReminderData {
  userName: string;
  tasks: { title: string; project: string; dueDate: string; isOverdue: boolean }[];
}

export function taskReminderTemplate(data: TaskReminderData): string {
  return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; background: #f8f9fa; margin: 0; padding: 20px; direction: rtl; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.08); }
    .header { background: #4f46e5; padding: 24px; color: white; }
    .content { padding: 24px; }
    .task-item { padding: 12px; border-radius: 8px; margin-bottom: 10px; }
    .overdue { background: #fef2f2; border-right: 3px solid #ef4444; }
    .today { background: #eff6ff; border-right: 3px solid #3b82f6; }
    .task-title { font-weight: 600; font-size: 14px; color: #111827; }
    .task-meta { font-size: 12px; color: #6b7280; margin-top: 4px; }
    .btn { display: inline-block; background: #4f46e5; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; }
    .footer { text-align: center; padding: 16px; color: #9ca3af; font-size: 12px; border-top: 1px solid #e5e7eb; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin:0;font-size:18px;">تذكير بمهامك - سماوة</h1>
      <p style="margin:8px 0 0;opacity:0.85;font-size:13px;">مرحباً ${data.userName}، لديك ${data.tasks.length} مهمة تحتاج اهتمامك</p>
    </div>
    <div class="content">
      ${data.tasks.map(t => `
        <div class="task-item ${t.isOverdue ? "overdue" : "today"}">
          <div class="task-title">${t.title}</div>
          <div class="task-meta">${t.project} · ${t.isOverdue ? "متأخرة - استحقت في" : "تستحق اليوم"} ${t.dueDate}</div>
        </div>
      `).join("")}
      <div style="text-align:center; margin-top: 20px;">
        <a href="${APP_URL}/my-tasks" class="btn">عرض مهامي</a>
      </div>
    </div>
    <div class="footer">هذا البريد أُرسل تلقائياً من نظام سماوة</div>
  </div>
</body>
</html>
  `.trim();
}

interface WeeklySummaryData {
  totalCompleted: number;
  totalOverdue: number;
  topProjects: { name: string; progress: number }[];
}

export function weeklySummaryTemplate(data: WeeklySummaryData): string {
  return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; background: #f8f9fa; margin: 0; padding: 20px; direction: rtl; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.08); }
    .header { background: #4f46e5; padding: 24px; color: white; }
    .content { padding: 24px; }
    .stat-row { display: flex; gap: 16px; margin-bottom: 24px; }
    .stat { flex: 1; background: #f9fafb; border-radius: 8px; padding: 16px; text-align: center; }
    .stat-num { font-size: 28px; font-weight: 700; }
    .stat-label { font-size: 12px; color: #6b7280; margin-top: 4px; }
    .project-row { display: flex; align-items: center; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f3f4f6; }
    .progress-bar { height: 6px; background: #e5e7eb; border-radius: 4px; width: 120px; }
    .progress-fill { height: 100%; background: #4f46e5; border-radius: 4px; }
    .btn { display: inline-block; background: #4f46e5; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; }
    .footer { text-align: center; padding: 16px; color: #9ca3af; font-size: 12px; border-top: 1px solid #e5e7eb; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin:0;font-size:18px;">الملخص الأسبوعي - سماوة</h1>
    </div>
    <div class="content">
      <div class="stat-row">
        <div class="stat">
          <div class="stat-num" style="color:#16a34a">${data.totalCompleted}</div>
          <div class="stat-label">مهمة مكتملة</div>
        </div>
        <div class="stat">
          <div class="stat-num" style="color:#dc2626">${data.totalOverdue}</div>
          <div class="stat-label">مهمة متأخرة</div>
        </div>
      </div>
      ${data.topProjects.length > 0 ? `
        <h3 style="font-size:15px;color:#374151;margin-bottom:12px;">المشاريع النشطة</h3>
        ${data.topProjects.map(p => `
          <div class="project-row">
            <span style="font-size:14px;color:#111827;">${p.name}</span>
            <div style="display:flex;align-items:center;gap:8px;">
              <div class="progress-bar"><div class="progress-fill" style="width:${p.progress}%"></div></div>
              <span style="font-size:12px;color:#6b7280;min-width:32px;">${p.progress}%</span>
            </div>
          </div>
        `).join("")}
      ` : ""}
      <div style="text-align:center;margin-top:24px;">
        <a href="${APP_URL}/dashboard" class="btn">فتح لوحة التحكم</a>
      </div>
    </div>
    <div class="footer">هذا البريد أُرسل تلقائياً من نظام سماوة</div>
  </div>
</body>
</html>
  `.trim();
}
