import type { Profile } from "@/lib/supabase/types";

const ALLOWED_KPI_PROFILE_IDS = new Set([
  "36185351-6c30-4e3d-9558-c8a7d5387762",
  "a03b7fc6-1e64-4af5-acb0-7971c5668fd2",
  "b2f49f37-7ab4-43b6-a853-6ced991f7177",
]);

const ALLOWED_KPI_EMAILS = new Set([
  "d.fahad@samawah1.sa",
  "omarsamawah@gmail.com",
  "m.barhma@samawah1.sa",
]);

const ALLOWED_KPI_NAMES = new Set([
  "دانة",
  "عمر",
  "محمد بارحمة",
]);

export function canAccessKpiCenter(profile: Pick<Profile, "id" | "email" | "full_name"> | null | undefined) {
  if (!profile) return false;

  const email = profile.email?.trim().toLowerCase() ?? "";
  const fullName = profile.full_name?.trim() ?? "";

  return (
    ALLOWED_KPI_PROFILE_IDS.has(profile.id) ||
    ALLOWED_KPI_EMAILS.has(email) ||
    ALLOWED_KPI_NAMES.has(fullName)
  );
}
