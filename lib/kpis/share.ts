import crypto from "node:crypto";
import { createServiceClient } from "@/lib/supabase/server";
import type { KpiDefinition, KpiShareLink, KpiValue } from "@/lib/supabase/types";

export interface KpiBoardSnapshot {
  link: Pick<KpiShareLink, "id" | "name" | "last_viewed_at" | "views_count" | "updated_at">;
  definitions: KpiDefinition[];
  values: KpiValue[];
  year: number;
  generatedAt: string;
}

export function generateKpiShareToken() {
  return crypto.randomBytes(32).toString("base64url");
}

export function hashKpiShareToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function fetchKpiBoardSnapshot(token: string): Promise<KpiBoardSnapshot | null> {
  const tokenHash = hashKpiShareToken(token);
  const supabase = createServiceClient();

  const { data: link, error: linkError } = await supabase
    .from("kpi_share_links")
    .select("*")
    .eq("token_hash", tokenHash)
    .eq("active", true)
    .maybeSingle();

  if (linkError || !link) return null;
  if (link.expires_at && new Date(link.expires_at).getTime() < Date.now()) return null;

  const year = new Date().getFullYear();
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;

  const [{ data: definitions, error: definitionsError }, { data: values, error: valuesError }] = await Promise.all([
    supabase
      .from("kpi_definitions")
      .select("*")
      .eq("active", true)
      .order("sort_order", { ascending: true }),
    supabase
      .from("kpi_values")
      .select("*")
      .eq("period_type", "quarterly")
      .gte("period_start", yearStart)
      .lte("period_end", yearEnd)
      .order("period_start", { ascending: false })
      .order("updated_at", { ascending: false }),
  ]);

  if (definitionsError || valuesError) return null;

  await supabase
    .from("kpi_share_links")
    .update({
      last_viewed_at: new Date().toISOString(),
      views_count: (link.views_count ?? 0) + 1,
    })
    .eq("id", link.id);

  return {
    link: {
      id: link.id,
      name: link.name,
      last_viewed_at: link.last_viewed_at,
      views_count: (link.views_count ?? 0) + 1,
      updated_at: link.updated_at,
    },
    definitions: definitions ?? [],
    values: values ?? [],
    year,
    generatedAt: new Date().toISOString(),
  };
}
