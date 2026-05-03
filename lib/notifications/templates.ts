const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://samawah-team-app-sepia.vercel.app";

const baseStyles = `
  body { font-family: 'Segoe UI', Arial, sans-serif; background: #f1f5f9; margin: 0; padding: 32px; direction: rtl; }
  .container { max-width: 560px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.06); }
  .header { background: linear-gradient(135deg, #4f46e5 0%, #6366f1 100%); padding: 28px 24px; color: white; }
  .header h1 { margin: 0; font-size: 20px; font-weight: 700; }
  .header p { margin: 8px 0 0; opacity: 0.9; font-size: 14px; }
  .content { padding: 28px; }
  .greeting { font-size: 16px; color: #1e293b; margin-bottom: 24px; font-weight: 600; }
  .section { margin-bottom: 24px; }
  .section-title { font-size: 15px; color: #334155; font-weight: 700; margin-bottom: 12px; }
  .task-item { padding: 12px 14px; border-radius: 10px; margin-bottom: 8px; border-right: 4px solid; background: #f8fafc; }
  .overdue { border-color: #ef4444; }
  .today { border-color: #3b82f6; }
  .challenge { border-color: #f59e0b; }
  .done { border-color: #10b981; }
  .task-title { font-weight: 600; font-size: 14px; color: #0f172a; }
  .task-meta { font-size: 12px; color: #64748b; margin-top: 4px; }
  .empty { text-align: center; color: #94a3b8; font-size: 13px; padding: 16px; background: #f8fafc; border-radius: 10px; }
  .stats { display: flex; gap: 12px; margin-bottom: 24px; }
  .stat { flex: 1; background: #f8fafc; border-radius: 10px; padding: 14px; text-align: center; border: 1px solid #e2e8f0; }
  .stat-num { font-size: 26px; font-weight: 700; line-height: 1; }
  .stat-label { font-size: 11px; color: #64748b; margin-top: 6px; }
  .btn { display: inline-block; background: linear-gradient(135deg, #4f46e5, #6366f1); color: white; padding: 14px 28px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 14px; }
  .footer { text-align: center; padding: 20px 24px; color: #94a3b8; font-size: 12px; border-top: 1px solid #f1f5f9; }
  .divider { height: 1px; background: #e2e8f0; margin: 20px 0; }
`;

function headerBlock(title: string, subtitle: string): string {
  return `
    <div class="header">
      <h1>${title}</h1>
      <p>${subtitle}</p>
    </div>`;
}

function footerBlock(): string {
  return `
    <div class="footer">
      <p>تم إرسال هذا البريد تلقائياً من نظام إدارة المشاريع</p>
    </div>`;
}

function taskItem(title: string, meta: string, cls: string): string {
  return `
    <div class="task-item ${cls}">
      <div class="task-title">${title}</div>
      <div class="task-meta">${meta}</div>
    </div>`;
}

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
  <style>${baseStyles}</style>
</head>
<body>
  <div class="container">
    ${headerBlock("الملخص اليومي", `مرحباً ${data.managerName}، إليك ملخص اليوم`)}
    <div class="content">
      <div class="stats">
        <div class="stat">
          <div class="stat-num" style="color:#dc2626">${data.overdueTasks.length}</div>
          <div class="stat-label">متأخرة</div>
        </div>
        <div class="stat">
          <div class="stat-num" style="color:#2563eb">${data.todayTasks.length}</div>
          <div class="stat-label">مستحقة اليوم</div>
        </div>
        <div class="stat">
          <div class="stat-num" style="color:#d97706">${data.openChallenges.length}</div>
          <div class="stat-label">تحديات مفتوحة</div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">⚠️ المهام المتأخرة</div>
        ${data.overdueTasks.length === 0
          ? '<div class="empty">لا توجد مهام متأخرة 🎉</div>'
          : data.overdueTasks.map(t => taskItem(t.title, `${t.project} · استحق في ${t.dueDate}`, "overdue")).join("")
        }
      </div>

      <div class="section">
        <div class="section-title">📅 مستحقة اليوم</div>
        ${data.todayTasks.length === 0
          ? '<div class="empty">لا توجد مهام مستحقة اليوم</div>'
          : data.todayTasks.map(t => taskItem(t.title, t.project, "today")).join("")
        }
      </div>

      ${data.openChallenges.length > 0 ? `
      <div class="divider"></div>
      <div class="section">
        <div class="section-title">🚨 التحديات المفتوحة</div>
        ${data.openChallenges.map(c => taskItem(c.title, c.project, "challenge")).join("")}
      </div>` : ""}

      <div style="text-align:center; margin-top: 20px;">
        <a href="${APP_URL}/dashboard" class="btn">فتح لوحة المشاريع</a>
      </div>
    </div>
    ${footerBlock()}
  </div>
