import assert from "node:assert/strict";
import { test } from "node:test";
import { shapeArabicWord } from "./arabic-shaping";

const cps = (s: string) => [...s].map((c) => c.codePointAt(0)!.toString(16));

test("a dual-joining word takes initial, medial and final forms, returned in on-screen order", () => {
  // كتب: kaf initial FEDB, teh medial FE98, beh final FE90; shown last letter first.
  assert.deepEqual(cps(shapeArabicWord("كتب")), ["fe90", "fe98", "fedb"]);
});

test("right-joining letters do not connect to the letter after them", () => {
  // دار: none of the three joins forward, so each stands isolated:
  // dal FEA9, alef FE8D, reh FEAD. Shown last letter first.
  assert.deepEqual(cps(shapeArabicWord("دار")), ["fead", "fe8d", "fea9"]);
  // بدر: beh joins forward to dal (beh initial FE91, dal final FEAA); dal does
  // not join forward, so reh is isolated FEAD.
  assert.deepEqual(cps(shapeArabicWord("بدر")), ["fead", "feaa", "fe91"]);
});

test("lam followed by alef becomes one ligature glyph", () => {
  assert.deepEqual(cps(shapeArabicWord("لا")), ["fefb"]);
  // After a joining letter it takes the final form of the ligature: بلا.
  assert.deepEqual(cps(shapeArabicWord("بلا")), ["fefc", "fe91"]);
});

test("a single letter is isolated, and other characters pass through", () => {
  assert.deepEqual(cps(shapeArabicWord("ب")), ["fe8f"]);
  assert.equal(shapeArabicWord("،"), "،");
});

test("diacritics are dropped", () => {
  assert.equal(shapeArabicWord("بَ"), shapeArabicWord("ب"));
});
