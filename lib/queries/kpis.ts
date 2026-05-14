import { createClient } from "@/lib/supabase/client";
import type {
  Database,
  AudienceMetric,
  ClientOpportunity,
  IndicatorProduct,
  KpiDefinition,
  KpiPeriodType,
  KpiShareLink,
  KpiValue,
  PartnershipActivity,
  Project,
  ProjectPerformanceUpdate,
  RevenueEntry,
  ServiceOutput,
} from "@/lib/supabase/types";

export type KpiValueUpsert = Database["public"]["Tables"]["kpi_values"]["Insert"];
export type IndicatorProductInsert = Database["public"]["Tables"]["indicator_products"]["Insert"];
export type IndicatorProductUpdate = Database["public"]["Tables"]["indicator_products"]["Update"];
export type ProjectPerformanceUpdateInsert = Database["public"]["Tables"]["project_performance_updates"]["Insert"];
export type ProjectPerformanceUpdateUpdate = Database["public"]["Tables"]["project_performance_updates"]["Update"];
export type RevenueEntryInsert = Database["public"]["Tables"]["revenue_entries"]["Insert"];
export type ClientOpportunityInsert = Database["public"]["Tables"]["client_opportunities"]["Insert"];
export type AudienceMetricInsert = Database["public"]["Tables"]["audience_metrics"]["Insert"];
export type ServiceOutputInsert = Database["public"]["Tables"]["service_outputs"]["Insert"];
export type PartnershipActivityInsert = Database["public"]["Tables"]["partnership_activities"]["Insert"];
export type KpiShareLinkSafe = Omit<KpiShareLink, "token_hash">;
export type ProjectPerformanceRecord = ProjectPerformanceUpdate & {
  project?: Pick<Project, "id" | "name" | "manager_id" | "total_budget" | "progress"> | null;
};
export type ShareLinkCreatePayload = {
  name: string;
  expires_at?: string | null;
};
export type ShareLinkCreateResult = {
  link: KpiShareLinkSafe;
  token: string;
  url: string;
};
export type SimpleWorkspaceKind = "revenue" | "clients" | "audience" | "services" | "partnerships";
export type SimpleWorkspaceRecord =
  | RevenueEntry
  | ClientOpportunity
  | AudienceMetric
  | ServiceOutput
  | PartnershipActivity;
export type SimpleWorkspacePayload =
  | (RevenueEntryInsert & { id?: string })
  | (ClientOpportunityInsert & { id?: string })
  | (AudienceMetricInsert & { id?: string })
  | (ServiceOutputInsert & { id?: string })
  | (PartnershipActivityInsert & { id?: string });

