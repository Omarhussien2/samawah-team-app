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

-- ============================================================
-- KPI Center definitions: مؤشرات سماوة 2026
-- Source: مؤشرات سماوة 2026 (1).pptx
-- ============================================================
INSERT INTO kpi_definitions (
  code,
  name,
  description,
  perspective,
  strategic_goal,
  measurement_label,
  target_value,
  target_text,
  target_unit,
  direction,
  calculation_method,
  auto_source,
  frequency,
  visibility,
  sort_order
) VALUES
  ('REV_GOV_ANNUAL', 'المستهدف المالي السنوي الحكومي', 'مساهمة الإيرادات الحكومية في مستهدف 2026.', 'الإيرادات', 'الإيرادات المالية', 'الإيرادات الحكومية', 2200000, '2,200,000', 'ريال', 'higher_is_better', 'manual', NULL, 'monthly', 'management', 10),
  ('REV_NON_GOV', 'إيرادات غير حكومية', 'مساهمة الإيرادات غير الحكومية في مستهدف 2026.', 'الإيرادات', 'الإيرادات المالية', 'إيرادات غير حكومية', 1000000, '1,000,000', 'ريال', 'higher_is_better', 'manual', NULL, 'monthly', 'management', 20),
  ('REV_PRODUCTS', 'منتجات', 'مساهمة إيرادات المنتجات في مستهدف 2026.', 'الإيرادات', 'الإيرادات المالية', 'إيرادات المنتجات', 800000, '800,000', 'ريال', 'higher_is_better', 'manual', NULL, 'monthly', 'management', 30),

  ('CLIENT_STRATEGIC', 'عملاء نوعيين', 'استقطاب جهة حكومية أو مشروع مليوني.', 'العقود والعملاء', 'استقطاب العملاء', 'عملاء نوعيين', 1, '1 عميل', 'عميل', 'higher_is_better', 'manual', NULL, 'monthly', 'management', 110),
  ('CLIENT_NEW', 'كسب عملاء جدد', 'عدد العملاء الجدد خلال 2026.', 'العقود والعملاء', 'استقطاب العملاء', 'عملاء جدد', 10, '10 عملاء', 'عميل', 'higher_is_better', 'manual', NULL, 'monthly', 'management', 120),
  ('CLIENT_PROPOSALS', 'التقديم على الجهات بعروض فنية ومالية', 'عدد العروض الفنية والمالية المقدمة للجهات.', 'العقود والعملاء', 'تنمية الفرص', 'العروض المقدمة', 55, '55 عرض', 'عرض', 'higher_is_better', 'manual', NULL, 'monthly', 'management', 130),
  ('CLIENT_SATISFACTION', 'نسبة رضا العملاء', 'متوسط رضا العملاء عن الخدمات والمخرجات.', 'العقود والعملاء', 'الاحتفاظ بالعملاء', 'رضا العملاء', 86, '86%', '%', 'higher_is_better', 'manual', NULL, 'monthly', 'management', 140),
  ('CLIENT_REPEAT', 'عميل متكرر', 'عدد العملاء المتكررين.', 'العقود والعملاء', 'الاحتفاظ بالعملاء', 'عملاء متكررون', 2, '2', 'عميل', 'higher_is_better', 'manual', NULL, 'monthly', 'management', 150),

  ('AUD_YOUTUBE_SUBS', 'إجمالي عدد مشتركي يوتيوب', 'إجمالي مشتركي قناة يوتيوب.', 'الجمهور والمشتركين', 'الاشتراكات', 'مشتركو يوتيوب', 250000, '250,000 مشترك', 'مشترك', 'higher_is_better', 'manual', NULL, 'monthly', 'management', 210),
  ('AUD_OTHER_PLATFORM_SUBS', 'إجمالي عدد مشتركي باقي المنصات', 'إجمالي المشتركين في المنصات الأخرى.', 'الجمهور والمشتركين', 'الاشتراكات', 'مشتركو باقي المنصات', 100000, '100,000 مشترك', 'مشترك', 'higher_is_better', 'manual', NULL, 'monthly', 'management', 220),
  ('AUD_PAID_VIEWS', 'متوسط المشاهدات بالترويج المدفوع للحلقة الواحدة', 'متوسط مشاهدات الحلقة عند استخدام الترويج المدفوع.', 'الجمهور والمشتركين', 'الوصول', 'مشاهدات مدفوعة', 90000, '90,000 مشاهدة', 'مشاهدة', 'higher_is_better', 'manual', NULL, 'monthly', 'management', 230),
  ('AUD_ORGANIC_VIEWS', 'متوسط المشاهدات بدون ترويج للحلقة الواحدة', 'متوسط مشاهدات الحلقة بدون ترويج وبالأدوات التسويقية.', 'الجمهور والمشتركين', 'الوصول', 'مشاهدات عضوية', 10000, '10,000 مشاهدة', 'مشاهدة', 'higher_is_better', 'manual', NULL, 'monthly', 'management', 240),
  ('AUD_INFLUENCER_REACH', 'إجمالي عدد متابعين المؤثرين المتعاون معهم', 'حجم الوصول من المؤثرين المتعاون معهم.', 'الجمهور والمشتركين', 'الوصول', 'متابعو المؤثرين', 5000000, '5,000,000 متابع', 'متابع', 'higher_is_better', 'manual', NULL, 'monthly', 'management', 250),
  ('AUD_TOP_EPISODE', 'كسر حاجز الحد الأعلى لمشاهدة الحلقة الواحدة', 'أعلى عدد مشاهدات لحلقة واحدة.', 'الجمهور والمشتركين', 'الوصول', 'أعلى مشاهدة للحلقة', 1000000, '1,000,000 مشاهدة', 'مشاهدة', 'higher_is_better', 'manual', NULL, 'monthly', 'management', 260),

  ('OPS_CPI', 'معدل CPI المحقق', 'متوسط مؤشر كفاءة التكلفة للمشاريع.', 'العمليات والمشاريع', 'الأداء والفعالية', 'CPI', 1, 'متوسط 1', 'مؤشر', 'higher_is_better', 'semi_auto', 'project_performance_updates', 'monthly', 'team', 310),
  ('OPS_SPI', 'معدل SPI المحقق', 'متوسط مؤشر كفاءة الجدول الزمني للمشاريع.', 'العمليات والمشاريع', 'الأداء والفعالية', 'SPI', 0.85, 'متوسط ≥ 0.85', 'مؤشر', 'higher_is_better', 'semi_auto', 'project_performance_updates', 'monthly', 'team', 320),
  ('OPS_UPDATED_REPORTS', 'نسبة المشاريع التي لديها تقارير أداء محدثة', 'نسبة المشاريع التي لديها تقارير أداء حديثة.', 'العمليات والمشاريع', 'الانضباط الإداري', 'تقارير أداء محدثة', 80, '80%', '%', 'higher_is_better', 'semi_auto', 'project_performance_updates', 'monthly', 'team', 330),
  ('OPS_ISO_21500', 'نسبة امتثال ISO 21500', 'نسبة الامتثال لمعيار ISO 21500.', 'العمليات والمشاريع', 'الانضباط الإداري', 'ISO 21500', 70, 'نسبة امتثال 70%', '%', 'higher_is_better', 'manual', NULL, 'quarterly', 'team', 340),
  ('OPS_AUTOMATION_TOOLS', 'أتمتة العمليات الداخلية وبناء حلول إدارية', 'عدد أدوات الأتمتة والحلول الإدارية المبنية.', 'العمليات والمشاريع', 'التحول الرقمي', 'أدوات الأتمتة', 4, '4 أدوات', 'أداة', 'higher_is_better', 'manual', NULL, 'quarterly', 'team', 350),
  ('OPS_PM_COMPLIANCE', 'نسبة الامتثال لمنهجيات إدارة المشاريع', 'مدى تطبيق منهجيات إدارة المشاريع.', 'العمليات والمشاريع', 'التحول الرقمي', 'امتثال المنهجيات', 85, '85%', '%', 'higher_is_better', 'manual', NULL, 'quarterly', 'team', 360),
  ('OPS_INTERNAL_TRAINING', 'التدريب والتطوير الداخلي', 'ساعات التدريب الداخلي لكل موظف.', 'العمليات والمشاريع', 'الفريق وبناء القدرات', 'تدريب داخلي', 90, '90 ساعة للموظف', 'ساعة/موظف', 'higher_is_better', 'manual', NULL, 'quarterly', 'team', 370),
  ('OPS_EXTERNAL_TRAINING', 'التدريب والتطوير الخارجي', 'ساعات التدريب الخارجي لكل موظف.', 'العمليات والمشاريع', 'الفريق وبناء القدرات', 'تدريب خارجي', 20, '20 ساعة للموظف', 'ساعة/موظف', 'higher_is_better', 'manual', NULL, 'quarterly', 'team', 380),
  ('OPS_PROGRAM_INTEGRATION', 'التكامل بين البرامج', 'نسبة البرامج التي بينها تكامل تشغيلي.', 'العمليات والمشاريع', 'التكامل والأنظمة', 'تكامل البرامج', 30, '30% من البرامج', '%', 'higher_is_better', 'manual', NULL, 'quarterly', 'team', 390),
  ('OPS_REVISION_ROUNDS', 'متوسط عدد جولات التعديلات', 'متوسط جولات التعديلات لكل مشروع.', 'العمليات والمشاريع', 'إدارة المخاطر', 'جولات التعديلات', 2, '<2 للمشروع', 'جولة/مشروع', 'lower_is_better', 'manual', NULL, 'monthly', 'team', 400),
  ('OPS_RISK_COVERAGE', 'مؤشر إدارة المخاطر', 'نسبة تغطية المخاطر وإدارتها.', 'العمليات والمشاريع', 'إدارة المخاطر', 'تغطية المخاطر', 80, '80%', '%', 'higher_is_better', 'manual', NULL, 'monthly', 'team', 410),

  ('SERV_PODCAST', 'إنتاج بودكاست', 'عدد حلقات البودكاست المنتجة.', 'البرامج والخدمات', 'البرامج المرئية', 'حلقات بودكاست', 30, '30 حلقة', 'حلقة', 'higher_is_better', 'manual', NULL, 'monthly', 'team', 510),
  ('SERV_YOUTUBE_PROGRAMS', 'برنامج يوتيوب معرفي', 'عدد برامج يوتيوب المعرفية والحلقات التابعة لها.', 'البرامج والخدمات', 'البرامج المرئية', 'برامج يوتيوب معرفية', 2, '2 برامج بعدد 10 حلقات', 'برنامج', 'higher_is_better', 'manual', NULL, 'monthly', 'team', 520),
  ('SERV_MEDIA_REPORTS', 'التقارير الإعلامية', 'عدد التقارير الإعلامية المكتوبة.', 'البرامج والخدمات', 'البرامج المكتوبة', 'تقارير إعلامية', 4, '4', 'تقرير', 'higher_is_better', 'manual', NULL, 'monthly', 'team', 530),

  ('PROD_DIGITAL_PRODUCTS', 'بناء وإطلاق منتجات رقمية', 'عدد المنتجات الرقمية التي تم بناؤها وإطلاقها.', 'المنتجات', 'البرامج والخدمات', 'منتجات رقمية', 2, '2 منتج', 'منتج', 'higher_is_better', 'semi_auto', 'indicator_products', 'quarterly', 'project_managers', 610),
  ('PROD_HUDNA_MAGAZINE', 'مجلة هدنة', 'عدد مبيعات مجلة هدنة.', 'المنتجات', 'البرامج والخدمات', 'مبيعات مجلة هدنة', 4000, '4000 بيع', 'بيع', 'higher_is_better', 'semi_auto', 'indicator_products', 'monthly', 'project_managers', 620),
  ('PROD_TAQREERAK', 'منصة تقريرك', 'عدد مشتركي منصة تقريرك.', 'المنتجات', 'البرامج والخدمات', 'مشتركو منصة تقريرك', 5000, '5000 مشترك', 'مشترك', 'higher_is_better', 'semi_auto', 'indicator_products', 'monthly', 'project_managers', 630),
  ('PROD_OTHER_DIGITAL_PLATFORMS', 'المنصات الرقمية الأخرى', 'عدد مشتركي المنصات الرقمية الأخرى.', 'المنتجات', 'البرامج والخدمات', 'مشتركو المنصات الأخرى', 2000, '2000 مشترك', 'مشترك', 'higher_is_better', 'semi_auto', 'indicator_products', 'monthly', 'project_managers', 640),
  ('PROD_JLAS_MEETINGS', 'جلاس – عدد اللقاءات', 'عدد لقاءات منتج جلاس.', 'المنتجات', 'البرامج والخدمات', 'لقاءات جلاس', 10, '10', 'لقاء', 'higher_is_better', 'semi_auto', 'indicator_products', 'monthly', 'project_managers', 650),
  ('PROD_STATIONERY_SALES', 'منتجات قرطاسية للمتجر', 'مبيعات المنتجات القرطاسية للمتجر.', 'المنتجات', 'البرامج والخدمات', 'مبيعات قرطاسية', 250, '250 بيع', 'بيع', 'higher_is_better', 'semi_auto', 'indicator_products', 'monthly', 'project_managers', 660),

  ('PART_AWARDS', 'الترشح لجوائز', 'عدد الجوائز التي يتم الترشح لها.', 'الشراكات والتموضع', 'التموضع والتوسع', 'الجوائز', 2, '2', 'ترشيح', 'higher_is_better', 'manual', NULL, 'quarterly', 'management', 710),
  ('PART_SPONSORSHIPS', 'الرعايات للجهات', 'رعاية فعاليات حكومية أو بارزة.', 'الشراكات والتموضع', 'التموضع والتوسع', 'رعايات الجهات', 2, '2', 'رعاية', 'higher_is_better', 'manual', NULL, 'quarterly', 'management', 720),
  ('PART_EVENTS', 'الحضور والمشاركة', 'التواجد في معارض ومؤتمرات.', 'الشراكات والتموضع', 'التموضع والتوسع', 'المعارض والمؤتمرات', 3, '3', 'مشاركة', 'higher_is_better', 'manual', NULL, 'quarterly', 'management', 730),
  ('PART_PRODUCT_SPONSORS', 'رعايات المنتجات', 'استقطاب رعاة لمنتجات سماوة.', 'الشراكات والتموضع', 'التموضع والتوسع', 'رعاة المنتجات', 10, '10', 'راعٍ', 'higher_is_better', 'manual', NULL, 'quarterly', 'management', 740),
  ('PART_INTEGRATIONS', 'الشراكات والتكامل في الخدمات الفنية', 'عدد الشراكات والتكاملات مع الجهات.', 'الشراكات والتموضع', 'التموضع والتوسع', 'شراكات وتكاملات', 5, '5', 'شراكة', 'higher_is_better', 'manual', NULL, 'quarterly', 'management', 750),
  ('PART_SPEAKING', 'التحدث واللقاءات', 'مشاركة أعضاء الفريق كمتحدثين في مناسبات.', 'الشراكات والتموضع', 'التموضع والتوسع', 'مشاركات تحدث', 4, '4', 'مشاركة', 'higher_is_better', 'manual', NULL, 'quarterly', 'management', 760)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  perspective = EXCLUDED.perspective,
  strategic_goal = EXCLUDED.strategic_goal,
  measurement_label = EXCLUDED.measurement_label,
  target_value = EXCLUDED.target_value,
  target_text = EXCLUDED.target_text,
  target_unit = EXCLUDED.target_unit,
  direction = EXCLUDED.direction,
  calculation_method = EXCLUDED.calculation_method,
  auto_source = EXCLUDED.auto_source,
  frequency = EXCLUDED.frequency,
  visibility = EXCLUDED.visibility,
  active = TRUE,
  sort_order = EXCLUDED.sort_order,
  updated_at = NOW();

