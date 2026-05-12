import type { Profile, Project } from "@/lib/supabase/types";
import { parseFormSchema, type ProjectFormData, type ProjectFormField, type ProjectFormSchema, type ProjectFormTableColumn } from "./schema";
import type { ProjectFormTemplateWithInstance } from "./types";

type ExportProfile = Pick<Profile, "id" | "full_name">;

interface FormExportInput {
  project: Project;
  form: ProjectFormTemplateWithInstance;
  data: ProjectFormData;
  profiles?: ExportProfile[];
}

const EXPORT_STYLES = `
  * { box-sizing: border-box; }
  body { margin: 0; background: #f8fafc; color: #0f172a; font-family: Tahoma, Arial, sans-serif; line-height: 1.75; }
  .export-page { width: 210mm; min-height: 297mm; margin: 0 auto; background: #fff; padding: 18mm; direction: rtl; color: #0f172a; font-family: Tahoma, Arial, sans-serif; line-height: 1.75; }
  .doc-header { border-bottom: 2px solid #e2e8f0; padding-bottom: 18px; margin-bottom: 24px; }
  .eyebrow { margin: 0 0 4px; color: #64748b; font-size: 12px; font-weight: 700; }
  h1 { margin: 0 0 16px; font-size: 28px; font-weight: 800; }
  h2 { margin: 24px 0 12px; color: #1e293b; font-size: 18px; font-weight: 800; }
  .meta-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
  .meta-grid div { border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 10px; }
  .meta-grid span { display: block; color: #64748b; font-size: 11px; font-weight: 700; }
  .meta-grid strong { display: block; margin-top: 2px; color: #0f172a; font-size: 13px; }
  .section { break-inside: avoid; margin-top: 16px; }
  .field { border: 1px solid #e2e8f0; border-radius: 10px; margin-bottom: 10px; padding: 12px; break-inside: avoid; }
  .field-label { color: #475569; font-weight: 800; margin-bottom: 6px; }
  .answer-text, .empty-value { white-space: pre-wrap; color: #0f172a; }
  .empty-value { color: #94a3b8; }
  .answer-table { width: 100%; border-collapse: collapse; margin-top: 6px; table-layout: fixed; }
  .answer-table th, .answer-table td { border: 1px solid #cbd5e1; padding: 8px; vertical-align: top; word-break: break-word; }
  .answer-table th { background: #f1f5f9; color: #334155; font-size: 12px; }
  @media print {
    body { background: #fff; }
    .export-page { width: auto; min-height: auto; margin: 0; padding: 14mm; }
  }
`;

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function profileName(value: unknown, profiles: ExportProfile[] = []) {
  const id = String(value ?? "");
  return profiles.find((profile) => profile.id === id)?.full_name ?? id;
}

function primitiveText(value: unknown, profiles: ExportProfile[] = []): string {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "boolean") return value ? "نعم" : "لا";
  if (Array.isArray(value)) return value.length ? value.map((item) => primitiveText(item, profiles)).join("، ") : "-";
  if (typeof value === "object") return Object.values(value).map((item) => primitiveText(item, profiles)).join("، ");
  return String(value);
}

function fieldValueText(field: ProjectFormField | ProjectFormTableColumn, value: unknown, profiles: ExportProfile[] = []) {
  if (field.type === "people") return profileName(value, profiles) || "-";
  return primitiveText(value, profiles);
}

function rowsFromValue(value: unknown) {
  return Array.isArray(value) ? value.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object" && !Array.isArray(row)) : [];
}

function isTableField(field: ProjectFormField) {
  return (field.type === "table" || field.type === "repeater") && (field.columns?.length ?? 0) > 0;
}

function slug(value: string) {
  return value
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-")
    .slice(0, 90) || "project-form";
}

function filename(form: ProjectFormTemplateWithInstance, extension: "pdf" | "docx") {
  return `${slug(form.template.name)}.${extension}`;
}

