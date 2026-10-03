import { readFile } from "fs/promises";
import { join } from "path";
import { ImageResponse } from "next/og";
import { shapeArabicWord } from "./arabic-shaping";
import { arabicDigits, issueOrdinal, monthOf } from "./format";
import type { NewsletterIssue } from "./types";

/**
 * The social-preview card each issue publishes with itself: 1200x630 PNG, the
 * issue's number and its lead story, drawn in the newsletter's own palette.
 * Colours and type only. No logo, no artwork.
 *
 * Issue #1 keeps its hand-made image and never goes through here.
 */

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

/** The newsletter's tokens (theme.generated.ts), dark: ink ground, sand type. */
const COLOR = {
  ground: "#131C18", // --ink
  brand: "#155043", // --brand
  accent: "#869200", // --accent
  sand: "#E3D8B3", // --sand
  text: "#FFFFFF", // --surface
} as const;

// IBM Plex Sans Arabic Bold, SIL Open Font License (see the licence file next
// to the fonts). Two files because the family ships Arabic and Latin as
// separate subsets, and headlines mix both.
let fonts: Promise<{ arabic: Buffer; latin: Buffer }> | null = null;
function loadFonts() {
  fonts ??= Promise.all([
    readFile(join(process.cwd(), "src/assets/fonts/ibm-plex-sans-arabic-arabic-700.woff")),
    readFile(join(process.cwd(), "src/assets/fonts/ibm-plex-sans-arabic-latin-700.woff")),
  ]).then(([arabic, latin]) => ({ arabic, latin }));
  // A failed read must not stick: the next publish tries again.
  fonts.catch(() => {
    fonts = null;
  });
  return fonts;
}

/** The headline the card carries: the lead story, else the first item of any section. */
export function leadHeadline(issue: NewsletterIssue): string {
  const lead = issue.sections.find((s) => s.id === "top_news" && s.items.length > 0);
  const any = lead ?? issue.sections.find((s) => s.items.length > 0);
  return any?.items[0]?.title.trim() ?? "";
}

// ---------------------------------------------------------------------------
// Right-to-left layout
//
// The renderer joins Arabic letters correctly but lays words out left to
// right and wraps lines from the left. So the words are placed by hand: each
// run is its own box in a right-to-left row that wraps from the right, and a
// run of Latin words stays one box so "GPT-5 Turbo" is not read backwards.
// ---------------------------------------------------------------------------

/** Arabic letters, and what belongs to them: tatweel and marks. */
const ARABIC_RANGE = /[؀-ٟ٪-ۯۺ-ۿݐ-ݿࢠ-ࣿ]/;
/** Punctuation inside that range (comma, semicolon, question mark, ...): not letters. */
const ARABIC_PUNCTUATION = /[،؛؟٪-٭۔]/;
const isArabicLetter = (ch: string) => ARABIC_RANGE.test(ch) && !ARABIC_PUNCTUATION.test(ch);

export interface Run {
  text: string;
  /** Written against the previous run with no space, as "و" before "Google". */
  attached: boolean;
}

/** One word cut where the script changes: "وGoogle" is "و" then "Google". */
function scriptSegments(word: string): { text: string; arabic: boolean }[] {
  const out: { text: string; arabic: boolean }[] = [];
  for (const ch of word) {
    const arabic = isArabicLetter(ch);
    const last = out[out.length - 1];
    if (last && last.arabic === arabic) last.text += ch;
    else out.push({ text: ch, arabic });
  }
  return out;
}

/**
 * Splits text into runs, in reading order. Arabic is shaped (see
 * arabic-shaping.ts) and drawn word by word; a word that mixes scripts is cut
 * where they change, so only its Arabic part is turned around; consecutive
 * words with no Arabic in them stay together as one left-to-right run.
 */
export function rtlRuns(text: string): Run[] {
  const runs: Run[] = [];
  let latin: string[] = [];
  const flush = () => {
    if (latin.length) runs.push({ text: latin.join(" "), attached: false });
    latin = [];
  };
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (![...word].some(isArabicLetter)) {
      // An Arabic comma or question mark after a Latin name belongs on its left.
      const tail = word.match(/[،؛؟]+$/)?.[0] ?? "";
      latin.push(tail ? word.slice(0, -tail.length) : word);
      if (tail) {
        flush();
        runs.push({ text: tail, attached: true });
      }
      continue;
    }
    flush();
    scriptSegments(word).forEach((seg, i) =>
      runs.push({ text: seg.arabic ? shapeArabicWord(seg.text) : seg.text, attached: i > 0 }),
    );
  }
  flush();
  return runs;
}

/** Cuts at a word boundary, never mid-word, adding an ellipsis when it cuts. */
export function clipWords(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const at = cut.lastIndexOf(" ");
  return `${(at > max * 0.5 ? cut.slice(0, at) : cut).trimEnd()}…`;
}

type El = { type: string; props: Record<string, unknown> };
const box = (style: Record<string, unknown>, children?: unknown): El => ({
  type: "div",
  props: { style: { display: "flex", ...style }, children },
});

function rtlText(text: string, size: number, color: string, lineHeight = 1.35): El {
  const runs = rtlRuns(text);
  return box(
    {
      flexDirection: "row-reverse",
      flexWrap: "wrap",
      justifyContent: "flex-start",
      fontSize: size,
      color,
      lineHeight,
    },
    // The gap sits after the last run of a word, on its left, before the next word.
    runs.map((run, i) =>
      box({ marginLeft: runs[i + 1]?.attached ? 0 : Math.round(size * 0.28) }, run.text),
    ),
  );
}

export function ogCard(issue: NewsletterIssue): El {
  const headline = clipWords(leadHeadline(issue), 100);
  const month = monthOf(issue.cycleEnd).label;
  return box(
    {
      position: "relative",
      width: OG_WIDTH,
      height: OG_HEIGHT,
      background: COLOR.ground,
      fontFamily: "Plex, PlexLatin",
      flexDirection: "column",
      justifyContent: "space-between",
      padding: 72,
    },
    [
      // The issue number, large and quiet behind everything else.
      box(
        {
          position: "absolute",
          left: 40,
          top: 40,
          fontSize: 420,
          lineHeight: 1,
          color: COLOR.brand,
        },
        arabicDigits(issue.number),
      ),
      box({ flexDirection: "column", alignItems: "flex-end" }, [
        rtlText("نشرة الذكاء الاصطناعي", 40, COLOR.accent),
        box({ width: 96, height: 6, background: COLOR.accent, marginTop: 20 }),
      ]),
      box({ flexDirection: "column" }, [
        rtlText(issueOrdinal(issue.number), 88, COLOR.sand, 1.2),
        ...(headline ? [box({ marginTop: 24, flexDirection: "column" }, [rtlText(headline, 52, COLOR.text)])] : []),
      ]),
      rtlText(month, 34, COLOR.sand),
    ],
  );
}

/** The PNG bytes for an issue's preview card. */
export async function renderOgImage(issue: NewsletterIssue): Promise<Buffer> {
  const { arabic, latin } = await loadFonts();
  const res = new ImageResponse(ogCard(issue) as never, {
    width: OG_WIDTH,
    height: OG_HEIGHT,
    fonts: [
      { name: "Plex", data: arabic, weight: 700, style: "normal" },
      { name: "PlexLatin", data: latin, weight: 700, style: "normal" },
    ],
  });
  return Buffer.from(await res.arrayBuffer());
}
