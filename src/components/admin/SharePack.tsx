"use client";

import { Check, Copy } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { X_LIMIT, shareTexts, xLength, type ShareSource } from "@/lib/newsletter/share";

/**
 * The share pack of a published issue: the link, and wording ready to post on
 * X, LinkedIn and WhatsApp. Once the issue has been republished the texts
 * carry ?v=N, so the platforms fetch the page and its card again.
 */
export function SharePack({
  issue,
  url,
  imageUrl,
  version,
  editedAfterPublish,
}: {
  issue: ShareSource;
  url: string;
  imageUrl?: string;
  version: number;
  /** Changes not yet republished: what people see is the last published version. */
  editedAfterPublish: boolean;
}) {
  const texts = shareTexts(issue, url, version);
  const [copied, setCopied] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [imageOk, setImageOk] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function copy(key: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setFailed(false);
      setCopied(key);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(null), 2000);
    } catch {
      setFailed(true);
    }
  }

  const CopyButton = ({ id, value, label }: { id: string; value: string; label: string }) => (
    <Button variant="outline" size="sm" onClick={() => copy(id, value)}>
      {copied === id ? <Check /> : <Copy />}
      {copied === id ? "تم النسخ" : label}
    </Button>
  );

  const posts: { id: "x" | "linkedin" | "whatsapp"; label: string; hint?: string }[] = [
    { id: "x", label: "X", hint: `${xLength(texts.x)} من ${X_LIMIT}` },
    { id: "linkedin", label: "LinkedIn" },
    { id: "whatsapp", label: "واتساب" },
  ];

  return (
    <Card className="space-y-5 p-5">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-sm font-semibold text-foreground">حزمة المشاركة</h2>
        <span className="text-xs text-muted-foreground" dir="ltr">
          {texts.link}
        </span>
        <span className="ms-auto">
          <CopyButton id="link" value={url} label="نسخ الرابط" />
        </span>
      </div>

      {editedAfterPublish && (
        <p className="text-xs" style={{ color: "var(--warning)" }}>
          عُدّل العدد بعد نشره. ما يراه القرّاء هو النسخة المنشورة، فأعد نشره قبل المشاركة.
        </p>
      )}
      {version > 1 && (
        <p className="text-xs text-muted-foreground">
          أُعيد نشر العدد، فالنصوص أدناه تحمل ?v={version} حتى تجلب المنصات الصفحة وصورتها من
          جديد.
        </p>
      )}

      {imageUrl && imageOk && (
        // The published card itself, as the platforms will fetch it.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt="صورة معاينة العدد"
          width={1200}
          height={630}
          className="aspect-[1200/630] w-full max-w-sm rounded-md border border-border"
          onError={() => setImageOk(false)}
        />
      )}

      <div className="space-y-4">
        {posts.map((p) => (
          <div key={p.id}>
            <div className="mb-1.5 flex flex-wrap items-center gap-3">
              <Label className="mb-0">{p.label}</Label>
              {p.hint && <span className="text-xs text-muted-foreground">{p.hint}</span>}
              <span className="ms-auto">
                <CopyButton id={p.id} value={texts[p.id]} label="نسخ النص" />
              </span>
            </div>
            <Textarea readOnly value={texts[p.id]} rows={p.id === "linkedin" ? 8 : 4} />
          </div>
        ))}
      </div>

      {failed && (
        <p className="text-xs" style={{ color: "var(--destructive)" }}>
          تعذّر النسخ تلقائيًا. حدّد النص وانسخه يدويًا.
        </p>
      )}
    </Card>
  );
}