INSERT INTO indicator_products (
  kpi_id,
  name,
  category,
  description,
  current_value,
  target_value,
  unit,
  status,
  notes
) VALUES
  ((SELECT id FROM kpi_definitions WHERE code = 'PROD_DIGITAL_PRODUCTS'), 'المنتجات الرقمية الجديدة', 'منتجات رقمية', 'مسار بناء وإطلاق المنتجات الرقمية ضمن خطة 2026.', 0, 2, 'منتج', 'active', 'مرتبط بمؤشر بناء وإطلاق منتجات رقمية'),
  ((SELECT id FROM kpi_definitions WHERE code = 'PROD_HUDNA_MAGAZINE'), 'مجلة هدنة', 'منتجات تحريرية', 'متابعة مبيعات مجلة هدنة.', 0, 4000, 'بيع', 'active', 'مرتبط بمؤشر مبيعات مجلة هدنة'),
  ((SELECT id FROM kpi_definitions WHERE code = 'PROD_TAQREERAK'), 'منصة تقريرك', 'منصات رقمية', 'متابعة مشتركي منصة تقريرك.', 0, 5000, 'مشترك', 'active', 'مرتبط بمؤشر منصة تقريرك'),
  ((SELECT id FROM kpi_definitions WHERE code = 'PROD_OTHER_DIGITAL_PLATFORMS'), 'المنصات الرقمية الأخرى', 'منصات رقمية', 'متابعة مشتركي المنصات الرقمية الأخرى.', 0, 2000, 'مشترك', 'active', 'مرتبط بمؤشر المنصات الرقمية الأخرى'),
  ((SELECT id FROM kpi_definitions WHERE code = 'PROD_JLAS_MEETINGS'), 'جلاس', 'منتجات معرفية', 'متابعة عدد لقاءات منتج جلاس.', 0, 10, 'لقاء', 'active', 'مرتبط بمؤشر لقاءات جلاس'),
  ((SELECT id FROM kpi_definitions WHERE code = 'PROD_STATIONERY_SALES'), 'منتجات قرطاسية للمتجر', 'منتجات متجر', 'متابعة مبيعات المنتجات القرطاسية.', 0, 250, 'بيع', 'active', 'مرتبط بمؤشر مبيعات القرطاسية')