export const kpiKeys = {
  all: ["kpis"] as const,
  definitions: () => [...kpiKeys.all, "definitions"] as const,
  values: (periodType: KpiPeriodType, periodStart: string, periodEnd: string) =>
    [...kpiKeys.all, "values", periodType, periodStart, periodEnd] as const,
  shareLinks: () => [...kpiKeys.all, "share-links"] as const,
  products: () => [...kpiKeys.all, "products"] as const,
  projectPerformance: (periodType: KpiPeriodType, periodStart: string, periodEnd: string) =>
    [...kpiKeys.all, "project-performance", periodType, periodStart, periodEnd] as const,
  simpleWorkspace: (kind: SimpleWorkspaceKind) => [...kpiKeys.all, "simple-workspace", kind] as const,
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

export async function fetchIndicatorProducts(): Promise<IndicatorProduct[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("indicator_products")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function saveIndicatorProduct(
  payload: IndicatorProductInsert | (IndicatorProductUpdate & { id: string })
): Promise<IndicatorProduct> {
  const supabase = createClient();
  const isUpdate = "id" in payload && Boolean(payload.id);
  const id = "id" in payload ? payload.id : undefined;
  const query = isUpdate
    ? supabase.from("indicator_products").update(payload).eq("id", id as string).select("*").single()
    : supabase.from("indicator_products").insert(payload as IndicatorProductInsert).select("*").single();

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function deleteIndicatorProduct(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("indicator_products").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchProjectPerformanceUpdates(
  periodType: KpiPeriodType,
  periodStart: string,
  periodEnd: string
): Promise<ProjectPerformanceRecord[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("project_performance_updates")
    .select("*, project:projects(id,name,manager_id,total_budget,progress)")
    .eq("period_type", periodType)
    .eq("period_start", periodStart)
    .eq("period_end", periodEnd)
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function fetchActiveProjectsForPerformance(): Promise<
  Pick<Project, "id" | "name" | "manager_id" | "total_budget" | "progress">[]
> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("projects")
    .select("id,name,manager_id,total_budget,progress")
    .neq("status", "cancelled")
    .order("name", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function saveProjectPerformanceUpdate(
  payload: ProjectPerformanceUpdateInsert | (ProjectPerformanceUpdateUpdate & { id: string })
): Promise<ProjectPerformanceUpdate> {
  const supabase = createClient();
  const isUpdate = "id" in payload && Boolean(payload.id);
  const id = "id" in payload ? payload.id : undefined;
  const query = isUpdate
    ? supabase.from("project_performance_updates").update(payload).eq("id", id as string).select("*").single()
    : supabase.from("project_performance_updates").upsert(payload as ProjectPerformanceUpdateInsert, {
        onConflict: "project_id,period_type,period_start,period_end",
      }).select("*").single();

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function deleteProjectPerformanceUpdate(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("project_performance_updates").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchSimpleWorkspaceRecords(kind: SimpleWorkspaceKind): Promise<SimpleWorkspaceRecord[]> {
  const supabase = createClient();

  if (kind === "revenue") {
    const { data, error } = await supabase.from("revenue_entries").select("*").order("entry_date", { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  if (kind === "clients") {
    const { data, error } = await supabase.from("client_opportunities").select("*").order("updated_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  if (kind === "audience") {
    const { data, error } = await supabase.from("audience_metrics").select("*").order("metric_date", { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  if (kind === "services") {
    const { data, error } = await supabase.from("service_outputs").select("*").order("updated_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  const { data, error } = await supabase.from("partnership_activities").select("*").order("updated_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function saveSimpleWorkspaceRecord(kind: SimpleWorkspaceKind, payload: SimpleWorkspacePayload): Promise<SimpleWorkspaceRecord> {
  const supabase = createClient();
  const id = payload.id;

  if (kind === "revenue") {
    const query = id
      ? supabase.from("revenue_entries").update(payload as Partial<RevenueEntryInsert>).eq("id", id).select("*").single()
      : supabase.from("revenue_entries").insert(payload as RevenueEntryInsert).select("*").single();
    const { data, error } = await query;
    if (error) throw error;
    return data;
  }

  if (kind === "clients") {
    const query = id
      ? supabase.from("client_opportunities").update(payload as Partial<ClientOpportunityInsert>).eq("id", id).select("*").single()
      : supabase.from("client_opportunities").insert(payload as ClientOpportunityInsert).select("*").single();
    const { data, error } = await query;
    if (error) throw error;
    return data;
  }

  if (kind === "audience") {
    const query = id
      ? supabase.from("audience_metrics").update(payload as Partial<AudienceMetricInsert>).eq("id", id).select("*").single()
      : supabase.from("audience_metrics").insert(payload as AudienceMetricInsert).select("*").single();
    const { data, error } = await query;
    if (error) throw error;
    return data;
  }

  if (kind === "services") {
    const query = id
      ? supabase.from("service_outputs").update(payload as Partial<ServiceOutputInsert>).eq("id", id).select("*").single()
      : supabase.from("service_outputs").insert(payload as ServiceOutputInsert).select("*").single();
    const { data, error } = await query;
    if (error) throw error;
    return data;
  }

  const query = id
    ? supabase.from("partnership_activities").update(payload as Partial<PartnershipActivityInsert>).eq("id", id).select("*").single()
    : supabase.from("partnership_activities").insert(payload as PartnershipActivityInsert).select("*").single();
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function deleteSimpleWorkspaceRecord(kind: SimpleWorkspaceKind, id: string): Promise<void> {
  const supabase = createClient();
  const table = {
    revenue: "revenue_entries",
    clients: "client_opportunities",
    audience: "audience_metrics",
    services: "service_outputs",
    partnerships: "partnership_activities",
  }[kind];
  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) throw error;
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