function renderTableHtml(field: ProjectFormField, rows: Record<string, unknown>[], profiles: ExportProfile[]) {
  const columns = field.columns ?? [];
  if (rows.length === 0) return "<div class=\"empty-value\">-</div>";

  const head = columns.map((column) => `<th>${escapeHtml(column.label)}</th>`).join("");
  const body = rows
    .map((row) => {
      const cells = columns
        .map((column) => `<td>${escapeHtml(fieldValueText(column, row[column.key], profiles))}</td>`)
        .join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");

  return `<table class="answer-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

function renderFieldHtml(field: ProjectFormField, data: ProjectFormData, profiles: ExportProfile[]) {
  const value = data[field.key];
  const answer = isTableField(field)
    ? renderTableHtml(field, rowsFromValue(value), profiles)
    : `<div class="answer-text">${escapeHtml(fieldValueText(field, value, profiles))}</div>`;

  return `<div class="field"><div class="field-label">${escapeHtml(field.label)}</div>${answer}</div>`;
}

function buildExportBody(project: Project, form: ProjectFormTemplateWithInstance, schema: ProjectFormSchema, data: ProjectFormData, profiles: ExportProfile[] = []) {
  const sections = schema.sections
    .map((section) => {
      const fields = section.fields.map((field) => renderFieldHtml(field, data, profiles)).join("");
      return `<section class="section"><h2>${escapeHtml(section.title)}</h2>${fields}</section>`;
    })
    .join("");

  return `
    <header class="doc-header">
      <p class="eyebrow">نموذج مشروع</p>
      <h1>${escapeHtml(form.template.name)}</h1>
      <div class="meta-grid">
        <div><span>المشروع</span><strong>${escapeHtml(project.name)}</strong></div>
        <div><span>الحالة</span><strong>${escapeHtml(form.statusLabel)}</strong></div>
        <div><span>الإكمال</span><strong>${escapeHtml(form.completion)}%</strong></div>
        <div><span>آخر تحديث</span><strong>${escapeHtml(form.updatedAt ? new Date(form.updatedAt).toLocaleDateString("ar") : "-")}</strong></div>
      </div>
    </header>
    ${sections}
  `;
}

export function buildPrintableHtml(project: Project, form: ProjectFormTemplateWithInstance, data: ProjectFormData, profiles: ExportProfile[] = []) {
  const schema = parseFormSchema(form.template.schema_json);
  const page = `<main class="export-page">${buildExportBody(project, form, schema, data, profiles)}</main>`;
  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(form.template.name)}</title>
  <style>${EXPORT_STYLES}</style>
</head>
<body>
  ${page}
</body>
</html>`;
}

function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

function createOffscreenExportElement(project: Project, form: ProjectFormTemplateWithInstance, data: ProjectFormData, profiles: ExportProfile[] = []) {
  const schema = parseFormSchema(form.template.schema_json);
  const wrapper = document.createElement("div");
  wrapper.style.position = "fixed";
  wrapper.style.insetInlineStart = "-10000px";
  wrapper.style.top = "0";
  wrapper.style.width = "794px";
  wrapper.style.background = "#fff";
  wrapper.style.zIndex = "-1";
  wrapper.innerHTML = `<style>${EXPORT_STYLES}</style><main class="export-page">${buildExportBody(project, form, schema, data, profiles)}</main>`;
  document.body.appendChild(wrapper);
  const page = wrapper.querySelector(".export-page");
  if (!(page instanceof HTMLElement)) {
    wrapper.remove();
    throw new Error("Export page could not be created");
  }
  return page;
}

export async function downloadFormPdf({ project, form, data, profiles = [] }: FormExportInput) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ]);

  const element = createOffscreenExportElement(project, form, data, profiles);
  const container = element.parentElement;

  try {
    const canvas = await html2canvas(element, {
      backgroundColor: "#ffffff",
      scale: 2,
      useCORS: true,
      windowWidth: element.scrollWidth,
      windowHeight: element.scrollHeight,
    });

    const pdf = new jsPDF({ orientation: "p", unit: "mm", format: "a4", compress: true });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imageWidth = pageWidth;
    const imageHeight = (canvas.height * imageWidth) / canvas.width;
    const image = canvas.toDataURL("image/jpeg", 0.95);

    let position = 0;
    let remainingHeight = imageHeight;
    pdf.addImage(image, "JPEG", 0, position, imageWidth, imageHeight);
    remainingHeight -= pageHeight;

    while (remainingHeight > 0) {
      position -= pageHeight;
      pdf.addPage();
      pdf.addImage(image, "JPEG", 0, position, imageWidth, imageHeight);
      remainingHeight -= pageHeight;
    }

    pdf.save(filename(form, "pdf"));
  } finally {
    container?.remove();
  }
}

