-- ============================================================
-- سماوة - Seed Data: قوالب المشاريع والمهام
-- ============================================================

-- ============================================================
-- قوالب المشاريع
-- ============================================================
INSERT INTO project_templates (id, name, description, category) VALUES
  ('11111111-1111-1111-1111-111111111101', 'صفحة هبوط', 'قالب لمشاريع Landing Page', 'تقنية'),
  ('11111111-1111-1111-1111-111111111102', 'تطبيق ويب', 'قالب لمشاريع Web App كاملة', 'تقنية'),
  ('11111111-1111-1111-1111-111111111103', 'تقرير إعلامي', 'قالب لتقارير وسائل الإعلام', 'إعلام'),
  ('11111111-1111-1111-1111-111111111104', 'حملة تسويقية', 'قالب للحملات التسويقية', 'تسويق'),
  ('11111111-1111-1111-1111-111111111105', 'فعالية', 'قالب لتنظيم الفعاليات والمؤتمرات', 'فعاليات'),
  ('11111111-1111-1111-1111-111111111106', 'مشروع بحثي', 'قالب للمشاريع البحثية والدراسات', 'بحث')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- مهام قالب: صفحة هبوط
-- ============================================================
INSERT INTO task_templates (template_id, title, category, default_duration_days, default_priority, sort_order) VALUES
  ('11111111-1111-1111-1111-111111111101', 'تحليل المتطلبات', 'تخطيط', 2, 'high', 1),
  ('11111111-1111-1111-1111-111111111101', 'تصميم الماكب', 'تصميم', 3, 'high', 2),
  ('11111111-1111-1111-1111-111111111101', 'تطوير الواجهة', 'تطوير', 5, 'high', 3),
  ('11111111-1111-1111-1111-111111111101', 'كتابة المحتوى', 'محتوى', 3, 'medium', 4),
  ('11111111-1111-1111-1111-111111111101', 'ربط النطاق', 'نشر', 1, 'medium', 5),
  ('11111111-1111-1111-1111-111111111101', 'اختبار الأداء', 'جودة', 2, 'medium', 6),
  ('11111111-1111-1111-1111-111111111101', 'المراجعة النهائية والتسليم', 'تسليم', 1, 'high', 7)
ON CONFLICT DO NOTHING;

-- ============================================================
-- مهام قالب: تطبيق ويب
-- ============================================================
INSERT INTO task_templates (template_id, title, category, default_duration_days, default_priority, sort_order) VALUES
  ('11111111-1111-1111-1111-111111111102', 'تحليل المتطلبات', 'تخطيط', 3, 'high', 1),
  ('11111111-1111-1111-1111-111111111102', 'تصميم قاعدة البيانات', 'هندسة', 2, 'high', 2),
  ('11111111-1111-1111-1111-111111111102', 'تصميم الواجهة (Figma)', 'تصميم', 5, 'high', 3),
  ('11111111-1111-1111-1111-111111111102', 'بناء Authentication', 'تطوير', 3, 'high', 4),
  ('11111111-1111-1111-1111-111111111102', 'بناء Dashboard', 'تطوير', 4, 'high', 5),
  ('11111111-1111-1111-1111-111111111102', 'بناء CRUD الأساسي', 'تطوير', 5, 'high', 6),
  ('11111111-1111-1111-1111-111111111102', 'اختبار داخلي', 'جودة', 3, 'medium', 7),
  ('11111111-1111-1111-1111-111111111102', 'نشر على Vercel', 'نشر', 1, 'medium', 8),
  ('11111111-1111-1111-1111-111111111102', 'مراجعة الأمان', 'جودة', 2, 'high', 9),
  ('11111111-1111-1111-1111-111111111102', 'تسليم النسخة الأولى', 'تسليم', 1, 'critical', 10)
ON CONFLICT DO NOTHING;

