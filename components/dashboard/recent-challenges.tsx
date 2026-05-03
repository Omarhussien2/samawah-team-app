import { formatRelativeAr } from "@/lib/utils";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";

interface Challenge {
  id: string;
  title: string;
  risk_impact?: string | null;
  created_at: string;
  project_id: string;
}

export function RecentChallenges({ challenges }: { challenges: Challenge[] }) {
  return (
    <div className="bg-white rounded-xl border border-border p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          <AlertTriangle size={18} className="text-amber-500" />
          آخر التحديات المفتوحة
        </h3>
        <Link href="/challenges" className="text-xs text-primary hover:underline">عرض الكل</Link>
      </div>
      {challenges.length === 0 ? (
        <p className="text-center text-muted-foreground text-sm py-6">ما فيه تحديات مفتوحة</p>
      ) : (
        <div className="space-y-2">
          {challenges.map((c) => (
            <div key={c.id} className="p-3 rounded-lg border border-border">
              <p className="text-sm font-medium text-foreground line-clamp-1">{c.title}</p>
              <div className="flex items-center gap-2 mt-1">
                {c.risk_impact && (
                  <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">
                    {c.risk_impact}
                  </span>
                )}
                <span className="text-xs text-muted-foreground">{formatRelativeAr(c.created_at)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
