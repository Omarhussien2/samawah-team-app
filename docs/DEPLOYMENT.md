# دليل النشر التفصيلي - سماوة

## الخطوة 1: إعداد Supabase

### إنشاء المشروع
1. اذهب إلى [app.supabase.com](https://app.supabase.com)
2. اضغط **New project**
3. اختر اسماً للمشروع: `samawa-pm`
4. اختر قاعدة بيانات قوية وحفظها في مكان آمن
5. اختر المنطقة: **West EU (Frankfurt)** أو **Southeast Asia (Singapore)**
6. اضغط **Create new project** وانتظر 2-3 دقائق

### الحصول على مفاتيح API
1. من القائمة الجانبية: **Project Settings → API**
2. احفظ:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** (سري جداً) → `SUPABASE_SERVICE_ROLE_KEY`

### تشغيل Schema
1. من القائمة الجانبية: **SQL Editor → New query**
2. انسخ محتوى `supabase/schema.sql` والصقه، ثم اضغط **Run**
3. ستظهر رسالة "Success" إذا نجح الأمر

### تشغيل RLS
1. **SQL Editor → New query**
2. انسخ محتوى `supabase/rls.sql` والصقه، ثم اضغط **Run**

### تشغيل Seed
1. **SQL Editor → New query**
2. انسخ محتوى `supabase/seed.sql` والصقه، ثم اضغط **Run**
3. هذا يضيف قوالب المشاريع الجاهزة

### تفعيل Auth
1. **Authentication → Providers → Email**
   - ✅ Enable Email provider
   - حدد: Confirm email = false (للبيئة الداخلية)
2. **Authentication → URL Configuration**
   - Site URL: `https://your-app.vercel.app` (سنضيفه بعد Vercel)
   - Redirect URLs: أضف `https://your-app.vercel.app/**`

---

## الخطوة 2: إعداد GitHub

```bash
# في مجلد samawa-pm
git init
git add .
git commit -m "feat: إطلاق نظام سماوة"

# أنشئ Repository على github.com (Private)
# ثم:
git remote add origin https://github.com/YOUR_USERNAME/samawa-pm.git
git branch -M main
git push -u origin main
```

**تأكيدات مهمة:**
- ✅ الـ `.gitignore` يمنع رفع `.env` و `.env.local`
- ✅ لا ترفع أي ملف يحتوي على مفاتيح
- ✅ الـ Repository يمكن أن يكون Private

---

## الخطوة 3: النشر على Vercel

### ربط GitHub بـ Vercel
1. اذهب إلى [vercel.com](https://vercel.com)
2. سجّل دخول بحساب GitHub
3. اضغط **Add New → Project**
4. اختر Repository: `samawa-pm`
5. Framework: **Next.js** (يُكتشف تلقائياً)
6. **لا تضغط Deploy بعد** — أضف متغيرات البيئة أولاً

### إضافة Environment Variables
في قسم **Environment Variables** أضف:

```
NEXT_PUBLIC_SUPABASE_URL        = https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY   = eyJhbGci...
SUPABASE_SERVICE_ROLE_KEY       = eyJhbGci...
CRON_SECRET                     = أنشئ نصاً عشوائياً مثل: samawa-cron-2024-secret
SMTP_HOST                       = smtp.gmail.com
SMTP_PORT                       = 587
SMTP_USER                       = your-email@gmail.com
SMTP_PASS                       = xxxx xxxx xxxx xxxx (App Password من Google)
SMTP_FROM                       = سماوة <your-email@gmail.com>
NEXT_PUBLIC_APP_URL             = https://samawa-pm.vercel.app (ستعرف الرابط بعد أول deploy)
```

7. اضغط **Deploy**
8. انتظر 2-5 دقائق

### بعد أول Deploy
1. انسخ رابط Vercel الفعلي (مثل: `https://samawa-pm-xxx.vercel.app`)
2. ارجع إلى Vercel → **Settings → Environment Variables**
3. حدّث `NEXT_PUBLIC_APP_URL` بالرابط الصحيح
4. ارجع إلى Supabase → **Authentication → URL Configuration**
5. حدّث Site URL ورابط Redirect بالرابط الفعلي
6. اضغط Redeploy في Vercel

---

## الخطوة 4: تفعيل Cron Jobs

ملف `vercel.json` يُسجّل المهام تلقائياً:

```json
{
  "crons": [
    { "path": "/api/cron/daily-digest",    "schedule": "0 5 * * *"   },
    { "path": "/api/cron/task-reminders",  "schedule": "0 6 * * *"   },
    { "path": "/api/cron/weekly-summary",  "schedule": "0 5 * * 0"   }
  ]
}
```

**التوقيتات بتوقيت UTC (ما يعادل +3 توقيت السعودية):**
- `0 5 * * *` = الساعة 8 صباحاً بتوقيت السعودية
- `0 6 * * *` = الساعة 9 صباحاً بتوقيت السعودية
- `0 5 * * 0` = الأحد الساعة 8 صباحاً بتوقيت السعودية

**التحقق من تفعيل Cron:**
1. Vercel Dashboard → مشروعك → **Settings → Cron Jobs**
2. يجب أن تظهر 3 مهام

**الاختبار اليدوي:**
```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" https://your-app.vercel.app/api/cron/daily-digest
```

---

## الخطوة 5: إنشاء أول مستخدم

1. اذهب إلى Supabase → **Authentication → Users**
2. اضغط **Invite user**
3. أدخل بريدك
4. ستصلك رسالة — اضغط الرابط وعيّن كلمة مرور
5. في **SQL Editor** شغّل:
   ```sql
   UPDATE profiles SET role = 'admin' WHERE email = 'your-email@example.com';
   ```
6. الآن يمكنك الدخول ودعوة بقية الفريق من صفحة **الفريق**

---

## إعداد Gmail للبريد (اختياري)

1. اذهب إلى Google Account → **Security → 2-Step Verification** (فعّله أولاً)
2. ابحث عن **App passwords**
3. أنشئ App Password لـ "Mail" و "Other (Custom name)"
4. استخدم الـ 16 حرف الناتجة كـ `SMTP_PASS`

---

## تحديث الكود مستقبلاً

```bash
git add .
git commit -m "feat: وصف التعديل"
git push origin main
```

Vercel سيعيد النشر تلقائياً بعد كل push على `main`.

---

## استكشاف الأخطاء

| المشكلة | الحل |
|---------|------|
| خطأ 401 في login | تأكد من NEXT_PUBLIC_SUPABASE_URL و ANON_KEY |
| لا تصل رسائل البريد | تحقق من SMTP_HOST و SMTP_PASS |
| Cron لا يعمل | تأكد من CRON_SECRET متطابق في Vercel وفي الكود |
| قاعدة البيانات فارغة | تأكد من تشغيل schema.sql و seed.sql |
| خطأ RLS | تأكد من تشغيل rls.sql وتسجيل الدخول بحساب صحيح |
