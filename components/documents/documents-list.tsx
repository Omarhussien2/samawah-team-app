"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download, ExternalLink, FileText, Loader2, Pencil, Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { cn, formatRelativeAr } from "@/lib/utils";
import {
  buildDocumentStoragePath,
  DOCUMENT_BUCKET,
  DOCUMENT_STAGES,
  DOCUMENT_TYPES,
  formatFileSize,
} from "@/lib/documents/utils";
import type { Document, Profile } from "@/lib/supabase/types";

type ProjectDocument = Document & { creator?: { id: string; full_name: string | null } | null };

interface Props {
  documents: ProjectDocument[];
  projectId: string;
  currentUser: Profile;
}

const EMPTY_FORM = { title: "", url: "", type: "أخرى", stage: "" };

function canModifyDocument(doc: ProjectDocument, currentUser: Profile) {
  return currentUser.role === "admin" || currentUser.role === "project_manager" || doc.created_by === currentUser.id;
}

export function DocumentsList({ documents, projectId, currentUser }: Props) {
  const router = useRouter();
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<ProjectDocument | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const resetCreate = () => {
    setForm(EMPTY_FORM);
    setSelectedFile(null);
  };

  const openEdit = (doc: ProjectDocument) => {
    setEditing(doc);
    setForm({
      title: doc.title,
      url: doc.url ?? "",
      type: doc.type ?? "أخرى",
      stage: doc.stage ?? "",
    });
    setSelectedFile(null);
  };

  const closeDialogs = () => {
    setShowAdd(false);
    setEditing(null);
    resetCreate();
  };

  const handleAdd = async () => {
    if (!form.title.trim()) {
      toast.error("عنوان المستند مطلوب");
      return;
    }
    if (!selectedFile && !form.url.trim()) {
      toast.error("أضف ملفًا أو رابطًا للمستند");
      return;
    }

    setSaving(true);
    const supabase = createClient();
    let filePath: string | null = null;

    if (selectedFile) {
      filePath = buildDocumentStoragePath(projectId, selectedFile.name);
      const { error: uploadError } = await supabase.storage
        .from(DOCUMENT_BUCKET)
        .upload(filePath, selectedFile, {
          cacheControl: "3600",
          contentType: selectedFile.type || "application/octet-stream",
          upsert: false,
        });

      if (uploadError) {
        toast.error(`فشل رفع الملف: ${uploadError.message}`);
        setSaving(false);
        return;
      }
    }

    const { error } = await supabase.from("documents").insert({
      title: form.title.trim(),
      project_id: projectId,
      url: form.url.trim() || null,
      file_path: filePath,
      file_name: selectedFile?.name ?? null,
      file_type: selectedFile?.type || null,
      file_size: selectedFile?.size ?? null,
      type: form.type,
      stage: form.stage || null,
      created_by: currentUser.id,
    });

    if (error) {
      if (filePath) await supabase.storage.from(DOCUMENT_BUCKET).remove([filePath]);
      toast.error(`ما نجح إنشاء المستند: ${error.message}`);
    } else {
      toast.success("تم إنشاء المستند");
      closeDialogs();
      router.refresh();
    }
    setSaving(false);
  };

  const handleUpdate = async () => {
    if (!editing || !form.title.trim()) {
      toast.error("عنوان المستند مطلوب");
      return;
    }

    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("documents")
      .update({
        title: form.title.trim(),
        url: form.url.trim() || null,
        type: form.type,
        stage: form.stage || null,
      })
      .eq("id", editing.id);

    if (error) {
      toast.error(`فشل تحديث المستند: ${error.message}`);
    } else {
      toast.success("تم تحديث المستند");
      closeDialogs();
      router.refresh();
    }
    setSaving(false);
  };

  const handleOpenFile = async (doc: ProjectDocument) => {
    if (doc.url && !doc.file_path) {
      window.open(doc.url, "_blank", "noopener,noreferrer");
      return;
    }

    if (!doc.file_path) return;
    setOpeningId(doc.id);
    const supabase = createClient();
    const { data, error } = await supabase.storage.from(DOCUMENT_BUCKET).createSignedUrl(doc.file_path, 60);

    if (error || !data?.signedUrl) {
      toast.error(error?.message ?? "تعذر فتح الملف");
    } else {
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    }
    setOpeningId(null);
  };

  const handleDelete = async (doc: ProjectDocument) => {
    if (!confirm(`حذف "${doc.title}"؟`)) return;

    setDeletingId(doc.id);
    const supabase = createClient();

    if (doc.file_path) {
      const { error: storageError } = await supabase.storage.from(DOCUMENT_BUCKET).remove([doc.file_path]);
      if (storageError) {
        toast.error(`فشل حذف الملف: ${storageError.message}`);
        setDeletingId(null);
        return;
      }
    }

    const { error } = await supabase.from("documents").delete().eq("id", doc.id);
    if (error) toast.error(`فشل حذف المستند: ${error.message}`);
    else {
      toast.success("تم حذف المستند");
      router.refresh();
    }
    setDeletingId(null);
  };

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setShowAdd(true)} size="sm">
          <Plus size={15} /> مستند جديد
        </Button>
      </div>

      {documents.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-10 text-center text-muted-foreground">
          ما فيه مستندات في هذا المشروع
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {documents.map((doc) => {
            const isBusy = deletingId === doc.id || openingId === doc.id;
            return (
              <div key={doc.id} className="rounded-xl border border-border bg-white p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-blue-50">
                    <FileText size={18} className="text-blue-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-1 text-sm font-medium text-foreground">{doc.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {doc.creator?.full_name ?? "غير محدد"} · {formatRelativeAr(doc.created_at)}
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{doc.type ?? "أخرى"}</Badge>
                  <Badge variant="outline">{doc.stage ?? "غير محدد"}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {doc.file_name ? `${doc.file_name} · ${formatFileSize(doc.file_size)}` : "رابط خارجي"}
                  </span>
                </div>

                <div className="mt-4 flex items-center justify-between gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenFile(doc)}
                    disabled={isBusy || (!doc.file_path && !doc.url)}
                  >
                    {openingId === doc.id ? <Loader2 className="animate-spin" /> : doc.file_path ? <Download /> : <ExternalLink />}
                    فتح
                  </Button>

                  {canModifyDocument(doc, currentUser) && (
                    <div className="flex items-center gap-1">
                      <Button type="button" variant="ghost" size="icon" onClick={() => openEdit(doc)} disabled={isBusy} aria-label="تعديل المستند">
                        <Pencil />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(doc)}
                        disabled={isBusy}
                        aria-label="حذف المستند"
                        className="text-destructive hover:text-destructive"
                      >
                        {deletingId === doc.id ? <Loader2 className="animate-spin" /> : <Trash2 />}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <DocumentDialog
        open={showAdd || Boolean(editing)}
        title={editing ? "تعديل المستند" : "مستند جديد"}
        form={form}
        saving={saving}
        selectedFile={selectedFile}
        allowFileUpload={!editing}
        onOpenChange={(open) => {
          if (!open) closeDialogs();
        }}
        onFormChange={setForm}
        onFileChange={setSelectedFile}
        onSubmit={editing ? handleUpdate : handleAdd}
      />
    </div>
  );
}

interface DocumentDialogProps {
  open: boolean;
  title: string;
  form: typeof EMPTY_FORM;
  saving: boolean;
  selectedFile: File | null;
  allowFileUpload: boolean;
  onOpenChange: (open: boolean) => void;
  onFormChange: (form: typeof EMPTY_FORM) => void;
  onFileChange: (file: File | null) => void;
  onSubmit: () => void;
}

function DocumentDialog({
  open,
  title,
  form,
  saving,
  selectedFile,
  allowFileUpload,
  onOpenChange,
  onFormChange,
  onFileChange,
  onSubmit,
}: DocumentDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="project-document-title">العنوان</Label>
            <Input
              id="project-document-title"
              value={form.title}
              onChange={(event) => onFormChange({ ...form, title: event.target.value })}
              placeholder="عنوان المستند"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>النوع</Label>
              <Select value={form.type} onValueChange={(value) => onFormChange({ ...form, type: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DOCUMENT_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>المرحلة</Label>
              <Select value={form.stage || "none"} onValueChange={(value) => onFormChange({ ...form, stage: value === "none" ? "" : value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">غير محدد</SelectItem>
                  {DOCUMENT_STAGES.map((stage) => (
                    <SelectItem key={stage} value={stage}>
                      {stage}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="project-document-url">الرابط</Label>
            <Input
              id="project-document-url"
              value={form.url}
              onChange={(event) => onFormChange({ ...form, url: event.target.value })}
              placeholder="https://"
            />
          </div>

          {allowFileUpload && (
            <div className={cn("grid gap-2 rounded-lg border border-dashed border-border p-4", selectedFile && "border-primary/50 bg-primary/5")}>
              <Label htmlFor="project-document-file" className="flex items-center gap-2">
                <Upload size={15} /> الملف
              </Label>
              <Input
                id="project-document-file"
                type="file"
                onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
                className="h-auto py-2"
              />
              {selectedFile && (
                <p className="text-xs text-muted-foreground">
                  {selectedFile.name} · {formatFileSize(selectedFile.size)}
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:space-x-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            إلغاء
          </Button>
          <Button type="button" onClick={onSubmit} disabled={saving}>
            {saving && <Loader2 className="animate-spin" />}
            {saving ? "جاري الحفظ..." : "حفظ"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
