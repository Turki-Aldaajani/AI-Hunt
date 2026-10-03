import {
  effectivePoints,
  type Contribution,
  type CycleChange,
  type Database,
  type PointsAward,
} from "@/lib/db/schema";
import { cycleKey, cycleLabel } from "@/lib/util/date";
import { decidePoints } from "./points";

/**
 * A host putting a contribution in another cycle, after the fact.
 *
 * The submission date never changes; the row is re-keyed to the chosen cycle
 * and locked there, so moving a cycle's end date can no longer carry it back.
 * Its base point is decided again against the target cycle, exactly as if it
 * had been submitted there last: the cap applies, and nothing in the cycle it
 * left is recomputed. Bonuses follow on their own, since they are settled per
 * cycle at read time.
 */

export class CycleAssignError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

export const DEFAULT_ASSIGNER = "المضيف";

const CYCLE_RE = /^C\d{4}$/;

export interface CycleAssignmentPlan {
  contributionId: string;
  title: string;
  memberName: string;
  from: string;
  to: string;
  fromLabel: string;
  toLabel: string;
  /** Effective points before and after the move. */
  pointsBefore: number;
  pointsAfter: number;
  /** The target cycle's cap leaves this contribution without its point. */
  capped: boolean;
  /** A host points override decides the effective value either way. */
  overridden: boolean;
  /** Draft issues the contribution will be taken out of. */
  draftIssues: number[];
  /** The base award it will carry in the target cycle. */
  points: PointsAward;
}

function inIssue(issue: Database["newsletters"][number], id: string): boolean {
  return issue.sections.some((s) => s.items.some((i) => i.contributionId === id));
}

export function planCycleAssignment(
  db: Database,
  contributionId: string,
  to: string,
  now: Date = new Date(),
): CycleAssignmentPlan {
  const c = db.contributions.find((x) => x.id === contributionId);
  if (!c || c.removed) throw new CycleAssignError("المساهمة غير متاحة.", 404);
  if (!CYCLE_RE.test(to)) throw new CycleAssignError("الدورة غير صالحة.");
  if (to > cycleKey(now)) {
    throw new CycleAssignError("لا تُسند مساهمة إلى دورة لم تبدأ بعد.", 422);
  }
  if (to === c.cycleKey) {
    throw new CycleAssignError("المساهمة في هذه الدورة بالفعل.", 409);
  }
  const published = db.newsletters.find(
    (n) => n.status === "published" && inIssue(n, c.id),
  );
  if (published) {
    throw new CycleAssignError(
      `المساهمة منشورة في العدد ${published.number}. أزلها منه وأعد نشره أولًا.`,
      409,
    );
  }

  const totalBefore = db.contributions
    .filter(
      (x) =>
        !x.removed && x.id !== c.id && x.memberId === c.memberId && x.cycleKey === to,
    )
    .reduce((sum, x) => sum + effectivePoints(x), 0);
  const decision = decidePoints(c.status, to, totalBefore);
  const points: PointsAward = {
    awarded: decision.awarded,
    reason: decision.reason,
    cycleKey: decision.cycleKey,
    cycleTotalBefore: decision.cycleTotalBefore,
  };

  return {
    contributionId: c.id,
    title: c.title,
    memberName: c.memberName,
    from: c.cycleKey,
    to,
    fromLabel: cycleLabel(c.cycleKey),
    toLabel: cycleLabel(to),
    pointsBefore: effectivePoints(c),
    pointsAfter: effectivePoints({ ...c, points }),
    capped: decision.reason === "cycle_cap_reached",
    overridden: c.adminOverride?.points != null,
    draftIssues: db.newsletters
      .filter(
        (n) =>
          n.status !== "published" &&
          (inIssue(n, c.id) || n.unused.some((u) => u.contributionId === c.id)),
      )
      .map((n) => n.number),
    points,
  };
}

export interface CycleAssignmentAudit {
  reason: string;
  by?: string;
  at?: string;
}

/**
 * Writes a plan into `db` (inside a `mutate`): re-keys, locks and re-awards
 * the contribution and appends the audit entry. Draft issues are the
 * caller's to clean up, since that needs the newsletter validator.
 */
export function applyCycleAssignment(
  db: Database,
  plan: CycleAssignmentPlan,
  audit: CycleAssignmentAudit,
  kind: CycleChange["kind"] = "assigned",
): Contribution {
  const reason = audit.reason.trim();
  if (!reason) throw new CycleAssignError("اكتب سبب النقل.");
  const idx = db.contributions.findIndex((c) => c.id === plan.contributionId);
  if (idx === -1) throw new CycleAssignError("المساهمة غير متاحة.", 404);
  const current = db.contributions[idx];

  const entry: CycleChange = {
    kind,
    from: plan.from,
    to: plan.to,
    by: (audit.by ?? "").trim() || DEFAULT_ASSIGNER,
    at: audit.at ?? new Date().toISOString(),
    reason,
    pointsBefore: plan.pointsBefore,
    pointsAfter: plan.pointsAfter,
  };
  const next: Contribution = {
    ...current,
    cycleKey: plan.to,
    cycleLocked: true,
    points: plan.points,
    cycleHistory: [...(current.cycleHistory ?? []), entry],
  };
  db.contributions[idx] = next;
  return next;
}
