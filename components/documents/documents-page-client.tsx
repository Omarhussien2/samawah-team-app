"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, ExternalLink, FileText, Loader2, Pencil, Plus, Search, Trash2, Upload, X } from "lucide-react";
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
import { PROJECT_TYPE_OPTIONS, formatRelativeAr, getProjectTypeBadgeClass, getProjectTypeLabel } from "@/lib/utils";
import { createSearchMatcher } from "@/lib/utils/search";
import {
  buildDocumentStoragePath,
  DOCUMENT_BUCKET,
  DOCUMENT_STAGES,
  DOCUMENT_TYPES,
  formatFileSize,
} from "@/lib/documents/utils";
import type { Document, Profile, Project } from "@/lib/supabase/types";

type DocumentWithRelations = Document & {
  creator?: { id: string; full_name: string | null } | null;
  project?: Pick<Project, "id" | "name" | "project_type"> | null;
};

interface Props {
  documents: DocumentWithRelations[];
  projects: Pick<Project, "id" | "name" | "project_type">[];
  currentUser: Profile;
}

const EMPTY_FORM = { title: "", project_id: "", url: "", type: "أخرى", stage: "" };

function canModifyDocument(doc: DocumentWithRelations, currentUser: Profile) {
  return currentUser.role === "admin" || currentUser.role === "project_manager" || doc.created_by === currentUser.id;
}

