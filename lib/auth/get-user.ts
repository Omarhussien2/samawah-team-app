import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { Profile } from "@/lib/supabase/types";

export async function getUser(): Promise<{ user: Profile }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  let { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  // Auto-create profile if missing (e.g. when user was created manually from Supabase Dashboard)
  if (!profile) {
    const fullName = user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? "مستخدم";
    const { data: newProfile, error } = await supabase
      .from("profiles")
      .insert({
        id: user.id,
        email: user.email,
        full_name: fullName,
        role: "admin",
      })
      .select("*")
      .single();

    if (error || !newProfile) {
      // If insert fails (e.g. RLS), use service role
      const { createServiceClient } = await import("@/lib/supabase/server");
      const serviceClient = createServiceClient();
      const { data: srvProfile } = await serviceClient
        .from("profiles")
        .insert({
          id: user.id,
          email: user.email,
          full_name: fullName,
          role: "admin",
        })
        .select("*")
        .single();
      profile = srvProfile;
    } else {
      profile = newProfile;
    }
  }

  if (!profile) redirect("/login");
  return { user: profile };
}

export async function getUserOrNull(): Promise<Profile | null> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();
    return profile;
  } catch {
    return null;
  }
}
