# سماوة - نظام إدارة المشاريع والمهام

> ⚠️ **تحذير مهم**: هذا المشروع **لا يُنشر على Replit/Rebuilt**. المنصة تُستخدم فقط لتوليد الكود. النشر الرسمي يجب أن يكون عبر **GitHub + Vercel + Supabase**.

---

## نظرة عامة

منصة سماوة هي نظام إدارة مشاريع داخلي مبني بـ Next.js 15، مع دعم كامل للغة العربية (RTL)، يشمل:

- إدارة المشاريع والمهام
- Kanban Board بالسحب والإفلات
- لوحة تحكم تحليلية
- إشعارات وتذكيرات آلية (Vercel Cron)
- استيراد بيانات من Google Sheet (CSV)
- إدارة التحديات والمستندات

---

## المتطلبات

- Node.js 20+
- حساب Supabase (مجاني)
- حساب Vercel (مجاني)
- حساب GitHub

---

## التشغيل المحلي

```bash
# 1. استنسخ المشروع
git clone https://github.com/your-username/samawa-pm.git
cd samawa-pm

# 2. ثبّت المكتبات
npm install

# 3. أنشئ ملف البيئة
cp .env.example .env.local

# 4. أضف متغيرات البيئة (انظر قسم متغيرات البيئة أدناه)
# ثم افتح .env.local وعدّل القيم

# 5. شغّل المشروع
npm run dev
```

