import { formatRelativeAr } from "@/lib/utils";
import Link from "next/link";
import { FileText } from "lucide-react";

interface Document {
  id: string;
  title: string;
  type?: string | null;
  created_at: string;
}

export function RecentDocuments({ documents }: { documents: Document[] }) {
  return (
    <div className="bg-white rounded-xl border border-border p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          <FileText size={18} className="text-blue-500" />
          آخر المستندات
        </h3>
        <Link href="/documents" className="text-xs text-primary hover:underline">عرض الكل</Link>
      </div>
      {documents.length === 0 ? (
        <p className="text-center text-muted-foreground text-sm py-6">لا توجد مستندات بعد</p>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <div key={doc.id} className="p-3 rounded-lg border border-border flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
                <FileText size={15} className="text-blue-500" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground line-clamp-1">{doc.title}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  {doc.type && <span className="text-xs text-muted-foreground">{doc.type}</span>}
                  <span className="text-xs text-muted-foreground">{formatRelativeAr(doc.created_at)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
