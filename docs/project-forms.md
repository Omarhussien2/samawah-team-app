# Project Forms Data Flow

## Purpose

Project forms are structured, fillable records attached to a project. They are separate from uploaded documents: a form keeps editable JSON data in Supabase, while an uploaded document remains a file record in `documents`.

## Database Model

- `project_form_templates` stores active form definitions and their `schema_json`.
- `project_form_instances` stores one filled form per project/template pair.
- `project_form_shares` is reserved for a future notification-backed sharing flow and is not exposed in the V1 UI.
- `projects.forms_owner_id` is a legacy/reserved column. Project forms are filled by the project manager.
- `documents.form_instance_id` can link future generated/uploaded files to the source form instance.

## UI Entry Point

Project forms live in the project detail page under the `نماذج المشروع` tab:

- `components/project-forms/project-forms-tab.tsx` fetches templates and instances.
- `components/project-forms/project-form-editor.tsx` edits a single form instance.
- `components/project-forms/dynamic-form-renderer.tsx` renders fields from template JSON.
- `components/project-forms/project-form-preview.tsx` previews and prints the form.

## Permissions

RLS allows:

- admins to manage templates.
- project managers to create and update project form instances.
- project members to view forms for their projects.
- sharing is reserved for a future flow. It should not affect form access until it sends an in-app notification or email.

Future SQL changes should update both `supabase/schema.sql` and `supabase/rls.sql`, then update `lib/supabase/types.ts` manually.

## Template JSON Pattern

Each template uses this structure:

```json
{
  "version": 1,
  "title": "Form name",
  "sections": [
    {
      "id": "section_id",
      "title": "Section title",
      "fields": [
        {
          "id": "field_id",
          "label": "Field label",
          "type": "text",
          "required": true
        }
      ]
    }
  ]
}
```

Supported field types in V1:

- `text`
- `textarea`
- `date`
- `number`
- `select`
- `checkbox`
- `rating`
- `people`
- `table`
- `repeater`

Use `prefill` keys such as `project.name`, `project.start_date`, `project.end_date`, `project.total_budget`, `project.manager_name`, and `project.current_stage` when a field should be initialized from project metadata.

## Completion and Status

Completion is calculated client-side from required fields and saved to `project_form_instances.completion_percentage`.

Status values:

- `not_started`
- `draft`
- `completed`

The editor can save drafts or mark the instance completed. Required-field completion should stay in `lib/project-forms/completion.ts` so future views use the same logic.

## Future Extensions

When adding a new project form feature:

1. Add fields to the template `schema_json` when possible.
2. Add database columns only when the field must be queried, indexed, shared, or reported across projects.
3. Keep rendering logic in `DynamicFormRenderer`.
4. Keep export/print logic in `lib/project-forms/export.ts`.
5. Add RLS policies for any new table.
6. Update `lib/supabase/types.ts` manually.

Examples:

- Attachments: add a `project_form_attachments` table linked to `project_form_instances`.
- Approval workflow: add status/audit columns or a `project_form_approvals` table.
- Excel/PDF generation: create generated `documents` rows linked through `documents.form_instance_id`.
- Advanced analytics: denormalize reportable values into typed columns or materialized views instead of querying arbitrary JSON.

## V1 Limitations

- V1 supports print preview only. Native PDF/DOCX export should be implemented in a separate export service/PR.
- The source DOCX/XLSX files are referenced by path but not parsed into binary templates at runtime.
- Training forms should move into a dedicated training module with its own inputs, outputs, dashboards, and reports.
