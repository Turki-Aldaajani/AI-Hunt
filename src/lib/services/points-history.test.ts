import assert from "node:assert/strict";
import { test } from "node:test";
import { CURRENT, OLDER, PREVIOUS, contribution, database, member } from "@/test/fixtures";
import { cycleLeaderboard } from "./leaderboard";
import { pointsHistory } from "./points-history";

test("each column matches that cycle's board, oldest first, current included", () => {
  const db = database(
    [
      contribution({ cycleKey: OLDER }),
      contribution({ cycleKey: OLDER }),
      contribution({ cycleKey: CURRENT }),
      contribution({ cycleKey: CURRENT, memberId: "m2", memberName: "Sara" }),
    ],
    { members: [member(), member("m2", "Sara")] },
  );
  const h = pointsHistory(db);

  // PREVIOUS has no submissions, so it gets no column.
  assert.deepEqual(h.cycles.map((c) => c.key), [OLDER, CURRENT]);
  assert.equal(h.cycles.at(-1)?.current, true);

  const reem = h.rows.find((r) => r.memberId === "m1")!;
  assert.deepEqual(reem.cells.map((c) => c.points), [2, 1]);
  assert.equal(reem.total, 3);
  assert.deepEqual(h.totals, [2, 2]);

  for (const [i, c] of h.cycles.entries()) {
    const board = cycleLeaderboard(db.members, db.contributions, c.key);
    for (const row of h.rows) {
      assert.equal(row.cells[i].points, board.find((b) => b.memberId === row.memberId)!.points);
    }
  }
});

test("it never changes the database it reads", () => {
  const db = database([contribution({ cycleKey: PREVIOUS }), contribution({ cycleKey: CURRENT })]);
  const before = JSON.stringify(db);
  pointsHistory(db);
  assert.equal(JSON.stringify(db), before);
});

test("removed rows do not count and empty former members are left out", () => {
  const gone = { ...member("m3", "Old"), active: false };
  const db = database([contribution({ cycleKey: CURRENT, removed: true })], {
    members: [member(), gone],
  });
  const h = pointsHistory(db);
  assert.deepEqual(h.rows.map((r) => r.memberId), ["m1"]);
  assert.equal(h.rows[0].total, 0);
});
