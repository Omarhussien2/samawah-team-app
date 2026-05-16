"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, ExternalLink, Link2, RotateCcw, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createKpiShareLink,
  deleteKpiShareLink,
  fetchKpiShareLinks,
  kpiKeys,
  updateKpiShareLink,
  type KpiShareLinkSafe,
} from "@/lib/queries/kpis";
import { cn } from "@/lib/utils";

interface Props {
  initialLinks: KpiShareLinkSafe[];
}

export function ShareLinkPanel({ initialLinks }: Props) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("رابط مجلس الإدارة");
  const [expiresAt, setExpiresAt] = useState("");
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);

  const { data: links = initialLinks } = useQuery({
    queryKey: kpiKeys.shareLinks(),
    queryFn: fetchKpiShareLinks,
    initialData: initialLinks,
  });

  const createMutation = useMutation({
    mutationFn: createKpiShareLink,
    onSuccess: (result) => {
      setGeneratedUrl(result.url);
      setName("رابط مجلس الإدارة");
      setExpiresAt("");
      queryClient.invalidateQueries({ queryKey: kpiKeys.shareLinks() });
      toast.success("تم إنشاء رابط مجلس الإدارة");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "تعذر إنشاء الرابط");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => updateKpiShareLink(id, { active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: kpiKeys.shareLinks() });
      toast.success("تم تحديث الرابط");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "تعذر تحديث الرابط");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteKpiShareLink,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: kpiKeys.shareLinks() });
      toast.success("تم حذف رابط مجلس الإدارة");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "تعذر حذف الرابط");
    },
  });

  const deleteLink = (id: string) => {
    if (!window.confirm("هل تريد حذف رابط مجلس الإدارة؟ لن يعمل الرابط بعد الحذف.")) return;
    deleteMutation.mutate(id);
  };

  const copyLink = async (url: string) => {
    await navigator.clipboard.writeText(url);
    toast.success("تم نسخ الرابط");
  };

  return (
    <section className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} className="text-indigo-600" />
            <h2 className="text-base font-extrabold text-slate-900">رابط مجلس الإدارة</h2>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            رابط قراءة فقط بدون تسجيل دخول. يتم حفظ بصمة التوكن فقط ويمكن تعطيله في أي وقت.
          </p>
        </div>
        <div className="grid w-full gap-2 sm:grid-cols-[1fr_180px_auto] lg:max-w-2xl">
          <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="اسم الرابط" />
          <Input
            type="date"
            value={expiresAt}
            onChange={(event) => setExpiresAt(event.target.value)}
            title="تاريخ الانتهاء اختياري"
          />
          <Button
            onClick={() => createMutation.mutate({ name, expires_at: expiresAt ? `${expiresAt}T23:59:59.000Z` : null })}
            disabled={createMutation.isPending}
          >
            <Link2 size={16} />
            إنشاء رابط
          </Button>
        </div>
      </div>

      {generatedUrl && (
        <div className="mt-4 flex flex-col gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 md:flex-row md:items-center md:justify-between">
          <p className="break-all text-sm font-semibold text-emerald-800">{generatedUrl}</p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => copyLink(generatedUrl)}>
              <Copy size={14} />
              نسخ
            </Button>
            <Button size="sm" variant="outline" asChild>
              <a href={generatedUrl} target="_blank" rel="noreferrer">
                <ExternalLink size={14} />
                فتح
              </a>
            </Button>
          </div>
        </div>
      )}

      <div className="mt-5 space-y-2">
        {links.length === 0 ? (
          <p className="rounded-lg bg-white px-4 py-3 text-sm text-slate-500">لا توجد روابط مشاركة بعد.</p>
        ) : (
          links.map((link) => (
            <div key={link.id} className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className={cn("h-2.5 w-2.5 rounded-full", link.active ? "bg-emerald-500" : "bg-slate-300")} />
                  <p className="font-bold text-slate-900">{link.name}</p>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  المشاهدات: {link.views_count} | آخر فتح: {link.last_viewed_at ? new Date(link.last_viewed_at).toLocaleString("ar-SA") : "لم يفتح بعد"}
                  {link.expires_at ? ` | ينتهي: ${new Date(link.expires_at).toLocaleDateString("ar-SA")}` : ""}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={link.active ? "destructive" : "outline"}
                  onClick={() => updateMutation.mutate({ id: link.id, active: !link.active })}
                  disabled={updateMutation.isPending || deleteMutation.isPending}
                >
                  <RotateCcw size={14} />
                  {link.active ? "تعطيل" : "تفعيل"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => deleteLink(link.id)}
                  disabled={updateMutation.isPending || deleteMutation.isPending}
                  className="border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800"
                >
                  <Trash2 size={14} />
                  حذف
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
