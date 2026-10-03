import assert from "node:assert/strict";
import { test } from "node:test";
import { POINTS } from "@/lib/config/rules";
import type { NewsletterIssue } from "@/lib/newsletter/types";
import { CURRENT, OLDER, PREVIOUS, contribution, database, inCycle } from "@/test/fixtures";
import { CycleAssignError, applyCycleAssignment, planCycleAssignment } from "./cycle-assign";

function issue(number: number, status: "draft" | "published", ids: string[], unused: string[] = []) {
  return {
    id: `n${number}`,
    number,
    status,
    sections: [
      { id: "models", items: ids.map((contributionId) => ({ id: `i-${contributionId}`, contributionId })) },
    ],
    unused: unused.map((contributionId) => ({ contributionId })),
  } as unknown as NewsletterIssue;
}

test("moves to an earlier cycle, keeps createdAt, locks it and writes the audit", () => {
  const c = contribution({ cycleKey: CURRENT });
  const db = database([c]);
  const plan = planCycleAssignment(db, c.id, PREVIOUS);
  assert.equal(plan.from, CURRENT);
  assert.equal(plan.to, PREVIOUS);
  assert.equal(plan.pointsBefore, 1);
  assert.equal(plan.pointsAfter, 1);
  assert.equal(plan.capped, false);

  const moved = applyCycleAssignment(db, plan, { reason: "  late entry  ", by: "" });
  assert.equal(moved.cycleKey, PREVIOUS);
  assert.equal(moved.points.cycleKey, PREVIOUS);
  assert.equal(moved.createdAt, c.createdAt);
  assert.equal(moved.cycleLocked, true);
  assert.equal(moved.cycleHistory?.length, 1);
  const [entry] = moved.cycleHistory!;
  assert.equal(entry.from, CURRENT);
  assert.equal(entry.to, PREVIOUS);
  assert.equal(entry.by, "المضيف");
  assert.equal(entry.reason, "late entry");
  assert.ok(entry.at);
});

test("the target cycle's cap applies, and the cycle it left is not recomputed", () => {
  const full = Array.from({ length: POINTS.maxBasePerCycle }, () =>
    contribution({ cycleKey: PREVIOUS }),
  );
  const capped = contribution({
    cycleKey: CURRENT,
    points: { awarded: 0, reason: "cycle_cap_reached", cycleKey: CURRENT, cycleTotalBefore: 6 },
  });
  const moving = contribution({ cycleKey: CURRENT });
  const db = database([...full, capped, moving]);

  const plan = planCycleAssignment(db, moving.id, PREVIOUS);
  assert.equal(plan.capped, true);
  assert.equal(plan.pointsBefore, 1);
  assert.equal(plan.pointsAfter, 0);
  applyCycleAssignment(db, plan, { reason: "r" });
  // Nothing in the old cycle is handed the freed point.
  assert.equal(db.contributions.find((c) => c.id === capped.id)!.points.awarded, 0);
});

test("a host points override is kept as it is", () => {
  const full = Array.from({ length: POINTS.maxBasePerCycle }, () =>
    contribution({ cycleKey: PREVIOUS }),
  );
  const c = contribution({
    cycleKey: CURRENT,
    adminOverride: {
      status: null,
      points: 3,
      primaryCategory: null,
      duplicateOutcome: null,
      note: "",
      at: inCycle(CURRENT),
    },
  });
  const db = database([...full, c]);
  const plan = planCycleAssignment(db, c.id, PREVIOUS);
  assert.equal(plan.overridden, true);
  assert.equal(plan.pointsBefore, 3);
  assert.equal(plan.pointsAfter, 3);
  const moved = applyCycleAssignment(db, plan, { reason: "r" });
  assert.equal(moved.adminOverride?.points, 3);
});

test("refuses a published contribution, a future cycle, the same cycle and an empty reason", () => {
  const c = contribution({ cycleKey: CURRENT });
  const db = database([c], { newsletters: [issue(3, "published", [c.id])] });
  assert.throws(
    () => planCycleAssignment(db, c.id, PREVIOUS),
    (e: unknown) => e instanceof CycleAssignError && e.status === 409,
  );

  const free = database([c]);
  assert.throws(() => planCycleAssignment(free, c.id, "C9999"), CycleAssignError);
  assert.throws(() => planCycleAssignment(free, c.id, CURRENT), CycleAssignError);
  const plan = planCycleAssignment(free, c.id, OLDER);
  assert.throws(() => applyCycleAssignment(free, plan, { reason: "   " }), CycleAssignError);
});

test("lists the draft issues it will be taken out of, items and unused alike", () => {
  const a = contribution({ cycleKey: CURRENT });
  const db = database([a], {
    newsletters: [issue(3, "draft", [a.id]), issue(4, "draft", [], [a.id]), issue(5, "draft", [])],
  });
  assert.deepEqual(planCycleAssignment(db, a.id, PREVIOUS).draftIssues, [3, 4]);
});
