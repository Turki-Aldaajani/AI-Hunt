import assert from "node:assert/strict";
import { test } from "node:test";
import { clipWords, leadHeadline, renderOgImage, rtlRuns } from "./og-image";
import type { NewsletterIssue } from "./types";

const issue = (sections: { id: string; items: { title: string }[] }[]) =>
  ({ number: 2, cycleEnd: "2026-09-27", sections }) as unknown as NewsletterIssue;

test("the headline is the lead story, else the first item of any section", () => {
  assert.equal(
    leadHeadline(
      issue([
        { id: "models", items: [{ title: "m" }] },
        { id: "top_news", items: [{ title: "t" }] },
      ]),
    ),
    "t",
  );
  assert.equal(
    leadHeadline(
      issue([
        { id: "models", items: [] },
        { id: "learn", items: [{ title: " l " }] },
      ]),
    ),
    "l",
  );
  assert.equal(leadHeadline(issue([])), "");
});

test("runs keep Latin words together and take Arabic words one by one", () => {
  const runs = rtlRuns("OpenAI تطلق GPT-5 Turbo للمطورين");
  assert.equal(runs.length, 4);
  assert.equal(runs[0].text, "OpenAI");
  assert.equal(runs[2].text, "GPT-5 Turbo");
  assert.ok(runs.every((r) => !r.attached));
});

test("a word that mixes scripts is cut where they change, so Latin is never turned around", () => {
  // "وGoogle": the conjunction and the name are two runs, written against each other.
  const runs = rtlRuns("وGoogle");
  assert.equal(runs.length, 2);
  assert.equal(runs[1].text, "Google");
  assert.equal(runs[1].attached, true);
  // Punctuation after an Arabic word is its own attached run, in the right order.
  const comma = rtlRuns("الجديد،");
  assert.equal(comma[comma.length - 1].text, "،");
  assert.equal(comma[comma.length - 1].attached, true);
});

test("an Arabic comma after a Latin name is its own run, attached on the left", () => {
  const runs = rtlRuns("Gemini 3 Ultra،");
  assert.equal(runs.length, 2);
  assert.equal(runs[0].text, "Gemini 3 Ultra");
  assert.equal(runs[1].text, "،");
  assert.equal(runs[1].attached, true);
});

test("digits stay in reading order, Arabic-Indic ones included", () => {
  assert.equal(rtlRuns("2026")[0].text, "2026");
  assert.equal(rtlRuns("١٢")[0].text, "١٢");
  const mixed = rtlRuns("عام2026");
  assert.equal(mixed[mixed.length - 1].text, "2026");
});

test("a long headline is cut at a word boundary, never mid-word", () => {
  const text = "الجهات التنظيمية تعلن إطارا جديدا لتنظيم نماذج الذكاء الاصطناعي التوليدي يشمل متطلبات الشفافية";
  const clipped = clipWords(text, 60);
  assert.ok(clipped.endsWith("…"));
  assert.ok(text.startsWith(clipped.slice(0, -1)), "a prefix of the original");
  assert.equal(text[clipped.length - 1], " ", "ends where a word ended");
  assert.equal(clipWords("قصير", 60), "قصير");
});

test("the card is a 1200x630 PNG", async () => {
  const png = await renderOgImage(
    issue([
      { id: "top_news", items: [{ title: "OpenAI تطلق GPT-5 Turbo للمطورين مع دعم الوكلاء" }] },
    ]),
  );
  assert.deepEqual([...png.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.equal(png.readUInt32BE(16), 1200);
  assert.equal(png.readUInt32BE(20), 630);
  assert.ok(png.length > 5_000, "not an empty image");
});

test("an issue with nothing in it still gets a card", async () => {
  const png = await renderOgImage(issue([]));
  assert.equal(png.readUInt32BE(16), 1200);
});