function docxParagraph(docx: typeof import("docx"), text: string, bold = false) {
  return new docx.Paragraph({
    bidirectional: true,
    alignment: docx.AlignmentType.RIGHT,
    spacing: { after: 120 },
    children: [
      new docx.TextRun({
        text,
        bold,
        size: bold ? 24 : 22,
        font: "Arial",
      }),
    ],
  });
}

function docxCell(docx: typeof import("docx"), text: string, bold = false) {
  return new docx.TableCell({
    margins: { top: 120, bottom: 120, left: 120, right: 120 },
    children: [docxParagraph(docx, text, bold)],
  });
}

function docxAnswerTable(docx: typeof import("docx"), field: ProjectFormField, rows: Record<string, unknown>[], profiles: ExportProfile[]) {
  const columns = field.columns ?? [];
  const tableRows = [
    new docx.TableRow({
      tableHeader: true,
      children: columns.map((column) => docxCell(docx, column.label, true)),
    }),
    ...rows.map((row) => new docx.TableRow({
      children: columns.map((column) => docxCell(docx, fieldValueText(column, row[column.key], profiles))),
    })),
  ];

  return new docx.Table({
    width: { size: 100, type: docx.WidthType.PERCENTAGE },
    rows: tableRows,
  });
}

export async function buildFormDocxBlob({ project, form, data, profiles = [] }: FormExportInput) {
  const docx = await import("docx");
  const schema = parseFormSchema(form.template.schema_json);
  const children: (InstanceType<typeof docx.Paragraph> | InstanceType<typeof docx.Table>)[] = [
    new docx.Paragraph({
      bidirectional: true,
      alignment: docx.AlignmentType.RIGHT,
      heading: docx.HeadingLevel.TITLE,
      spacing: { after: 180 },
      children: [new docx.TextRun({ text: form.template.name, bold: true, size: 34, font: "Arial" })],
    }),
    docxParagraph(docx, `المشروع: ${project.name}`, true),
    docxParagraph(docx, `الحالة: ${form.statusLabel}`),
    docxParagraph(docx, `نسبة الإكمال: ${form.completion}%`),
  ];

  for (const section of schema.sections) {
    children.push(new docx.Paragraph({
      bidirectional: true,
      alignment: docx.AlignmentType.RIGHT,
      heading: docx.HeadingLevel.HEADING_1,
      spacing: { before: 220, after: 120 },
      children: [new docx.TextRun({ text: section.title, bold: true, size: 28, font: "Arial" })],
    }));

    for (const field of section.fields) {
      children.push(docxParagraph(docx, field.label, true));
      if (isTableField(field)) {
        const rows = rowsFromValue(data[field.key]);
        children.push(rows.length ? docxAnswerTable(docx, field, rows, profiles) : docxParagraph(docx, "-"));
      } else {
        children.push(docxParagraph(docx, fieldValueText(field, data[field.key], profiles)));
      }
    }
  }

  const document = new docx.Document({
    creator: "Samawah Team App",
    description: `Project form export: ${form.template.name}`,
    title: form.template.name,
    sections: [{
      properties: {
        page: {
          margin: { top: 1000, right: 1000, bottom: 1000, left: 1000 },
        },
      },
      children,
    }],
  });

  return docx.Packer.toBlob(document);
}

export async function downloadFormDocx(input: FormExportInput) {
  const blob = await buildFormDocxBlob(input);
  const { form } = input;
  downloadBlob(blob, filename(form, "docx"));
}
