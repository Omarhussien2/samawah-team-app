import type { Project } from "@/lib/supabase/types";
import { parseFormSchema, type ProjectFormData } from "./schema";
import type { ProjectFormTemplateWithInstance } from "./types";

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderAnswer(value: unknown) {
  if (Array.isArray(value)) {
    if (value.length === 0) return "<span class='muted'>-</span>";
    return `<pre>${escapeHtml(JSON.stringify(value, null, 2))}</pre>`;
  }
  if (typeof value === "boolean") return value ? "نعم" : "لا";
  return escapeHtml(value || "-");
}

export function buildPrintableHtml(project: Project, form: ProjectFormTemplateWithInstance, data: ProjectFormData) {
  const schema = parseFormSchema(form.template.schema_json);
  const sections = schema.sections
    .map((section) => {
      const fields = section.fields
        .map((field) => `<div class="field"><strong>${escapeHtml(field.label)}</strong><div>${renderAnswer(data[field.key])}</div></div>`)
        .join("");
      return `<section><h2>${escapeHtml(section.title)}</h2>${fields}</section>`;
    })
    .join("");

  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(form.template.name)}</title>
  <style>
    body { font-family: Tahoma, Arial, sans-serif; margin: 32px; color: #0f172a; line-height: 1.7; }
    header { border-bottom: 2px solid #e2e8f0; padding-bottom: 16px; margin-bottom: 24px; }
    h1 { margin: 0 0 8px; font-size: 28px; }
    h2 { font-size: 18px; margin: 24px 0 12px; color: #1e293b; }
    .meta { color: #64748b; font-size: 13px; }
    .field { border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; margin-bottom: 10px; break-inside: avoid; }
    .field strong { display: block; color: #475569; margin-bottom: 4px; }
    pre { white-space: pre-wrap; background: #f8fafc; padding: 10px; border-radius: 8px; direction: ltr; text-align: left; }
    .muted { color: #94a3b8; }
    @media print { body { margin: 18mm; } button { display: none; } }
  </style>
</head>
<body>
  <button onclick="window.print()">طباعة</button>
  <header>
    <h1>${escapeHtml(form.template.name)}</h1>
    <div class="meta">المشروع: ${escapeHtml(project.name)}</div>
    <div class="meta">الحالة: ${escapeHtml(form.statusLabel)}</div>
    <div class="meta">نسبة الإكمال: ${escapeHtml(form.completion)}%</div>
  </header>
  ${sections}
</body>
</html>`;
}

export function downloadHtml(filename: string, html: string) {
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
