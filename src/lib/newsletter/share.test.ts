import assert from "node:assert/strict";
import { test } from "node:test";
import { X_LIMIT, shareLink, shareTexts, xLength } from "./share";

const source = {
  number: 2,
  lead: "نختصر لك ما يستحق معرفته.",
  sections: [
    { items: [{ title: "نموذج جديد من جوجل" }, { title: "ثان" }] },
    { items: [] },
    { items: [{ title: "أداة جديدة للطلاب" }] },
  ],
};
const url = "https://example.test/newsletter/02/";

test("the link gets ?v=N only from the second publication on", () => {
  assert.equal(shareLink(url, 1), url);
  assert.equal(shareLink(url, 2), `${url}?v=2`);
  assert.equal(shareTexts(source, url, 1).x.includes("?v="), false);
  const texts = shareTexts(source, url, 3);
  for (const text of [texts.x, texts.linkedin, texts.whatsapp]) {
    assert.ok(text.includes(`${url}?v=3`));
  }
});

test("the X post fits inside the limit however long the headline", () => {
  const long = { ...source, sections: [{ items: [{ title: "عنوان طويل جدا ".repeat(60) }] }] };
  const { x } = shareTexts(long, url, 2);
  assert.ok(xLength(x) <= X_LIMIT, `${xLength(x)} characters`);
  assert.ok(x.endsWith(`${url}?v=2`));
});

test("LinkedIn lists one highlight per section, WhatsApp bolds the title, none carries an emoji", () => {
  const t = shareTexts(source, url, 1);
  assert.ok(t.linkedin.includes("- نموذج جديد من جوجل"));
  assert.ok(t.linkedin.includes("- أداة جديدة للطلاب"));
  assert.ok(!t.linkedin.includes("- ثان"));
  assert.ok(t.whatsapp.startsWith("*نشرة الذكاء الاصطناعي، العدد الثاني*"));
  for (const text of [t.x, t.linkedin, t.whatsapp]) {
    assert.ok(!/\p{Extended_Pictographic}/u.test(text), "no emoji");
    assert.ok(text.includes(url));
  }
});

test("an issue with no items still produces a post", () => {
  const t = shareTexts({ number: 3, lead: "", sections: [] }, url, 1);
  assert.ok(t.x.includes(url) && t.linkedin.includes(url) && t.whatsapp.includes(url));
});
