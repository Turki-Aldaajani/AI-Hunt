import assert from "node:assert/strict";
import { test } from "node:test";
import { OLDER, contribution, database } from "@/test/fixtures";
import { applyCycleEndPlan, cycleSchedule, planCycleEnd } from "./cycle";

test("moving the current cycle's end never moves a locked contribution", () => {
  const schedule = cycleSchedule(database([]));
  // Dated after the earliest allowed end, so ending the cycle there moves it.
  const createdAt = new Date(
    new Date(`${schedule.minEnd}T12:00:00Z`).getTime() + 86400000,
  ).toISOString();
  const free = contribution({ cycleKey: schedule.cycle, createdAt });
  const locked = contribution({ cycleKey: OLDER, createdAt, cycleLocked: true });
  const db = database([free, locked]);

  const plan = planCycleEnd(db, { action: "set", end: schedule.minEnd });
  const moved = plan.moves.map((m) => m.id);
  assert.ok(moved.includes(free.id), "the unlocked row is listed as moving");
  assert.ok(!moved.includes(locked.id), "the locked row is not listed");

  applyCycleEndPlan(db, plan);
  assert.equal(db.contributions.find((c) => c.id === free.id)!.cycleKey, schedule.next.key);
  assert.equal(db.contributions.find((c) => c.id === locked.id)!.cycleKey, OLDER);

  // Leave the module-level overrides as they were.
  applyCycleEndPlan(db, { overrides: {}, moves: [] });
});
