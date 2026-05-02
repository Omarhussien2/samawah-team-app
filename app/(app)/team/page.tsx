import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth/get-user";
import { TeamClient } from "@/components/team/team-client";
import type { Profile } from "@/lib/supabase/types";

export default async function TeamPage() {
  const { user } = await getUser();
  const supabase = await createClient();

  const { data: profiles }: { data: Profile[] | null } = await supabase
    .from("profiles")
    .select("*")
    .order("full_name");

  return (
    <div className="page-container">
      <TeamClient profiles={profiles ?? []} currentUser={user} />
    </div>
  );
}
