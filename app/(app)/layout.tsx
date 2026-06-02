import { AppShell } from "@/components/layout/app-shell";
import { getUser } from "@/lib/auth/get-user";
import { canAccessKpiCenter } from "@/lib/auth/kpi-access";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user } = await getUser();
  return (
    <AppShell user={user} canAccessKpis={canAccessKpiCenter(user)}>
      {children}
    </AppShell>
  );
}
