import { AppShell } from "@/components/layout/app-shell";
import { getUser } from "@/lib/auth/get-user";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user } = await getUser();
  return <AppShell user={user}>{children}</AppShell>;
}