</body>
</html>`.trim();
}

interface TaskReminderData {
  userName: string;
  tasks: { title: string; project: string; dueDate: string; isOverdue: boolean }[];
}

export function taskReminderTemplate(data: TaskReminderData): string {
  const overdueCount = data.tasks.filter(t => t.isOverdue).length;
  const upcomingCount = data.tasks.length - overdueCount;

  return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>${baseStyles}</style>
</head>
<body>
  <div class="container">
    ${headerBlock("⏰ تذكير بمهامك", `مرحباً ${data.userName}، لديك ${data.tasks.length} مهمة تحتاج اهتمامك`)}
    <div class="content">
      <div class="stats">
        <div class="stat">
          <div class="stat-num" style="color:#dc2626">${overdueCount}</div>
          <div class="stat-label">متأخرة</div>
        </div>
        <div class="stat">
          <div class="stat-num" style="color:#2563eb">${upcomingCount}</div>
          <div class="stat-label">قادمة</div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">تفاصيل المهام</div>
        ${data.tasks.map(t => taskItem(
          t.title,
          `${t.project} · ${t.isOverdue ? "متأخرة — استحقت في" : "تستحق في"} ${t.dueDate}`,
          t.isOverdue ? "overdue" : "today"
        )).join("")}
      </div>

      <div style="text-align:center; margin-top: 20px;">
        <a href="${APP_URL}/my-tasks" class="btn">عرض مهامي</a>
      </div>
    </div>
    ${footerBlock()}
  </div>
</body>
</html>`.trim();
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
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    ${baseStyles}
    .progress-row { display: flex; align-items: center; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f1f5f9; }
    .progress-bar { height: 8px; background: #e2e8f0; border-radius: 4px; width: 140px; }
    .progress-fill { height: 100%; background: linear-gradient(135deg, #4f46e5, #6366f1); border-radius: 4px; }
  </style>
</head>
<body>
  <div class="container">
    ${headerBlock("📊 الملخص الأسبوعي", "ملخص أداء المشاريع والمهام لهذا الأسبوع")}
    <div class="content">
      <div class="stats">
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
      <div class="section">
        <div class="section-title">نشاط المشاريع</div>
        ${data.topProjects.map(p => `
          <div class="progress-row">
            <span style="font-size:14px;color:#0f172a;font-weight:500;">${p.name}</span>
            <div style="display:flex;align-items:center;gap:10px;">
              <div class="progress-bar"><div class="progress-fill" style="width:${p.progress}%"></div></div>
              <span style="font-size:12px;color:#64748b;min-width:32px;font-weight:600;">${p.progress}%</span>
            </div>
          </div>
        `).join("")}
      </div>` : ""}

      <div style="text-align:center; margin-top: 24px;">
        <a href="${APP_URL}/dashboard" class="btn">فتح لوحة المشاريع</a>
      </div>
    </div>
    ${footerBlock()}
  </div>
</body>
</html>`.trim();
}