افتح [http://localhost:3000](http://localhost:3000)

---

## إنشاء Supabase

1. اذهب إلى [supabase.com](https://supabase.com) وأنشئ حساباً مجانياً
2. أنشئ مشروعاً جديداً واختر المنطقة الأقرب (Frankfurt أو Singapore)
3. انتظر حتى يكتمل إنشاء المشروع
4. من القائمة الجانبية: **Settings → API**
   - انسخ `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - انسخ `anon public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - انسخ `service_role` → `SUPABASE_SERVICE_ROLE_KEY`

---

## تشغيل SQL في Supabase

1. من القائمة الجانبية في Supabase: **SQL Editor**
2. شغّل الملفات بهذا الترتيب:
   ```
   supabase/schema.sql   ← أولاً: إنشاء الجداول
   supabase/rls.sql      ← ثانياً: سياسات الأمان
   supabase/seed.sql     ← ثالثاً: البيانات الأولية (القوالب)
   ```
3. تأكد من نجاح كل ملف قبل الانتقال للتالي

---

## تفعيل Supabase Auth

1. من القائمة الجانبية: **Authentication → Providers**
2. فعّل **Email** وضبط الإعدادات:
   - ✅ Enable Email provider
   - ✅ Enable email confirmations (اختياري للبيئة الداخلية)
3. من **Authentication → URL Configuration**:
   - Site URL: `https://your-app.vercel.app`
   - Redirect URLs: `https://your-app.vercel.app/**`

---

## تفعيل Supabase Storage (للمستندات)

1. من القائمة الجانبية: **Storage**
2. أنشئ Bucket جديد باسم `documents`
3. اضبطه على **Private**

---

## رفع على GitHub

```bash
# داخل مجلد المشروع
git init
git add .
git commit -m "feat: initial commit - سماوة نظام إدارة المشاريع"

# أنشئ Repository جديد على github.com ثم:
git remote add origin https://github.com/your-username/samawa-pm.git
git branch -M main
git push -u origin main
```

> ⚠️ **لا ترفع ملف `.env` أو `.env.local` أبداً** — الـ `.gitignore` يمنع ذلك تلقائياً

---

## ربط Vercel

1. اذهب إلى [vercel.com](https://vercel.com) وسجّل دخولاً بـ GitHub
2. اضغط **"Add New Project"**
3. اختر Repository: `samawa-pm`
4. Framework Preset: اختر **Next.js** (تلقائي)
5. من **Environment Variables** أضف المتغيرات (انظر الجدول أدناه)
6. اضغط **Deploy**

---

## متغيرات البيئة

أضف هذه المتغيرات في **Vercel → Project → Settings → Environment Variables**:

| المتغير | المصدر | مثال |
|---------|--------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Settings → API | `https://xxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Settings → API | `eyJhbGci...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Settings → API | `eyJhbGci...` |
| `CRON_SECRET` | أنشئ قيمة عشوائية | `my-secret-123` |
| `SMTP_HOST` | مزود البريد | `smtp.gmail.com` |
| `SMTP_PORT` | مزود البريد | `587` |
| `SMTP_USER` | بريدك | `you@gmail.com` |
| `SMTP_PASS` | App Password | `xxxx xxxx xxxx xxxx` |
| `SMTP_FROM` | اسم المرسل | `"سماوة <noreply@domain.com>"` |
| `NEXT_PUBLIC_APP_URL` | رابط Vercel | `https://samawa-pm.vercel.app` |

---

## تفعيل Vercel Cron Jobs

`vercel.json` يحتوي على إعداد Cron تلقائياً. بعد النشر:

1. اذهب إلى Vercel Dashboard → مشروعك
2. من **Settings → Cron Jobs** ستجد المهام الثلاثة مسجّلة
3. تأكد من إضافة `CRON_SECRET` في متغيرات البيئة

> **ملاحظة**: Vercel Cron يستدعي الـ Endpoints تلقائياً، لكن يجب أن تضيف `CRON_SECRET` كـ Authorization header في Vercel.

---

## استيراد بيانات Google Sheet

1. افتح Google Sheet الخاص بك
2. **ملف → تنزيل → قيم مفصولة بفواصل (.csv)**
3. افتح التطبيق → **استيراد** من القائمة الجانبية
4. اختر نوع الاستيراد (مشاريع أو مهام)
5. ارفع ملف CSV
6. راجع البيانات في المعاينة
7. اضغط **استيراد**

**ترتيب الاستيراد المهم:**
- استورد **المشاريع أولاً** ثم **المهام** (لأن المهام تحتاج Project_ID)

---

## إنشاء المستخدم الأول (Admin)

1. افتح تطبيقك على Vercel
2. اذهب إلى صفحة `/login`
3. سيظهر خطأ (لأنه لا يوجد مستخدمون بعد)
4. اذهب إلى Supabase → **Authentication → Users → Invite user**
5. أدخل بريدك الإلكتروني
6. ستصلك رسالة دعوة، اضغط الرابط وعيّن كلمة مرور
7. بعد الدخول، اذهب إلى Supabase → **SQL Editor** وشغّل:
   ```sql
   UPDATE profiles SET role = 'admin' WHERE email = 'your-email@domain.com';
   ```

---

## هيكل المشروع

```
samawa-pm/
├── app/
│   ├── (app)/           ← الصفحات المحمية
│   │   ├── dashboard/
│   │   ├── projects/
│   │   ├── board/
│   │   ├── my-tasks/
│   │   ├── challenges/
│   │   ├── documents/
│   │   ├── team/
│   │   ├── automations/
│   │   ├── settings/
│   │   └── import/
│   ├── api/
│   │   ├── cron/        ← مهام Vercel Cron
│   │   └── import/      ← API استيراد CSV
│   └── login/
├── components/          ← مكونات React
├── lib/
│   ├── supabase/        ← إعداد Supabase
│   ├── notifications/   ← البريد والإشعارات
│   └── utils/           ← دوال مساعدة
├── supabase/
│   ├── schema.sql       ← إنشاء الجداول
│   ├── rls.sql          ← سياسات الأمان
│   └── seed.sql         ← البيانات الأولية
└── docs/                ← توثيق إضافي
```

---

## التقنيات المستخدمة

- **Next.js 15** App Router
- **TypeScript** strict mode
- **Tailwind CSS** + shadcn/ui
- **Supabase** (Postgres + Auth + Storage)
- **@dnd-kit** للـ Kanban drag & drop
- **Recharts** للرسوم البيانية
- **React Hook Form + Zod** للنماذج
- **date-fns** للتواريخ
- **Nodemailer** للبريد الإلكتروني
- **PapaParse** لاستيراد CSV
- **Vercel Cron** للمهام الآلية
