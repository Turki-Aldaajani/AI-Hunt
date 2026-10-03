import { truncate } from "@/lib/util/text";
import { issueOrdinal } from "./format";

/**
 * Ready-to-post wording for a published issue. Plain text, no emoji, written
 * in the newsletter's own voice. Pure, so the editor and the tests share it.
 */

/** X counts every link as 23 characters, whatever its length. */
export const X_LIMIT = 280;
const X_LINK_LENGTH = 23;

export interface ShareSource {
  number: number;
  lead: string;
  sections: { items: { title: string }[] }[];
}

export interface ShareTexts {
  /** The address the texts carry: with ?v=N once the issue was republished. */
  link: string;
  x: string;
  linkedin: string;
  whatsapp: string;
}

/** The link as posted: the folder address, plus ?v=N from the second publication on. */
export function shareLink(url: string, version: number): string {
  return version > 1 ? `${url}?v=${version}` : url;
}

/** The first item of each section that has one, in newsletter order. */
function highlights(source: ShareSource, max: number): string[] {
  return source.sections
    .map((s) => s.items[0]?.title.trim())
    .filter((t): t is string => Boolean(t))
    .slice(0, max);
}

export function shareTexts(source: ShareSource, url: string, version: number): ShareTexts {
  const link = shareLink(url, version);
  const ordinal = issueOrdinal(source.number);
  const title = `نشرة الذكاء الاصطناعي، ${ordinal}`;
  const lead = source.lead.trim();
  const [first, ...rest] = highlights(source, 4);

  // X: the title, the lead story, the link, inside 280 characters.
  const fixed = title.length + X_LINK_LENGTH + 4; // two line breaks of two
  const room = Math.max(0, X_LIMIT - fixed);
  const x = [title, first ? truncate(first, room) : "", link].filter(Boolean).join("\n\n");

  const linkedin = [
    `صدر ${ordinal} من نشرة الذكاء الاصطناعي.`,
    lead,
    first ? `في هذا العدد:\n${[first, ...rest].map((t) => `- ${t}`).join("\n")}` : "",
    `اقرأ العدد: ${link}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const whatsapp = [`*${title}*`, lead, link].filter(Boolean).join("\n\n");

  return { link, x, linkedin, whatsapp };
}

/** Weighted length as X counts it, for the editor's counter. */
export function xLength(text: string): number {
  return text.replace(/https?:\/\/\S+/g, "x".repeat(X_LINK_LENGTH)).length;
}
