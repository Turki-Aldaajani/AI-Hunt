"use client";

import { Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Member } from "@/lib/db/schema";
import { cycleKey, cycleLabel, previousCycleKey } from "@/lib/util/date";

const SELECT_CLASS =
  "h-9 w-full rounded-md border border-input bg-card px-2 text-sm text-foreground transition-colors duration-200 focus-visible:border-ring focus-visible:outline-none";

/** How far back the host can file a link. */
const CYCLES_BACK = 6;

/**
 * A host adds a link in a member's name straight into an earlier cycle. It is
 * the ordinary submission, evaluation and duplicate check included; only the
 * cycle differs, and why is recorded.
 */
export function ManualAddCard({
  passcode,
  members,
  onAdded,
}: {
  passcode: string;
  members: Member[];
  onAdded: () => void;
}) {
  const cycles = useMemo(() => {
    const keys: string[] = [];
    let key = cycleKey(new Date());
    for (let i = 0; i < CYCLES_BACK; i++) {
      const prev = previousCycleKey(key);
      if (prev === key) break;
      keys.push(prev);
      key = prev;
    }
    return keys;
  }, []);

  const active = members.filter((m) => m.active);
  const [memberId, setMemberId] = useState("");
  const [cycle, setCycle] = useState(cycles[0] ?? "");
  const [url, setUrl] = useState("");
  const [memberReason, setMemberReason] = useState("");
  const [reason, setReason] = useState("");
  const [by, setBy] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const ready = memberId && cycle && url.trim() && memberReason.trim() && reason.trim();

  async function submit() {
    if (!ready) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/contributions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-passcode": passcode },
        body: JSON.stringify({
          memberId,
          url: url.trim(),
          memberReason: memberReason.trim(),
          cycle,
          cycleReason: reason.trim(),
          cycleBy: by.trim(),
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        contribution?: { title: string; status: string };
      };
      if (!res.ok) {
        setResult(body.error ?? "لم تنجح الإضافة.");
        return;
      }
      setResult(`أُضيفت إلى دورة ${cycleLabel(cycle)}: ${body.contribution?.title ?? ""}`);
      setUrl("");
      setMemberReason("");
      setReason("");
      onAdded();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="space-y-4 p-5">
      <div>
        <h2 className="text-sm font-semibold text-foreground">إضافة مساهمة إلى دورة سابقة</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          تمر بالتقييم وفحص التكرار نفسه، وتُحتسب نقاطها وحدّها في الدورة المختارة، ويُحفظ السبب
          في سجل المساهمة.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>العضو</Label>
          <select className={SELECT_CLASS} value={memberId} onChange={(e) => setMemberId(e.target.value)}>
            <option value="">اختر</option>
            {active.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label>الدورة</Label>
          <select className={SELECT_CLASS} value={cycle} onChange={(e) => setCycle(e.target.value)}>
            {cycles.map((k) => (
              <option key={k} value={k}>
                {cycleLabel(k)}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <Label>الرابط</Label>
        <Input dir="ltr" value={url} placeholder="https://" onChange={(e) => setUrl(e.target.value)} />
      </div>
      <div>
        <Label>لماذا يهم (بكلمات العضو)</Label>
        <Textarea value={memberReason} onChange={(e) => setMemberReason(e.target.value)} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>سبب الإضافة إلى دورة سابقة</Label>
          <Input value={reason} placeholder="مطلوب" onChange={(e) => setReason(e.target.value)} />
        </div>
        <div>
          <Label>من يضيفها</Label>
          <Input value={by} placeholder="المضيف" onChange={(e) => setBy(e.target.value)} />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" onClick={submit} disabled={busy || !ready}>
          {busy ? <Loader2 className="animate-spin" /> : null}
          إضافة
        </Button>
        {result && <p className="text-sm text-muted-foreground">{result}</p>}
      </div>
    </Card>
  );
}
