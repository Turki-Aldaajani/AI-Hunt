import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { NEWSLETTER } from "@/lib/config/rules";
import { issueImageUrl, issueUrl, renderArchiveHtml, renderIssueHtml } from "./render";
import type { NewsletterIssue } from "./types";

const DEFAULT = "https://turki-aldaajani.github.io/Rased/newsletter";
const original = process.env.NEWSLETTER_PUBLIC_BASE_URL;
afterEach(() => {
  if (original === undefined) delete process.env.NEWSLETTER_PUBLIC_BASE_URL;
  else process.env.NEWSLETTER_PUBLIC_BASE_URL = original;
});

const issue = {
  number: 2,
  title: "نـشـرة الـذكـاء الاصـطـنـاعـي",
  lead: "l",
  closing: "c",
  cycleEnd: "2026-09-27",
  sections: [],
} as unknown as NewsletterIssue;

test("the base address defaults to GitHub Pages and follows the environment", () => {
  delete process.env.NEWSLETTER_PUBLIC_BASE_URL;
  assert.equal(NEWSLETTER.publicBaseUrl, DEFAULT);
  process.env.NEWSLETTER_PUBLIC_BASE_URL = "https://news.example.com/ ";
  assert.equal(NEWSLETTER.publicBaseUrl, "https://news.example.com");
  process.env.NEWSLETTER_PUBLIC_BASE_URL = "https://news.example.com///";
  assert.equal(issueUrl(7), "https://news.example.com/07/");
  process.env.NEWSLETTER_PUBLIC_BASE_URL = "   ";
  assert.equal(NEWSLETTER.publicBaseUrl, DEFAULT);
});

test("issue addresses end in the folder, never index.html", () => {
  delete process.env.NEWSLETTER_PUBLIC_BASE_URL;
  assert.equal(issueUrl(2), `${DEFAULT}/02/`);
  assert.equal(issueImageUrl(2), `${DEFAULT}/02/og.png`);
  assert.equal(issueImageUrl(2, 3), `${DEFAULT}/02/og.png?v=3`);
});

test("og:url, og:image and twitter:image name the folder address and the issue's own card", () => {
  delete process.env.NEWSLETTER_PUBLIC_BASE_URL;
  const html = renderIssueHtml(issue, { mode: "publish", version: 2 });
  assert.ok(html.includes(`<meta property="og:url" content="${DEFAULT}/02/">`));
  assert.ok(html.includes(`<meta property="og:image" content="${DEFAULT}/02/og.png?v=2">`));
  assert.ok(html.includes(`<meta name="twitter:image" content="${DEFAULT}/02/og.png?v=2">`));
  assert.ok(html.includes('href="../"'));
  assert.ok(!html.includes("index.html"));
});

test("when the card could not be made the page falls back to the shared image", () => {
  delete process.env.NEWSLETTER_PUBLIC_BASE_URL;
  const html = renderIssueHtml(issue, { mode: "publish", ogImage: "shared" });
  assert.ok(html.includes(`content="${DEFAULT}/01/og-injaz.png"`));
  assert.ok(!html.includes("02/og.png"));
});

test("the archive and its links use folder addresses", () => {
  delete process.env.NEWSLETTER_PUBLIC_BASE_URL;
  const html = renderArchiveHtml([
    { number: 2, lead: "l", monthLabel: "سبتمبر 2026", href: "02/" },
    { number: 1, lead: "l", monthLabel: "سبتمبر 2026", href: "01/" },
  ]);
  assert.ok(html.includes('href="02/"') && html.includes('href="01/"'));
  assert.ok(html.includes(`<meta property="og:url" content="${DEFAULT}/">`));
  assert.ok(!html.includes("index.html"));
});
