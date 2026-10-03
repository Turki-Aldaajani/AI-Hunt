import assert from "node:assert/strict";
import { test } from "node:test";
import { cycleKey } from "@/lib/util/date";
import { OLDER, inCycle } from "@/test/fixtures";
import { migrateContribution } from "./store";

const createdAt = inCycle(cycleKey(new Date()));
// A row from before the contribution engine: no `points`, no `status`.
const legacyRow = { id: "old", memberId: "m1", memberName: "Reem", title: "t", url: "u", createdAt };

test("legacy migration keys an unlocked row by its date", () => {
  const row = migrateContribution({ ...legacyRow, cycleKey: OLDER });
  assert.equal(row.cycleKey, cycleKey(createdAt));
  assert.equal(row.cycleLocked, undefined);
});

test("legacy migration keeps a locked row in the cycle a host chose", () => {
  const history = [
    { kind: "assigned", from: "C0001", to: OLDER, by: "x", at: createdAt, reason: "r" },
  ];
  const row = migrateContribution({
    ...legacyRow,
    cycleKey: OLDER,
    cycleLocked: true,
    cycleHistory: history,
  });
  assert.equal(row.cycleKey, OLDER);
  assert.equal(row.points.cycleKey, OLDER);
  assert.equal(row.cycleLocked, true);
  assert.deepEqual(row.cycleHistory, history);
  assert.equal(row.createdAt, createdAt);
});

test("a current row passes through untouched, lock included", () => {
  const row = migrateContribution({
    ...legacyRow,
    status: "accepted",
    points: { awarded: 1, reason: "valid_contribution", cycleKey: OLDER, cycleTotalBefore: 0 },
    cycleKey: OLDER,
    cycleLocked: true,
  });
  assert.equal(row.cycleKey, OLDER);
  assert.equal(row.cycleLocked, true);
});