-- ============================================================
-- مهام قالب: تقرير إعلامي
-- ============================================================
INSERT INTO task_templates (template_id, title, category, default_duration_days, default_priority, sort_order) VALUES
  ('11111111-1111-1111-1111-111111111103', 'تحديد الموضوع والزاوية', 'تخطيط', 1, 'high', 1),
  ('11111111-1111-1111-1111-111111111103', 'جمع المعلومات والمصادر', 'بحث', 3, 'high', 2),
  ('11111111-1111-1111-1111-111111111103', 'إجراء المقابلات', 'إنتاج', 3, 'medium', 3),
  ('11111111-1111-1111-1111-111111111103', 'كتابة المسودة الأولى', 'كتابة', 2, 'high', 4),
  ('11111111-1111-1111-1111-111111111103', 'المراجعة التحريرية', 'تحرير', 2, 'high', 5),
  ('11111111-1111-1111-1111-111111111103', 'تصميم الإنفوغرافيك', 'تصميم', 2, 'medium', 6),
  ('11111111-1111-1111-1111-111111111103', 'النشر والتوزيع', 'نشر', 1, 'high', 7)
ON CONFLICT DO NOTHING;

-- ============================================================
-- مهام قالب: حملة تسويقية
-- ============================================================
INSERT INTO task_templates (template_id, title, category, default_duration_days, default_priority, sort_order) VALUES
  ('11111111-1111-1111-1111-111111111104', 'تحديد الهدف والجمهور', 'تخطيط', 2, 'high', 1),
  ('11111111-1111-1111-1111-111111111104', 'بناء استراتيجية المحتوى', 'تسويق', 3, 'high', 2),
  ('11111111-1111-1111-1111-111111111104', 'إنتاج المحتوى المرئي', 'إنتاج', 5, 'high', 3),
  ('11111111-1111-1111-1111-111111111104', 'جدولة ونشر المحتوى', 'نشر', 2, 'medium', 4),
  ('11111111-1111-1111-1111-111111111104', 'إدارة الإعلانات المدفوعة', 'تسويق', 7, 'medium', 5),
  ('11111111-1111-1111-1111-111111111104', 'قياس النتائج والتحليل', 'تحليل', 3, 'high', 6),
  ('11111111-1111-1111-1111-111111111104', 'تقرير نهائي', 'تقرير', 2, 'medium', 7)
ON CONFLICT DO NOTHING;

-- ============================================================
-- مهام قالب: فعالية
-- ============================================================
INSERT INTO task_templates (template_id, title, category, default_duration_days, default_priority, sort_order) VALUES
  ('11111111-1111-1111-1111-111111111105', 'تحديد أهداف الفعالية', 'تخطيط', 1, 'high', 1),
  ('11111111-1111-1111-1111-111111111105', 'حجز المكان والتاريخ', 'لوجستيات', 3, 'critical', 2),
  ('11111111-1111-1111-1111-111111111105', 'دعوة المتحدثين والضيوف', 'تواصل', 5, 'high', 3),
  ('11111111-1111-1111-1111-111111111105', 'التسويق والترويج', 'تسويق', 7, 'high', 4),
  ('11111111-1111-1111-1111-111111111105', 'إعداد المواد والهدايا', 'لوجستيات', 4, 'medium', 5),
  ('11111111-1111-1111-1111-111111111105', 'التجهيز اليوم السابق', 'تنفيذ', 1, 'high', 6),
  ('11111111-1111-1111-1111-111111111105', 'إدارة يوم الفعالية', 'تنفيذ', 1, 'critical', 7),
  ('11111111-1111-1111-1111-111111111105', 'تقرير ما بعد الفعالية', 'تقرير', 3, 'medium', 8)
ON CONFLICT DO NOTHING;

