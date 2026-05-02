import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth/get-user";
import { TeamClient } from "@/components/team/team-client";

export default async function TeamPage() {
  const { user } = await getUser();
  const supabase = await createClient();

  const { data: profiles } = await supabase
    .from("profiles")
    .select("*")
    .order("full_name");

  return (
    <div className="page-container">
      <TeamClient profiles={profiles ?? []} currentUser={user} />
    </div>
  );
}
