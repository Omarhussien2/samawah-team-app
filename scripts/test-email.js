const fs = require("fs");
const { createClient } = require("@supabase/supabase-js");
const nodemailer = require("nodemailer");

const env = fs.readFileSync(".env", "utf8");
const v = {};
env.split("\n").forEach((l) => {
  const m = l.match(/^([^#][^=]+)=(.*)$/);
  if (m) v[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
});

async function test() {
  console.log("=== Email Test ===\n");

  if (!v.SMTP_PASS) {
    console.log("ERROR: SMTP_PASS is empty!");
    return;
  }

  console.log("SMTP_HOST:", v.SMTP_HOST);
  console.log("SMTP_PORT:", v.SMTP_PORT);
  console.log("SMTP_USER:", v.SMTP_USER);
  console.log("SMTP_PASS:", v.SMTP_PASS ? "***" + v.SMTP_PASS.slice(-4) : "EMPTY");
  console.log("SMTP_FROM:", v.SMTP_FROM);
  console.log("");

  const transporter = nodemailer.createTransport({
    host: v.SMTP_HOST,
    port: parseInt(v.SMTP_PORT || "587"),
    secure: parseInt(v.SMTP_PORT || "587") === 465,
    auth: {
      user: v.SMTP_USER,
      pass: v.SMTP_PASS,
    },
  });

  console.log("Verifying SMTP connection...");
  try {
    await transporter.verify();
    console.log("SMTP connection: OK\n");
  } catch (err) {
    console.log("SMTP connection FAILED:", err.message);
    return;
  }

  const APP_URL = v.NEXT_PUBLIC_APP_URL || "https://samawah-team-app-sepia.vercel.app";

  const html = `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #f1f5f9; margin: 0; padding: 32px; direction: rtl; }
    .container { max-width: 560px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.06); }
    .header { background: linear-gradient(135deg, #4f46e5 0%, #6366f1 100%); padding: 32px 28px; color: white; }
    .header img { width: 48px; height: 48px; margin-bottom: 12px; }
    .header h1 { margin: 0; font-size: 22px; font-weight: 700; }
    .header p { margin: 8px 0 0; opacity: 0.9; font-size: 14px; line-height: 1.6; }
    .content { padding: 28px; }
    .greeting { font-size: 16px; color: #1e293b; margin-bottom: 24px; font-weight: 600; }
    .section { margin-bottom: 28px; }
    .section-title { font-size: 15px; color: #334155; font-weight: 700; margin-bottom: 14px; display: flex; align-items: center; gap: 8px; }
    .task-item { padding: 14px 16px; border-radius: 10px; margin-bottom: 10px; border-right: 4px solid; background: #f8fafc; transition: background 0.2s; }
    .task-item:hover { background: #f1f5f9; }
    .overdue { border-color: #ef4444; }
    .today { border-color: #3b82f6; }
    .done { border-color: #10b981; }
    .task-title { font-weight: 600; font-size: 14px; color: #0f172a; }
    .task-meta { font-size: 12px; color: #64748b; margin-top: 4px; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 6px; font-size: 11px; font-weight: 600; }
    .badge-red { background: #fef2f2; color: #dc2626; }
    .badge-blue { background: #eff6ff; color: #2563eb; }
    .badge-green { background: #f0fdf4; color: #16a34a; }
    .stats { display: flex; gap: 12px; margin-bottom: 28px; }
    .stat { flex: 1; background: #f8fafc; border-radius: 10px; padding: 16px; text-align: center; border: 1px solid #e2e8f0; }
    .stat-num { font-size: 28px; font-weight: 700; line-height: 1; }
    .stat-label { font-size: 12px; color: #64748b; margin-top: 6px; }
    .btn { display: inline-block; background: linear-gradient(135deg, #4f46e5, #6366f1); color: white; padding: 14px 32px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 14px; box-shadow: 0 4px 12px rgba(79,70,229,0.3); }
    .btn:hover { box-shadow: 0 6px 16px rgba(79,70,229,0.4); }
    .footer { text-align: center; padding: 20px 28px; color: #94a3b8; font-size: 12px; border-top: 1px solid #f1f5f9; }
    .divider { height: 1px; background: #e2e8f0; margin: 24px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <img src="${APP_URL}/logo.png" alt="سماوة" />
      <h1>تقرير اختبار الإشعارات</h1>
      <p>هذا إيميل اختبار من نظام إدارة المشاريع</p>
    </div>
    <div class="content">
      <p class="greeting">مرحباً عمر! 👋</p>

      <div class="stats">
        <div class="stat">
          <div class="stat-num" style="color:#2563eb">12</div>
          <div class="stat-label">مهام مفتوحة</div>
        </div>
        <div class="stat">
          <div class="stat-num" style="color:#dc2626">3</div>
          <div class="stat-label">مهام متأخرة</div>
        </div>
        <div class="stat">
          <div class="stat-num" style="color:#16a34a">8</div>
          <div class="stat-label">مكتملة اليوم</div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">⚠️ المهام المتأخرة</div>
        <div class="task-item overdue">
          <div class="task-title">تصميم صفحة الهبوط</div>
          <div class="task-meta">متجر سماوة · استحق في 28 أبريل <span class="badge badge-red">متأخرة</span></div>
        </div>
        <div class="task-item overdue">
          <div class="task-title">كتابة تقرير الأصول</div>
          <div class="task-meta">تقرير محفظة · استحق في 25 أبريل <span class="badge badge-red">متأخرة</span></div>
        </div>
      </div>

      <div class="divider"></div>

      <div class="section">
        <div class="section-title">📅 مهام مستحقة اليوم</div>
        <div class="task-item today">
          <div class="task-title">مراجعة التصاميم</div>
          <div class="task-meta">متجر سماوة <span class="badge badge-blue">اليوم</span></div>
        </div>
        <div class="task-item today">
          <div class="task-title">إرسال التقرير الأسبوعي</div>
          <div class="task-meta">تقارير الإعلام <span class="badge badge-blue">اليوم</span></div>
        </div>
      </div>

      <div style="text-align:center; margin-top: 24px;">
        <a href="${APP_URL}/dashboard" class="btn">فتح لوحة المشاريع</a>
      </div>
    </div>
    <div class="footer">
      <p>تم إرسال هذا البريد تلقائياً — لا ترد عليه</p>
    </div>
  </div>
</body>
</html>
  `.trim();

  console.log("Sending test email to omarsamawah@gmail.com...");
  try {
    const info = await transporter.sendMail({
      from: v.SMTP_FROM || v.SMTP_USER,
      to: "omarsamawah@gmail.com",
      subject: "🧪 اختبار إشعارات سماوة",
      html,
    });
    console.log("Email sent successfully!");
    console.log("Message ID:", info.messageId);
    console.log("Response:", info.response);
  } catch (err) {
    console.log("FAILED to send email:", err.message);
  }
}

test();
