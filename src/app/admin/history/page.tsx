"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import AdminGate from "@/components/admin/AdminGate";
import { useAdminSession } from "@/components/admin/useAdminSession";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { PointsHistory } from "@/lib/services/points-history";
import { cn } from "@/lib/utils";

/**
 * Every member's points in every cycle, side by side (issue #25). A screen to
 * read and add up by hand: no controls, no saves, and nothing here feeds the
 * leaderboard or the running cycle.
 */
export default function PointsHistoryPage() {
  const { ready, authed, signIn, send } = useAdminSession();
  const [data, setData] = useState<PointsHistory | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authed) return;
    void (async () => {
      const res = await send("/api/admin/points-history");
      if (!res.ok) {
        setError("تعذّر تحميل السجل.");
        return;
      }
      setData((await res.json()) as PointsHistory);
    })();
  }, [authed, send]);

  return (
    <AdminGate ready={ready} authed={authed} onSignIn={signIn}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <h1 className="font-serif-display text-xl font-semibold tracking-tight text-foreground">
              سجل النقاط
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              نقاط كل عضو في كل دورة، للقراءة فقط. لا شيء هنا يغيّر الترتيب أو
              الدورة الحالية.
            </p>
          </div>
          <Button asChild variant="ghost" size="sm" className="ms-auto">
            <Link href="/admin">
              <ArrowRight />
              منطقة المضيف
            </Link>
          </Button>
        </div>

        {error && (
          <p className="text-sm" style={{ color: "var(--destructive)" }}>
            {error}
          </p>
        )}

        {!data && !error && <Card className="h-40" />}

        {data && (
          <Card className="overflow-x-auto p-0">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="sticky start-0 bg-card px-4 py-3 text-start font-medium">
                    العضو
                  </th>
                  {data.cycles.map((c) => (
                    <th
                      key={c.key}
                      className={cn(
                        "px-3 py-3 text-center font-medium whitespace-nowrap",
                        c.current && "bg-muted/50",
                      )}
                    >
                      <div className="text-foreground">
                        {c.issueNumber ? `العدد ${c.issueNumber}` : c.key}
                      </div>
                      <div className="text-xs font-normal">{c.label}</div>
                      {c.current && (
                        <div className="text-xs font-normal">(الحالية)</div>
                      )}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-center font-medium">المجموع</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.memberId} className="border-b border-border last:border-0">
                    <td className="sticky start-0 bg-card px-4 py-2.5 whitespace-nowrap text-foreground">
                      {r.memberName}
                      {!r.active && (
                        <span className="ms-2 text-xs text-muted-foreground">
                          (غير نشط)
                        </span>
                      )}
                    </td>
                    {r.cells.map((cell, i) => (
                      <td
                        key={data.cycles[i].key}
                        title={`أساسية ${cell.base} + إضافية ${cell.bonus} · ${cell.submissions} مساهمة`}
                        className={cn(
                          "px-3 py-2.5 text-center tabular-nums",
                          cell.points === 0 ? "text-muted-foreground/60" : "text-foreground",
                          data.cycles[i].current && "bg-muted/50",
                        )}
                      >
                        {cell.points}
                      </td>
                    ))}
                    <td className="px-4 py-2.5 text-center font-semibold tabular-nums text-foreground">
                      {r.total}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-border text-muted-foreground">
                  <td className="sticky start-0 bg-card px-4 py-2.5">مجموع الدورة</td>
                  {data.totals.map((t, i) => (
                    <td
                      key={data.cycles[i].key}
                      className={cn(
                        "px-3 py-2.5 text-center tabular-nums",
                        data.cycles[i].current && "bg-muted/50",
                      )}
                    >
                      {t}
                    </td>
                  ))}
                  <td className="px-4 py-2.5 text-center tabular-nums">
                    {data.totals.reduce((a, b) => a + b, 0)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </Card>
        )}

        {data && (
          <p className="text-xs text-muted-foreground">
            مرّر المؤشر على أي خانة لترى النقاط الأساسية والإضافية وعدد المساهمات.
            الدورة الحالية ما زالت جارية، فأرقامها قد تتغير.
          </p>
        )}
      </div>
    </AdminGate>
  );
}