ON CONFLICT (name, kpi_id) DO UPDATE SET
  category = EXCLUDED.category,
  description = EXCLUDED.description,
  target_value = EXCLUDED.target_value,
  unit = EXCLUDED.unit,
  status = EXCLUDED.status,
  notes = EXCLUDED.notes,
  updated_at = NOW();

UPDATE kpi_definitions
SET calculation_method = 'semi_auto', auto_source = 'revenue_entries', updated_at = NOW()
WHERE code IN ('REV_GOV_ANNUAL', 'REV_NON_GOV', 'REV_PRODUCTS');

UPDATE kpi_definitions
SET calculation_method = 'semi_auto', auto_source = 'client_opportunities', updated_at = NOW()
WHERE code IN ('CLIENT_STRATEGIC', 'CLIENT_NEW', 'CLIENT_PROPOSALS', 'CLIENT_SATISFACTION', 'CLIENT_REPEAT');

UPDATE kpi_definitions
SET calculation_method = 'semi_auto', auto_source = 'audience_metrics', updated_at = NOW()
WHERE code IN ('AUD_YOUTUBE_SUBS', 'AUD_OTHER_PLATFORM_SUBS', 'AUD_PAID_VIEWS', 'AUD_ORGANIC_VIEWS', 'AUD_INFLUENCER_REACH', 'AUD_TOP_EPISODE');

UPDATE kpi_definitions
SET calculation_method = 'semi_auto', auto_source = 'service_outputs', updated_at = NOW()
WHERE code IN ('SERV_PODCAST', 'SERV_YOUTUBE_PROGRAMS', 'SERV_MEDIA_REPORTS');

UPDATE kpi_definitions
SET calculation_method = 'semi_auto', auto_source = 'partnership_activities', updated_at = NOW()
WHERE code IN ('PART_AWARDS', 'PART_SPONSORSHIPS', 'PART_EVENTS', 'PART_PRODUCT_SPONSORS', 'PART_INTEGRATIONS', 'PART_SPEAKING');