-- ============================================================
-- مهام قالب: مشروع بحثي
-- ============================================================
INSERT INTO task_templates (template_id, title, category, default_duration_days, default_priority, sort_order) VALUES
  ('11111111-1111-1111-1111-111111111106', 'تحديد سؤال البحث', 'تخطيط', 2, 'high', 1),
  ('11111111-1111-1111-1111-111111111106', 'مراجعة الأدبيات', 'بحث', 7, 'high', 2),
  ('11111111-1111-1111-1111-111111111106', 'تصميم منهجية البحث', 'منهجية', 3, 'high', 3),
  ('11111111-1111-1111-1111-111111111106', 'جمع البيانات', 'بيانات', 10, 'high', 4),
  ('11111111-1111-1111-1111-111111111106', 'تحليل البيانات', 'تحليل', 7, 'high', 5),
  ('11111111-1111-1111-1111-111111111106', 'كتابة النتائج', 'كتابة', 5, 'high', 6),
  ('11111111-1111-1111-1111-111111111106', 'المراجعة والتدقيق', 'جودة', 3, 'medium', 7),
  ('11111111-1111-1111-1111-111111111106', 'النشر والتوزيع', 'نشر', 2, 'medium', 8)
ON CONFLICT DO NOTHING;

-- ============================================================
-- Project form templates
-- ============================================================
INSERT INTO project_form_templates (
  id,
  name,
  description,
  category,
  stage,
  applies_to_path,
  template_kind,
  schema_json,
  source_file_path,
  sort_order
) VALUES
(
  '22222222-2222-2222-2222-222222222201',
  'ميثاق المشروع',
  'نموذج تأسيس المشروع وتوثيق النطاق والأهداف والميزانية والمسؤوليات.',
  'عام',
  'بدء المشروع',
  NULL,
  'hybrid',
  $${
    "version": 1,
    "title": "ميثاق المشروع",
    "sections": [
      {
        "id": "project_identity",
        "title": "بيانات المشروع",
        "fields": [
          {"id": "project_name", "label": "اسم المشروع", "type": "text", "required": true, "prefill": "project.name"},
          {"id": "contract_date", "label": "تاريخ الاتفاق", "type": "date"},
          {"id": "client", "label": "الجهة المستفيدة", "type": "text"},
          {"id": "project_unit", "label": "الوحدة/الإدارة المالكة", "type": "text"},
          {"id": "project_summary", "label": "وصف مختصر", "type": "textarea", "required": true}
        ]
      },
      {
        "id": "scope_goals",
        "title": "النطاق والأهداف",
        "fields": [
          {"id": "goals", "label": "الأهداف الرئيسية", "type": "textarea", "required": true},
          {"id": "deliverables", "label": "المخرجات المتوقعة", "type": "textarea"},
          {"id": "beneficiaries", "label": "المستفيدون", "type": "textarea"},
          {"id": "constraints", "label": "القيود والمخاطر الأولية", "type": "textarea"}
        ]
      },
      {
        "id": "budget_schedule",
        "title": "الجدول والميزانية",
        "fields": [
          {"id": "start_date", "label": "تاريخ البدء", "type": "date", "prefill": "project.start_date"},
          {"id": "end_date", "label": "تاريخ الانتهاء", "type": "date", "prefill": "project.end_date"},
          {"id": "budget", "label": "ميزانية المشروع", "type": "number", "prefill": "project.total_budget"},
          {"id": "operating_costs", "label": "تكاليف تشغيلية متوقعة", "type": "number"},
          {"id": "cost_authorities", "label": "صلاحيات الصرف والاعتماد", "type": "textarea"}
        ]
      },
      {
        "id": "team_signatures",
        "title": "الفريق والاعتمادات",
        "fields": [
          {"id": "team", "label": "فريق المشروع", "type": "table", "columns": [
            {"id": "name", "label": "الاسم", "type": "text"},
            {"id": "role", "label": "الدور", "type": "text"},
            {"id": "responsibility", "label": "المسؤولية", "type": "textarea"}
          ]},
          {"id": "approval_notes", "label": "ملاحظات الاعتماد", "type": "textarea"}
        ]
      }
    ]
  }$$::jsonb,
  'نماذج إدارة المشاريع/ميثاق المشروع.docx',
  10
),
(
  '22222222-2222-2222-2222-222222222202',
  'SLA اتفاقية مستوى الخدمة',
  'نموذج اتفاقية مستوى الخدمة وحدود التواصل والتصعيد والاعتمادات.',
  'اتفاقية',
  'التخطيط',
  NULL,
  'hybrid',
  $${
    "version": 1,
    "title": "SLA اتفاقية مستوى الخدمة",
    "sections": [
      {"id": "parties", "title": "الأطراف ونقاط التواصل", "fields": [
        {"id": "provider", "label": "مقدم الخدمة", "type": "text", "required": true},
        {"id": "client", "label": "المستفيد", "type": "text", "required": true},
        {"id": "contacts", "label": "مصفوفة التواصل", "type": "table", "columns": [
          {"id": "topic", "label": "البند", "type": "text"},
          {"id": "to", "label": "إلى", "type": "people"},
          {"id": "cc", "label": "نسخة", "type": "people"},
          {"id": "response_time", "label": "زمن الاستجابة", "type": "text"}
        ]}
      ]},
      {"id": "services", "title": "نطاق الخدمة", "fields": [
        {"id": "service_description", "label": "وصف الخدمة", "type": "textarea", "required": true},
        {"id": "deliverables", "label": "المخرجات المشمولة", "type": "textarea"},
        {"id": "excluded_items", "label": "خارج النطاق", "type": "textarea"}
      ]},
      {"id": "governance", "title": "الحوكمة والتصعيد", "fields": [
        {"id": "approval_flow", "label": "آلية الاعتماد", "type": "textarea"},
        {"id": "escalation_flow", "label": "آلية التصعيد", "type": "textarea"},
        {"id": "risks", "label": "المخاطر والافتراضات", "type": "textarea"},
        {"id": "signatures", "label": "الأطراف المعتمدة", "type": "table", "columns": [
          {"id": "name", "label": "الاسم", "type": "text"},
          {"id": "title", "label": "الصفة", "type": "text"},
          {"id": "date", "label": "التاريخ", "type": "date"}
        ]}
      ]}
    ]
  }$$::jsonb,
  'نماذج إدارة المشاريع/SLA اتفاقية مستوى الخدمة.docx',
  20
),
(
  '22222222-2222-2222-2222-222222222203',
  'RACI Matrix',
  'مصفوفة أدوار ومسؤوليات المشروع.',
  'مصفوفة',
  'التخطيط',
  NULL,
  'xlsx',
  $${
    "version": 1,
    "title": "RACI Matrix",
    "sections": [
      {"id": "matrix", "title": "مصفوفة المسؤوليات", "fields": [
        {"id": "raci_rows", "label": "الأنشطة والمسؤوليات", "type": "table", "required": true, "columns": [
          {"id": "activity", "label": "النشاط/المخرج", "type": "text"},
          {"id": "responsible", "label": "Responsible", "type": "people"},
          {"id": "accountable", "label": "Accountable", "type": "people"},
          {"id": "consulted", "label": "Consulted", "type": "people"},
          {"id": "informed", "label": "Informed", "type": "people"},
          {"id": "notes", "label": "ملاحظات", "type": "textarea"}
        ]}
      ]}
    ]
  }$$::jsonb,
  'نماذج إدارة المشاريع/RACI-matrix.xlsx',
  30
),
(
  '22222222-2222-2222-2222-222222222204',
  'خطة التدريب',
  'نموذج تخطيط البرامج التدريبية والتكلفة والاعتمادات.',
  'تدريب',
  'التدريب',
  'training',
  'form',
  $${
    "version": 1,
    "title": "خطة التدريب",
    "sections": [
      {"id": "training_plan", "title": "برامج التدريب", "fields": [
        {"id": "programs", "label": "قائمة البرامج", "type": "table", "required": true, "columns": [
          {"id": "program_name", "label": "اسم البرنامج", "type": "text"},
          {"id": "training_type", "label": "نوع التدريب", "type": "select", "options": [{"label": "داخلي", "value": "internal"}, {"label": "خارجي", "value": "external"}]},
          {"id": "provider", "label": "الجهة المنفذة", "type": "text"},
          {"id": "start_date", "label": "تاريخ البداية", "type": "date"},
          {"id": "end_date", "label": "تاريخ النهاية", "type": "date"},
          {"id": "hours", "label": "عدد الساعات", "type": "number"},
          {"id": "estimated_cost", "label": "التكلفة التقديرية", "type": "number"},
          {"id": "priority", "label": "الأولوية", "type": "select", "options": [{"label": "عالية", "value": "high"}, {"label": "متوسطة", "value": "medium"}, {"label": "منخفضة", "value": "low"}]},
          {"id": "approval_status", "label": "حالة الاعتماد", "type": "select", "options": [{"label": "مسودة", "value": "draft"}, {"label": "معتمد", "value": "approved"}, {"label": "مؤجل", "value": "deferred"}]},
          {"id": "notes", "label": "ملاحظات", "type": "textarea"}
        ]}
      ]}
    ]
  }$$::jsonb,
  NULL,
  40
),
(
  '22222222-2222-2222-2222-222222222205',
  'متابعة التدريب',
  'نموذج متابعة تنفيذ البرامج التدريبية والحضور والشهادات.',
  'تدريب',
  'التدريب',
  'training',
  'form',
  $${
    "version": 1,
    "title": "متابعة التدريب",
    "sections": [
      {"id": "training_tracking", "title": "متابعة التنفيذ", "fields": [
        {"id": "sessions", "label": "الجلسات والبرامج المنفذة", "type": "table", "required": true, "columns": [
          {"id": "program", "label": "البرنامج", "type": "text"},
          {"id": "provider", "label": "الجهة المنفذة", "type": "text"},
          {"id": "session_date", "label": "تاريخ الجلسة", "type": "date"},
          {"id": "duration", "label": "المدة بالساعات", "type": "number"},
          {"id": "attendance", "label": "عدد الحضور", "type": "number"},
          {"id": "total_invited", "label": "إجمالي المدعوين", "type": "number"},
          {"id": "implementation_status", "label": "حالة التنفيذ", "type": "select", "options": [{"label": "مخطط", "value": "planned"}, {"label": "منفذ", "value": "done"}, {"label": "ملغي", "value": "cancelled"}]},
          {"id": "certificate_status", "label": "الشهادات", "type": "select", "options": [{"label": "غير مطلوبة", "value": "not_required"}, {"label": "قيد الإصدار", "value": "pending"}, {"label": "تم الإصدار", "value": "issued"}]},
          {"id": "notes", "label": "ملاحظات", "type": "textarea"}
        ]}
      ]}
    ]
  }$$::jsonb,
  NULL,
  50
),
(
  '22222222-2222-2222-2222-222222222206',
  'تقييم التدريب',
  'نموذج تقييم أثر البرامج التدريبية وجودة المحتوى والتطبيق العملي.',
  'تدريب',
  'التدريب',
  'training',
  'form',
  $${
    "version": 1,
    "title": "تقييم التدريب",
    "sections": [
      {"id": "training_evaluation", "title": "تقييم المتدربين", "fields": [
        {"id": "evaluations", "label": "تقييمات البرامج", "type": "table", "required": true, "columns": [
          {"id": "employee_name", "label": "اسم الموظف", "type": "text"},
          {"id": "program", "label": "البرنامج", "type": "text"},
          {"id": "provider", "label": "الجهة المنفذة", "type": "text"},
          {"id": "benefit", "label": "درجة الاستفادة", "type": "rating"},
          {"id": "content_quality", "label": "جودة المحتوى", "type": "rating"},
          {"id": "applied_skills", "label": "قابلية التطبيق", "type": "select", "options": [{"label": "عالية", "value": "high"}, {"label": "متوسطة", "value": "medium"}, {"label": "منخفضة", "value": "low"}]},
          {"id": "general_rating", "label": "التقييم العام", "type": "rating"},
          {"id": "suggestions", "label": "مقترحات التحسين", "type": "textarea"}
        ]}
      ]}
    ]
  }$$::jsonb,
  NULL,
  60
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  stage = EXCLUDED.stage,
  applies_to_path = EXCLUDED.applies_to_path,
  template_kind = EXCLUDED.template_kind,
  schema_json = EXCLUDED.schema_json,
  source_file_path = EXCLUDED.source_file_path,
  active = TRUE,
  sort_order = EXCLUDED.sort_order,
  updated_at = NOW();
