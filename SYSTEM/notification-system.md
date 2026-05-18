# نظام الإشعارات والتذكيرات

## الهدف

هذا الملف يوثق نظام الإشعارات الحالي في منصة سماوة، خصوصًا التعديلات الخاصة بتذكيرات تحديث المهام وتنبيهات المهام المتأخرة. الهدف أن يكون مرجعًا واضحًا لأي تطوير لاحق على الإشعارات أو البريد أو جداول التشغيل.

## جداول التشغيل الحالية

تعتمد الجداول على Vercel Cron في `vercel.json`. أوقات cron مكتوبة بتوقيت UTC، والمسارات نفسها تتحقق داخليًا من اليوم حسب توقيت `Africa/Cairo`.

| المسار | الغرض | الجدول | الأيام |
| --- | --- | --- | --- |
| `/api/cron/task-update-reminders` | تذكير عام لتحديث المهام ومدخلات المهمة | `0 6 * * 1,3` | الاثنين والأربعاء |
| `/api/cron/task-reminders` | تنبيهات المهام المتأخرة فقط | `0 6 * * 0,2,4` | الأحد والثلاثاء والخميس |
| `/api/cron/daily-digest` | ملخص يومي لمديري المشاريع | `0 5 * * *` | يوميًا |
| `/api/cron/weekly-summary` | ملخص أسبوعي للإدارة | `0 5 * * 0` | الأحد |

## مسار تذكير تحديث المهام

الملف: `app/api/cron/task-update-reminders/route.ts`

السلوك:

- يعمل فقط يوم الاثنين والأربعاء حسب توقيت القاهرة.
- يقرأ المستخدمين النشطين من جدول `profiles`.
- ينشئ إشعارًا داخل التطبيق لكل مستخدم مفعّل لديه `in_app_enabled`.
- يرسل بريدًا لكل مستخدم لديه بريد وتفضيل `email_enabled`.
- لا يعتمد على `important_email_only` لأن هذا التذكير مجدول ومطلوب تشغيله كبريد مستقل.
- يستخدم `dedupe_key` بالشكل `task-update-reminder:YYYY-MM-DD` لمنع تكرار إشعار نفس اليوم لنفس المستخدم.
- يسجل نتيجة التشغيل في `automation_logs` بنوع `task-update-reminders`.

عنوان البريد:

`تذكير بتحديث المهام - سماوة`

نص البريد المعتمد:

```text
نأمل أن يكون يومكم مليئًا بالإنجاز 🌟

نود تذكيركم بتسجيل وتحديث المهام بشكل مستمر على منصة المشاريع، لما لذلك من أثر مباشر في تحسين سير العمل وتعزيز التعاون بين الفرق.

كما أن كتابة المهام وتوثيقها على المنصة تساعدكم شخصيًا على ترتيب الأولويات وتخفيف الضغط الذهني، بحيث تنتقل المهام من “الذهن” إلى “النظام”، مما يمنحكم وضوحًا أكبر وتركيزًا أفضل خلال يوم العمل ✨

شاكرين تعاونكم والتزامكم الدائم، وممتنون دائمًا لجهودكم وعطائكم 🤝

مع خالص التقدير،
```

قالب البريد موجود في:

- `lib/notifications/templates.ts`
- الدوال: `taskUpdateReminderTemplate()` و `getTaskUpdateReminderBody()`

## مسار تنبيهات المهام المتأخرة

الملف: `app/api/cron/task-reminders/route.ts`

السلوك:

- يعمل فقط أيام الأحد والثلاثاء والخميس حسب توقيت القاهرة.
- يبحث عن المهام التي تحقق الشروط التالية:
  - لها `owner_id`.
  - `due_date < اليوم`.
  - الحالة ليست `Done` ولا `Cancelled`.
- يرفع `alert_level` إلى `High` للمهام المتأخرة التي لا تحتوي على مستوى تنبيه.
- ينشئ إشعارًا داخل التطبيق لصاحب المهام المتأخرة.
- يرسل بريدًا عند وجود مهام متأخرة فقط، مع احترام `email_enabled` و `important_email_only` عبر `shouldSendImportantEmail()`.
- يستخدم `dedupe_key` بالشكل `overdue-tasks:YYYY-MM-DD` لمنع تكرار إشعار نفس اليوم لنفس المستخدم.
- يسجل نتيجة التشغيل في `automation_logs` بنوع `task-reminders`.

عنوان البريد:

`تنبيه بالمهام المتأخرة - سماوة`

قالب البريد المستخدم:

- `taskReminderTemplate()` في `lib/notifications/templates.ts`

## حارس أيام التشغيل

الملف: `lib/notifications/cron-schedule.ts`

الدوال والثوابت:

- `getCronScheduleContext()` يحسب تاريخ اليوم ورقم اليوم حسب `Africa/Cairo`.
- `isAllowedCronWeekday()` يتحقق من السماح بالتشغيل.
- `taskUpdateReminderWeekdays = [1, 3]` للاثنين والأربعاء.
- `overdueTaskReminderWeekdays = [0, 2, 4]` للأحد والثلاثاء والخميس.

سبب وجود الحارس داخل API:

- Vercel Cron يعمل بتوقيت UTC.
- وجود الحارس يمنع إرسال إشعارات خارج الجدول لو تم استدعاء endpoint يدويًا أو تغير الجدول لاحقًا.

## تفضيلات المستخدم

الملف: `lib/notifications/preferences.ts`

الحقول المهمة:

- `in_app_enabled`: يتحكم في إشعارات التطبيق.
- `email_enabled`: يتحكم في البريد.
- `important_email_only`: يمنع البريد غير المهم في المسارات التي تستخدم `shouldSendImportantEmail()`.

القرار الحالي:

- تذكير تحديث المهام يحترم `email_enabled` فقط لأنه تذكير تنظيمي مطلوب.
- تنبيهات المهام المتأخرة تحترم `important_email_only` لأنها حالة مهمة بطبيعتها.

## سجلات التشغيل

كل مسار cron يسجل في جدول `automation_logs`.

أنواع السجلات المتعلقة بهذا الملف:

- `task-update-reminders`
- `task-reminders`
- `daily-digest`
- `weekly-summary`

الـ payload يتضمن عادة:

- `date`
- `weekday`
- `timezone`
- `sent`
- `notified`
- `skipped` عند الاستدعاء خارج الجدول

## ملفات تم تعديلها أو إضافتها

- `app/api/cron/task-update-reminders/route.ts`
- `app/api/cron/task-reminders/route.ts`
- `lib/notifications/templates.ts`
- `lib/notifications/cron-schedule.ts`
- `app/(app)/automations/page.tsx`
- `vercel.json`
- `tests/cron-schedule.test.ts`
- `SYSTEM/notification-system.md`

## أفكار تطوير لاحقة

- إضافة واجهة إدارية لتعديل أيام وتوقيت الإشعارات بدون تعديل الكود.
- إضافة جدول `notification_rules` عند الحاجة لتحويل القواعد من TypeScript إلى إعدادات قابلة للتعديل.
- إضافة معاينة لقوالب البريد من لوحة الأتمتة.
- إضافة إحصائيات شهرية عن معدل فتح الإشعارات والتعامل مع المهام المتأخرة.
