import assert from "node:assert/strict";
import { test } from "node:test";
import { publicContribution } from "@/lib/db/schema";
import { CURRENT, OLDER, contribution, database, member } from "@/test/fixtures";
import { applyCycleAssignment, planCycleAssignment } from "./cycle-assign";
import { knownCycles, memberStats, teamSummary } from "./leaderboard";

test("a cycle older than every submission date still shows up once a row is moved there", () => {
  const only = contribution({ cycleKey: CURRENT });
  const db = database([only]);
  applyCycleAssignment(db, planCycleAssignment(db, only.id, OLDER), { reason: "r" });

  assert.ok(knownCycles(db.contributions).includes(OLDER));
  const stats = memberStats(member(), db.members, db.contributions);
  const older = stats.history.find((h) => h.cycle === OLDER);
  assert.ok(older, "the target cycle is in the member's history");
  assert.equal(older.points, 1);
  assert.equal(stats.totalPoints, 1, "the moved point is not lost from the total");
  // The cycle it left has nothing in it any more.
  assert.equal(stats.history.find((h) => h.cycle === CURRENT)?.submissions ?? 0, 0);
});

test("knownCycles stays newest first", () => {
  const keys = knownCycles([contribution({ cycleKey: CURRENT }), contribution({ cycleKey: OLDER })]);
  assert.deepEqual(keys, [...keys].sort().reverse());
});

test("the host audit never leaves through public shapes", () => {
  const c = contribution({ cycleKey: CURRENT });
  const db = database([c]);
  applyCycleAssignment(db, planCycleAssignment(db, c.id, OLDER), { reason: "secret reason" });

  const pub = publicContribution(db.contributions[0]);
  assert.ok(!("cycleHistory" in pub));
  assert.ok(!("cycleLocked" in pub));
  assert.equal(pub.cycleKey, OLDER);

  const summary = JSON.stringify(teamSummary(db.members, db.contributions));
  assert.ok(!summary.includes("secret reason"));
  assert.ok(!summary.includes("cycleHistory"));
});
