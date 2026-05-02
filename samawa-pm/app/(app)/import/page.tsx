import { getUser } from "@/lib/auth/get-user";
import { ImportClient } from "@/components/import/import-client";

export default async function ImportPage() {
  const { user } = await getUser();
  return (
    <div className="page-container">
      <ImportClient currentUser={user} />
    </div>
  );
}
