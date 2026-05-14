import { notFound } from "next/navigation";
import { BoardShareView } from "@/components/kpis/board-share-view";
import { fetchKpiBoardSnapshot } from "@/lib/kpis/share";

export default async function KpiBoardSharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const snapshot = await fetchKpiBoardSnapshot(token);

  if (!snapshot) notFound();

  return <BoardShareView snapshot={snapshot} />;
}
