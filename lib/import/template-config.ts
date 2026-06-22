export type ImportTemplateType = "projects" | "tasks-existing" | "tasks-multi";

export interface ImportTemplateConfig {
  type: ImportTemplateType;
  filename: string;
  title: string;
  columns: string[];
  sample: Record<string, string | number>;
  instructions: string[];
}

export const IMPORT_TEMPLATE_CONFIGS: Record<ImportTemplateType, ImportTemplateConfig> = {
  projects: {
    type: "projects",
    filename: "samawah-projects-import-template.xlsx",
    title: "استيراد المشاريع",
    columns: [
      "Project_ID",
      "Name",
      "Project_Type",
      "Manager",
      "Project_Path",
      "Current_Stage",
      "Start_Date",
      "End_Date",
      "Total_Budget",
      "Description",
    ],
    sample: {
      Project_ID: "PRJ-001",
      Name: "مشروع تجريبي",
      Project_Type: "مشروع داخلي",
      Manager: "اسم مدير المشروع",
      Project_Path: "مسار المشروع",
      Current_Stage: "مرحلة التنفيذ",
      Start_Date: "2026-06-01",
      End_Date: "2026-06-30",
      Total_Budget: 25000,
      Description: "وصف مختصر للمشروع",
    },
    instructions: [
      "احفظ الملف بصيغة CSV بعد تعبئة البيانات إذا كنت سترفعه من شاشة الاستيراد الحالية.",
      "عمود Project_ID يستخدم لتحديث نفس المشروع عند إعادة الاستيراد.",
      "نوع المشروع يقبل: مشروع داخلي، داخلي، internal، مشروع خارجي، خارجي، external.",
      "اسم المدير يجب أن يطابق اسم مستخدم موجود قدر الإمكان.",
    ],
  },
  "tasks-existing": {
    type: "tasks-existing",
    filename: "samawah-tasks-existing-project-template.xlsx",
    title: "استيراد مهام داخل مشروع موجود",
    columns: [
      "Task_ID",
      "Task",
      "Sub_Task",
      "Category",
      "Status",
      "Owner",
      "Start_Date",
      "End_Date",
      "Cost",
      "Quantity_Total",
      "Quantity_Done",
      "Task_Progress",
      "Alert_Level",
      "Alert_Message",
      "Alert_Action",
    ],
    sample: {
      Task_ID: "TASK-001",
      Task: "مراجعة ملف التقارير",
      Sub_Task: "فحص الروابط الفاشلة",
      Category: "تشغيل",
      Status: "قيد التنفيذ",
      Owner: "اسم المسؤول",
      Start_Date: "2026-06-22",
      End_Date: "2026-06-24",
      Cost: 0,
      Quantity_Total: 100,
      Quantity_Done: 25,
      Task_Progress: "25%",
      Alert_Level: "Medium",
      Alert_Message: "",
      Alert_Action: "",
    },
    instructions: [
      "استخدم هذا القالب عندما تريد إضافة كل المهام إلى مشروع واحد تختاره من شاشة الاستيراد.",
      "لا تضف عمود Project_ID في هذا القالب؛ المنصة ستربط كل الصفوف بالمشروع المختار.",
      "عمود Task_ID مهم لتحديث نفس المهمة عند إعادة الاستيراد وتجنب التكرار.",
      "الحالة تقبل العربية أو الإنجليزية مثل: لم تبدأ، قيد التنفيذ، مراجعة، مكتملة.",
    ],
  },
  "tasks-multi": {
    type: "tasks-multi",
    filename: "samawah-tasks-multi-project-template.xlsx",
    title: "استيراد مهام موزعة على مشاريع",
    columns: [
      "Task_ID",
      "Project_ID",
      "Task",
      "Sub_Task",
      "Category",
      "Status",
      "Owner",
      "Start_Date",
      "End_Date",
      "Cost",
      "Quantity_Total",
      "Quantity_Done",
      "Task_Progress",
      "Alert_Level",
      "Alert_Message",
      "Alert_Action",
    ],
    sample: {
      Task_ID: "TASK-001",
      Project_ID: "PRJ-001",
      Task: "تجهيز ملف الرفع",
      Sub_Task: "تنظيف البيانات",
      Category: "استيراد",
      Status: "لم تبدأ",
      Owner: "اسم المسؤول",
      Start_Date: "2026-06-22",
      End_Date: "2026-06-25",
      Cost: 0,
      Quantity_Total: 10,
      Quantity_Done: 0,
      Task_Progress: "0%",
      Alert_Level: "Low",
      Alert_Message: "",
      Alert_Action: "",
    },
    instructions: [
      "استخدم هذا القالب عندما يحتوي الملف على مهام لأكثر من مشروع.",
      "يجب أن يطابق Project_ID معرف مشروع موجود في المنصة.",
      "عمود Task_ID مهم لتحديث نفس المهمة عند إعادة الاستيراد وتجنب التكرار.",
      "إذا كانت كل المهام لمشروع واحد فالأفضل استخدام قالب مهام داخل مشروع موجود.",
    ],
  },
};

export function getImportTemplateConfig(type: string | null): ImportTemplateConfig {
  if (type === "tasks-existing" || type === "tasks-multi" || type === "projects") {
    return IMPORT_TEMPLATE_CONFIGS[type];
  }

  return IMPORT_TEMPLATE_CONFIGS.projects;
}
