import type { Database } from "@/lib/db/schema";
import { LEGACY_ISSUES } from "@/lib/newsletter/legacy";
import { cycleKeyWith, cycleLabelWith } from "@/lib/util/date";
import { cycleLeaderboard, knownCycles } from "./leaderboard";

/**
 * Every member's points in every cycle, side by side (issue #25).
 *
 * Read-only by construction: it takes a database snapshot and returns plain
 * data. Nothing is stored per cycle, so each column is rebuilt from the
 * contributions keyed to that cycle with the same `cycleLeaderboard` the
 * board uses, which means a column here always matches what the board showed
 * for that cycle.
 */

export interface PointsHistoryCycle {
  key: string;
  label: string;
  /** The newsletter issue that covered this cycle, when there is one. */
  issueNumber: number | null;
  current: boolean;
}

export interface PointsHistoryCell {
  points: number;
  base: number;
  /** Section bonuses plus the diversity bonus. */
  bonus: number;
  submissions: number;
}

export interface PointsHistoryRow {
  memberId: string;
  memberName: string;
  active: boolean;
  /** One per column in `cycles`, same order. */
  cells: PointsHistoryCell[];
  total: number;
}

export interface PointsHistory {
  /** Oldest first, so a row reads in the order the cycles happened. */
  cycles: PointsHistoryCycle[];
  rows: PointsHistoryRow[];
  /** Column sums, same order as `cycles`. */
  totals: number[];
}

export function pointsHistory(db: Database, now: Date = new Date()): PointsHistory {
  const overrides = db.cycleEndOverrides;
  const current = cycleKeyWith(now, overrides);
  const live = db.contributions.filter((c) => !c.removed);

  const issueByCycle = new Map<string, number>();
  for (const i of LEGACY_ISSUES) issueByCycle.set(i.cycleKey, i.number);
  for (const i of db.newsletters) issueByCycle.set(i.cycleKey, i.number);

  // Only cycles someone sent something in, plus the running one.
  const withData = new Set(live.map((c) => c.cycleKey));
  const keys = knownCycles(live)
    .filter((k) => withData.has(k) || k === current)
    .reverse();

  const cycles = keys.map((key) => ({
    key,
    label: cycleLabelWith(key, overrides),
    issueNumber: issueByCycle.get(key) ?? null,
    current: key === current,
  }));

  const boards = keys.map((key) => {
    const byMember = new Map<string, PointsHistoryCell>();
    for (const r of cycleLeaderboard(db.members, live, key)) {
      byMember.set(r.memberId, {
        points: r.points,
        base: r.basePoints,
        bonus: r.bonusPoints + r.diversityPoints,
        submissions: r.submissions,
      });
    }
    return byMember;
  });

  const empty: PointsHistoryCell = { points: 0, base: 0, bonus: 0, submissions: 0 };
  const rows = db.members
    .map((m) => {
      const cells = boards.map((b) => b.get(m.id) ?? empty);
      return {
        memberId: m.id,
        memberName: m.name,
        active: m.active,
        cells,
        total: cells.reduce((sum, c) => sum + c.points, 0),
      };
    })
    // A former member with nothing on record would only be an empty row.
    .filter((r) => r.active || r.cells.some((c) => c.submissions > 0))
    .sort((a, b) => b.total - a.total || a.memberName.localeCompare(b.memberName));

  return {
    cycles,
    rows,
    totals: keys.map((_, i) => rows.reduce((sum, r) => sum + r.cells[i].points, 0)),
  };
}
