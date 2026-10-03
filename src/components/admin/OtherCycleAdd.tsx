"use client";

import { Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SECTIONS, type SectionId } from "@/lib/newsletter/sections";
import { cn } from "@/lib/utils";

export interface OtherCycleCandidate {
  contributionId: string;
  title: string;
  memberName: string;
  editorialScore: number;
  status: string;
  cycleKey: string;
  cycleLabel: string;
}

interface AssignPlan {
  title: string;
  memberName: string;
  fromLabel: string;
  toLabel: string;
  pointsBefore: number;
  pointsAfter: number;
  capped: boolean;
  overridden: boolean;
  draftIssues: number[];
}

const SELECT_CLASS =
  "h-9 rounded-md border border-input bg-card px-2 text-sm text-foreground transition-colors duration-200 focus-visible:border-ring focus-visible:outline-none";

const SHOWN = 30;

/**
 * "Add a contribution from another cycle." Picking one shows what the move
 * would do, from and to which cycle and what it does to the member's points,
 * and asks for a reason before anything is written. The move and the add
 * happen on the server in that order.
 */
export function OtherCycleAdd<T>({
  issueId,
  published,
  dirty,
  disabled,
  candidates,
  defaultSection,
  send,
  onDone,
}: {
  issueId: string;
  published: boolean;
  /** Unsaved edits would be replaced by the server's copy, so save first. */
  dirty: boolean;
  disabled: boolean;
  candidates: OtherCycleCandidate[];
  defaultSection: SectionId;
  send: (url: string, init?: RequestInit) => Promise<Response>;
  onDone: (payload: T, notice: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<OtherCycleCandidate | null>(null);
  const [plan, setPlan] = useState<AssignPlan | null>(null);
  const [sectionId, setSectionId] = useState<SectionId>(defaultSection);
  const [reason, setReason] = useState("");
  const [by, setBy] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter((c) =>
      [c.title, c.memberName, c.cycleLabel].some((v) => v.toLowerCase().includes(q)),
    );
  }, [candidates, query]);

  function reset() {
    setPicked(null);
    setPlan(null);
    setReason("");
    setBy("");
    setError(null);
  }

  async function pick(c: OtherCycleCandidate) {
    reset();
    setPicked(c);
    setSectionId(defaultSection);
    setBusy(true);
    try {
      const res = await send(
        `/api/newsletters/${issueId}/assign?contributionId=${encodeURIComponent(c.contributionId)}`,
      );
      const body = (await res.json().catch(() => ({}))) as { plan?: AssignPlan; error?: string };
      if (!res.ok || !body.plan) {
        setError(body.error ?? "تعذّر تجهيز النقل.");
        return;
      }
      setPlan(body.plan);
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    if (!picked || !reason.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await send(`/api/newsletters/${issueId}/assign`, {
        method: "POST",
        body: JSON.stringify({
          contributionId: picked.contributionId,
          sectionId,
          reason: reason.trim(),
          by: by.trim(),
          confirmPublishedEdit: published,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as T & { error?: string };
      if (!res.ok) {
        setError(body.error ?? "لم ينجح النقل.");
        return;
      }
      onDone(
        body,
        published
          ? "نُقلت المساهمة وأُضيفت. العدد منشور، أعد نشره لتظهر الإضافة."
          : "نُقلت المساهمة إلى دورة هذا العدد وأُضيفت.",
      );
      reset();
    } finally {
      setBusy(false);
    }
  }

  const locked = disabled || busy || dirty;

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-4">
        <h2 className="text-sm font-semibold text-foreground">
          إضافة مساهمة من دورة أخرى
        </h2>
        <Input
          className="ms-auto h-9 w-56"
          value={query}
          placeholder="بحث بالعنوان أو الاسم أو الدورة"
          aria-label="بحث"
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {dirty && (
        <p className="border-b border-border px-5 py-3 text-xs text-muted-foreground">
          احفظ تعديلاتك أولًا، فالإضافة من دورة أخرى تعيد تحميل العدد من الخادم.
        </p>
      )}

      {picked && (
        <div className="space-y-4 border-b border-border px-5 py-4">
          {!plan ? (
            <p className="text-sm text-muted-foreground">
              {busy ? "جارٍ تجهيز النقل…" : (error ?? "")}
            </p>
          ) : (
            <>
              <div className="space-y-1.5 text-sm text-foreground">
                <p>
                  نقل «{plan.title}» ({plan.memberName}) من دورة {plan.fromLabel} إلى دورة{" "}
                  {plan.toLabel}.
                </p>
                <p className="text-muted-foreground">
                  نقاطها ومكانها في لوحة المتصدرين والبونص تنتقل معها إلى الدورة الجديدة. تاريخ
                  الرفع الأصلي لا يتغير.
                </p>
                <p>
                  النقاط قبل النقل: {plan.pointsBefore} · بعد النقل: {plan.pointsAfter}
                </p>
                {plan.capped && !plan.overridden && (
                  <p style={{ color: "var(--warning)" }}>
                    العضو بلغ الحد الأقصى لنقاط الدورة الجديدة، فلن تُحتسب لهذه المساهمة نقطة
                    هناك.
                  </p>
                )}
                {plan.overridden && (
                  <p className="text-muted-foreground">
                    لهذه المساهمة نقاط عدّلها المضيف، وتبقى كما هي.
                  </p>
                )}
                {plan.draftIssues.length > 0 && (
                  <p className="text-muted-foreground">
                    ستُزال من مسودة العدد {plan.draftIssues.join("، ")}.
                  </p>
                )}
                {published && (
                  <p className="text-muted-foreground">
                    هذا العدد منشور: الإضافة تعديل عليه، وتحتاج إعادة نشر بعدها.
                  </p>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>القسم</Label>
                  <select
                    className={cn(SELECT_CLASS, "w-full")}
                    value={sectionId}
                    onChange={(e) => setSectionId(e.target.value as SectionId)}
                  >
                    {SECTIONS.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>من ينقلها</Label>
                  <Input value={by} placeholder="المضيف" onChange={(e) => setBy(e.target.value)} />
                </div>
              </div>
              <div>
                <Label>سبب النقل</Label>
                <Textarea
                  value={reason}
                  required
                  placeholder="مطلوب، يُحفظ في سجل المساهمة"
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>

              {error && <p className="text-sm text-muted-foreground">{error}</p>}

              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={confirm} disabled={locked || !reason.trim()}>
                  {busy ? <Loader2 className="animate-spin" /> : null}
                  {published ? "تأكيد التعديل والنقل" : "تأكيد النقل والإضافة"}
                </Button>
                <Button variant="ghost" size="sm" onClick={reset} disabled={busy}>
                  إلغاء
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {matches.length === 0 ? (
        <p className="px-5 py-6 text-sm text-muted-foreground">
          {candidates.length === 0
            ? "لا توجد مساهمات متاحة في دورات أخرى."
            : "لا نتائج لهذا البحث."}
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {matches.slice(0, SHOWN).map((c) => (
            <li key={c.contributionId} className="flex flex-wrap items-center gap-3 px-5 py-3">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-foreground">{c.title}</span>
                <span className="block text-xs text-muted-foreground">
                  {c.memberName} · دورة {c.cycleLabel} · تحريريًا {c.editorialScore} · {c.status}
                </span>
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={locked}
                onClick={() => pick(c)}
              >
                اختيار
              </Button>
            </li>
          ))}
        </ul>
      )}
      {matches.length > SHOWN && (
        <p className="border-t border-border px-5 py-3 text-xs text-muted-foreground">
          تظهر أول {SHOWN} نتيجة، ضيّق البحث لرؤية غيرها.
        </p>
      )}
    </Card>
  );
}
