"use client";

import { Plus, Trash2 } from "lucide-react";
import type { Profile } from "@/lib/supabase/types";
import type { ProjectFormData, ProjectFormField, ProjectFormSchema, ProjectFormTableColumn } from "@/lib/project-forms/schema";

interface Props {
  schema: ProjectFormSchema;
  data: ProjectFormData;
  profiles: Pick<Profile, "id" | "full_name" | "avatar_url">[];
  readOnly?: boolean;
  onChange?: (nextData: ProjectFormData) => void;
}

function updateValue(data: ProjectFormData, key: string, value: unknown) {
  return { ...data, [key]: value };
}

function FieldShell({ field, children }: { field: ProjectFormField; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold text-slate-600">
        {field.label}
        {field.required && <span className="text-red-500"> *</span>}
      </span>
      {children}
    </label>
  );
}

function primitiveInputClass(readOnly?: boolean) {
  return `w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 ${readOnly ? "bg-slate-50 text-slate-600" : ""}`;
}

function renderColumnInput(
  column: ProjectFormTableColumn,
  value: unknown,
  onChange: (value: unknown) => void,
  profiles: Pick<Profile, "id" | "full_name" | "avatar_url">[],
  readOnly?: boolean
) {
  if (column.type === "people") {
    return (
      <select value={String(value ?? "")} disabled={readOnly} onChange={(e) => onChange(e.target.value)} className={primitiveInputClass(readOnly)}>
        <option value="">اختر شخصًا</option>
        {profiles.map((profile) => (
          <option key={profile.id} value={profile.id}>{profile.full_name ?? profile.id}</option>
        ))}
      </select>
    );
  }

  if (column.type === "select") {
    return (
      <select value={String(value ?? "")} disabled={readOnly} onChange={(e) => onChange(e.target.value)} className={primitiveInputClass(readOnly)}>
        <option value="">اختر</option>
        {(column.options ?? []).map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    );
  }

  return (
    <input
      type={column.type === "number" ? "number" : column.type === "date" ? "date" : "text"}
      value={String(value ?? "")}
      readOnly={readOnly}
      onChange={(e) => onChange(column.type === "number" ? Number(e.target.value) : e.target.value)}
      className={primitiveInputClass(readOnly)}
    />
  );
}

function TableField({ field, value, readOnly, profiles, onChange }: {
  field: ProjectFormField;
  value: unknown;
  readOnly?: boolean;
  profiles: Pick<Profile, "id" | "full_name" | "avatar_url">[];
  onChange: (value: unknown) => void;
}) {
  const rows = Array.isArray(value) ? value as Record<string, unknown>[] : [];
  const columns = field.columns ?? [];

  const updateRow = (index: number, key: string, nextValue: unknown) => {
    const nextRows = rows.map((row, rowIndex) => rowIndex === index ? { ...row, [key]: nextValue } : row);
    onChange(nextRows);
  };

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr>
              {columns.map((column) => <th key={column.key} className="px-3 py-2 text-right font-bold">{column.label}</th>)}
              {!readOnly && <th className="w-12 px-3 py-2" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row, index) => (
              <tr key={index}>
                {columns.map((column) => (
                  <td key={column.key} className="px-2 py-2 align-top">
                    {renderColumnInput(column, row[column.key], (nextValue) => updateRow(index, column.key, nextValue), profiles, readOnly)}
                  </td>
                ))}
                {!readOnly && (
                  <td className="px-2 py-2 align-middle">
                    <button
                      type="button"
                      onClick={() => onChange(rows.filter((_, rowIndex) => rowIndex !== index))}
                      className="rounded-lg p-2 text-red-500 hover:bg-red-50"
                      title="حذف الصف"
                    >
                      <Trash2 size={15} />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!readOnly && (
        <button
          type="button"
          onClick={() => onChange([...rows, Object.fromEntries(columns.map((column) => [column.key, ""]))])}
          className="flex w-full items-center justify-center gap-2 border-t border-slate-100 px-3 py-2 text-sm font-bold text-indigo-600 hover:bg-indigo-50"
        >
          <Plus size={15} />
          إضافة صف
        </button>
      )}
    </div>
  );
}

export function DynamicFormRenderer({ schema, data, profiles, readOnly, onChange }: Props) {
  const setValue = (field: ProjectFormField, value: unknown) => {
    onChange?.(updateValue(data, field.key, value));
  };

  return (
    <div className="space-y-6">
      {schema.sections.map((section) => (
        <section key={section.key} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4">
            <h3 className="text-base font-black text-slate-900">{section.title}</h3>
            {section.description && <p className="mt-1 text-xs text-slate-500">{section.description}</p>}
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {section.fields.map((field) => {
              const value = data[field.key];
              if (field.type === "textarea") {
                return (
                  <div key={field.key} className="md:col-span-2">
                    <FieldShell field={field}>
                      <textarea
                        value={String(value ?? "")}
                        readOnly={readOnly}
                        rows={4}
                        onChange={(e) => setValue(field, e.target.value)}
                        className={primitiveInputClass(readOnly)}
                        placeholder={field.placeholder}
                      />
                    </FieldShell>
                  </div>
                );
              }

              if (field.type === "select") {
                return (
                  <FieldShell key={field.key} field={field}>
                    <select value={String(value ?? "")} disabled={readOnly} onChange={(e) => setValue(field, e.target.value)} className={primitiveInputClass(readOnly)}>
                      <option value="">اختر</option>
                      {(field.options ?? []).map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </FieldShell>
                );
              }

              if (field.type === "checkbox") {
                return (
                  <FieldShell key={field.key} field={field}>
                    <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
                      <input type="checkbox" checked={Boolean(value)} disabled={readOnly} onChange={(e) => setValue(field, e.target.checked)} />
                      <span className="text-sm text-slate-600">نعم</span>
                    </div>
                  </FieldShell>
                );
              }

              if (field.type === "rating") {
                return (
                  <FieldShell key={field.key} field={field}>
                    <select value={String(value ?? "")} disabled={readOnly} onChange={(e) => setValue(field, Number(e.target.value))} className={primitiveInputClass(readOnly)}>
                      <option value="">اختر التقييم</option>
                      {[1, 2, 3, 4, 5].map((rating) => <option key={rating} value={rating}>{rating}</option>)}
                    </select>
                  </FieldShell>
                );
              }

              if (field.type === "people") {
                return (
                  <FieldShell key={field.key} field={field}>
                    <select value={String(value ?? "")} disabled={readOnly} onChange={(e) => setValue(field, e.target.value)} className={primitiveInputClass(readOnly)}>
                      <option value="">اختر شخصًا</option>
                      {profiles.map((profile) => (
                        <option key={profile.id} value={profile.id}>{profile.full_name ?? profile.id}</option>
                      ))}
                    </select>
                  </FieldShell>
                );
              }

              if (field.type === "table" || field.type === "repeater") {
                return (
                  <div key={field.key} className="md:col-span-2">
                    <FieldShell field={field}>
                      <TableField field={field} value={value} readOnly={readOnly} profiles={profiles} onChange={(nextValue) => setValue(field, nextValue)} />
                    </FieldShell>
                  </div>
                );
              }

              return (
                <FieldShell key={field.key} field={field}>
                  <input
                    type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
                    value={String(value ?? "")}
                    readOnly={readOnly}
                    onChange={(e) => setValue(field, field.type === "number" ? Number(e.target.value) : e.target.value)}
                    className={primitiveInputClass(readOnly)}
                    placeholder={field.placeholder}
                  />
                </FieldShell>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
