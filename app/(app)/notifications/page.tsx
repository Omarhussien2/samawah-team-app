import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth/get-user";
import { NotificationsPageClient } from "@/components/notifications/notifications-page-client";

export default async function NotificationsPage() {
  const { user } = await getUser();
  const supabase = await createClient();

  const { data: notifications, count } = await supabase
    .from("notifications")
    .select("*", { count: "exact" })
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .range(0, 49);

  return (
    <div className="page-container">
      <NotificationsPageClient
        initialNotifications={notifications ?? []}
        totalCount={count ?? 0}
        userId={user.id}
      />
    </div>
  );
}
