import { createClient } from "@/lib/supabase/client";
import type { Database, KpiDefinition, KpiPeriodType, KpiShareLink, KpiValue } from "@/lib/supabase/types";

export type KpiValueUpsert = Database["public"]["Tables"]["kpi_values"]["Insert"];
export type KpiShareLinkSafe = Omit<KpiShareLink, "token_hash">;
export type ShareLinkCreatePayload = {
  name: string;
  expires_at?: string | null;
};
export type ShareLinkCreateResult = {
  link: KpiShareLinkSafe;
  token: string;
  url: string;
};

export const kpiKeys = {
  all: ["kpis"] as const,
  definitions: () => [...kpiKeys.all, "definitions"] as const,
  values: (periodType: KpiPeriodType, periodStart: string, periodEnd: string) =>
    [...kpiKeys.all, "values", periodType, periodStart, periodEnd] as const,
  shareLinks: () => [...kpiKeys.all, "share-links"] as const,
};

export async function fetchKpiDefinitions(): Promise<KpiDefinition[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("kpi_definitions")
    .select("*")
    .eq("active", true)
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function fetchKpiValues(
  periodType: KpiPeriodType,
  periodStart: string,
  periodEnd: string
): Promise<KpiValue[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("kpi_values")
    .select("*")
    .eq("period_type", periodType)
    .eq("period_start", periodStart)
    .eq("period_end", periodEnd);

  if (error) throw error;
  return data ?? [];
}

export async function upsertKpiValues(values: KpiValueUpsert[]): Promise<KpiValue[]> {
  if (values.length === 0) return [];
  const supabase = createClient();
  const { data, error } = await supabase
    .from("kpi_values")
    .upsert(values, { onConflict: "kpi_id,period_type,period_start,period_end" })
    .select("*");

  if (error) throw error;
  return data ?? [];
}

export async function fetchKpiShareLinks(): Promise<KpiShareLinkSafe[]> {
  const response = await fetch("/api/kpis/share-links", { cache: "no-store" });
  if (!response.ok) throw new Error("تعذر تحميل روابط مجلس الإدارة");
  const data = await response.json();
  return data.links ?? [];
}

export async function createKpiShareLink(payload: ShareLinkCreatePayload): Promise<ShareLinkCreateResult> {
  const response = await fetch("/api/kpis/share-links", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error ?? "تعذر إنشاء رابط مجلس الإدارة");
  }
  return response.json();
}

export async function updateKpiShareLink(
  id: string,
  payload: Partial<Pick<KpiShareLinkSafe, "active" | "name" | "expires_at">>
): Promise<KpiShareLinkSafe> {
  const response = await fetch(`/api/kpis/share-links/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error ?? "تعذر تحديث رابط مجلس الإدارة");
  }
  const data = await response.json();
  return data.link;
}