export function DocumentsPageClient({ documents, projects, currentUser }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterStage, setFilterStage] = useState("all");
  const [filterProject, setFilterProject] = useState("all");
  const [filterProjectType, setFilterProjectType] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<DocumentWithRelations | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    const matchesSearch = createSearchMatcher(search);

    return documents.filter((doc) => {
      if (!matchesSearch([
        doc.title,
        doc.type,
        doc.stage,
        doc.project?.name,
        getProjectTypeLabel(doc.project?.project_type),
        doc.creator?.full_name,
        doc.url,
        doc.file_path,
        doc.file_name,
      ])) {
        return false;
      }
      if (filterType !== "all" && doc.type !== filterType) return false;
      if (filterStage !== "all" && (doc.stage ?? "none") !== filterStage) return false;
      if (filterProjectType !== "all" && doc.project?.project_type !== filterProjectType) return false;
      if (filterProject !== "all" && doc.project_id !== filterProject) return false;
      return true;
    });
  }, [documents, search, filterType, filterStage, filterProjectType, filterProject]);

  const visibleProjects = useMemo(
    () => projects.filter((project) => filterProjectType === "all" || project.project_type === filterProjectType),
    [filterProjectType, projects]
  );

  const closeDialogs = () => {
    setShowCreate(false);
    setEditing(null);
    setForm(EMPTY_FORM);
    setSelectedFile(null);
  };

  const openEdit = (doc: DocumentWithRelations) => {
    setEditing(doc);
    setForm({
      title: doc.title,
      project_id: doc.project_id,
      url: doc.url ?? "",
      type: doc.type ?? "أخرى",
      stage: doc.stage ?? "",
    });
    setSelectedFile(null);
  };

  const handleCreate = async () => {
    if (!form.title.trim() || !form.project_id) {
      toast.error("العنوان والمشروع مطلوبان");
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
      filePath = buildDocumentStoragePath(form.project_id, selectedFile.name);
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
      project_id: form.project_id,
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
    if (!editing || !form.title.trim() || !form.project_id) {
      toast.error("العنوان والمشروع مطلوبان");
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

  const handleOpenFile = async (doc: DocumentWithRelations) => {
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

  const handleDelete = async (doc: DocumentWithRelations) => {
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
    <>
      <div className="section-header">
        <div>
          <h1 className="text-2xl font-bold text-foreground">المستندات</h1>
          <p className="mt-1 text-sm text-muted-foreground">{filtered.length} مستند</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus size={16} /> مستند جديد
        </Button>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_160px_160px_180px_220px]">
        <div className="relative">
          <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="ابحث..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="pr-9"
          />
          {search && (
            <button
              type="button"
              aria-label="مسح البحث"
              onClick={() => setSearch("")}
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition hover:bg-accent hover:text-foreground"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger>
            <SelectValue placeholder="النوع" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الأنواع</SelectItem>
            {DOCUMENT_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterStage} onValueChange={setFilterStage}>
          <SelectTrigger>
            <SelectValue placeholder="المرحلة" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل المراحل</SelectItem>
            <SelectItem value="none">غير محدد</SelectItem>
            {DOCUMENT_STAGES.map((stage) => (
              <SelectItem key={stage} value={stage}>
                {stage}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filterProjectType}
          onValueChange={(value) => {
            setFilterProjectType(value);
            setFilterProject("all");
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="نوع المشروع" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل أنواع المشاريع</SelectItem>
            {PROJECT_TYPE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterProject} onValueChange={setFilterProject}>
          <SelectTrigger>
            <SelectValue placeholder="المشروع" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل المشاريع</SelectItem>
            {visibleProjects.map((project) => (
              <SelectItem key={project.id} value={project.id}>
                {project.name} - {getProjectTypeLabel(project.project_type)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-20 text-center text-muted-foreground">
          <p className="font-medium">ما فيه مستندات</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((doc) => {
            const isBusy = deletingId === doc.id || openingId === doc.id;
            return (
              <div key={doc.id} className="rounded-xl border border-border bg-white p-4 transition-all hover:border-primary/30 hover:shadow-md">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10">
                    <FileText size={18} className="text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="line-clamp-1 text-sm font-medium text-foreground">{doc.title}</h4>
                    <p className="mt-0.5 text-xs text-muted-foreground">{doc.project?.name ?? "غير محدد"}</p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{doc.type ?? "أخرى"}</Badge>
                  <Badge variant="outline">{doc.stage ?? "غير محدد"}</Badge>
                  <Badge variant="outline" className={getProjectTypeBadgeClass(doc.project?.project_type)}>
                    {getProjectTypeLabel(doc.project?.project_type)}
                  </Badge>
                </div>

                <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                  <p className="line-clamp-1">{doc.file_name ? doc.file_name : "رابط خارجي"}</p>
                  <p>{doc.file_name ? formatFileSize(doc.file_size) : doc.url}</p>
                  <p>{formatRelativeAr(doc.created_at)}</p>
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
        open={showCreate || Boolean(editing)}
        title={editing ? "تعديل المستند" : "مستند جديد"}
        form={form}
        projects={visibleProjects}
        saving={saving}
        selectedFile={selectedFile}
        allowFileUpload={!editing}
        allowProjectChange={!editing}
        onOpenChange={(open) => {
          if (!open) closeDialogs();
        }}
        onFormChange={setForm}
        onFileChange={setSelectedFile}
        onSubmit={editing ? handleUpdate : handleCreate}
      />
    </>
  );
}

interface DocumentDialogProps {
  open: boolean;
  title: string;
  form: typeof EMPTY_FORM;
  projects: Pick<Project, "id" | "name" | "project_type">[];
  saving: boolean;
  selectedFile: File | null;
  allowFileUpload: boolean;
  allowProjectChange: boolean;
  onOpenChange: (open: boolean) => void;
  onFormChange: (form: typeof EMPTY_FORM) => void;
  onFileChange: (file: File | null) => void;
  onSubmit: () => void;
}

function DocumentDialog({
  open,
  title,
  form,
  projects,
  saving,
  selectedFile,
  allowFileUpload,
  allowProjectChange,
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
            <Label htmlFor="document-title">العنوان</Label>
            <Input
              id="document-title"
              value={form.title}
              onChange={(event) => onFormChange({ ...form, title: event.target.value })}
              placeholder="عنوان المستند"
            />
          </div>

          <div className="grid gap-2">
            <Label>المشروع</Label>
            <Select
              value={form.project_id || "none"}
              onValueChange={(value) => onFormChange({ ...form, project_id: value === "none" ? "" : value })}
              disabled={!allowProjectChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="اختر المشروع" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">اختر المشروع</SelectItem>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name} - {getProjectTypeLabel(project.project_type)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
            <Label htmlFor="document-url">الرابط</Label>
            <Input
              id="document-url"
              value={form.url}
              onChange={(event) => onFormChange({ ...form, url: event.target.value })}
              placeholder="https://"
            />
          </div>

          {allowFileUpload && (
            <div className="grid gap-2 rounded-lg border border-dashed border-border p-4">
              <Label htmlFor="document-file" className="flex items-center gap-2">
                <Upload size={15} /> الملف
              </Label>
              <Input
                id="document-file"
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
