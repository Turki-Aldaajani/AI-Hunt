"use client";

import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import { useCurrentUser } from "./CurrentUser";

export interface HomeStatsProps {
  /** Contributions made this cycle, per member id. */
  perMember: Record<string, number>;
  /** Everything the team sent this cycle. */
  thisCycle: number;
  daysLeft: number;
  leader: { id: string; name: string; points: number } | null;
}

/** Arabic number agreement: 1, 2, 3–10, and 0 or 11+ each take their own noun. */
function noun(
  n: number,
  forms: { one: string; two: string; few: string; many: string },
): string {
  if (n === 1) return forms.one;
  if (n === 2) return forms.two;
  if (n >= 3 && n <= 10) return forms.few;
  return n === 0 ? forms.few : forms.many;
}

function Num({ children }: { children: ReactNode }) {
  return (
    <span className="font-medium tabular-nums text-foreground">{children}</span>
  );
}

/**
 * What a member wants to know before pasting, how much has been sent, how long
 * is left, who is ahead, said in one quiet line under the title instead of
 * three cards beside the composer.
 */
export default function HomeStats({
  perMember,
  thisCycle,
  daysLeft,
  leader,
}: HomeStatsProps) {
  const { member, ready } = useCurrentUser();
  const mine = ready && member ? (perMember[member.id] ?? 0) : null;

  const parts: ReactNode[] = [
    <span key="cycle">
      <Num>{thisCycle}</Num>{" "}
      {noun(thisCycle, {
        one: "مساهمة",
        two: "مساهمتان",
        few: "مساهمات",
        many: "مساهمة",
      })}{" "}
      هذه الدورة
      {mine !== null && (
        <>
          {" "}
          (منها <Num>{mine}</Num> لك)
        </>
      )}
    </span>,
    <span key="days">
      <Num>{daysLeft}</Num>{" "}
      {noun(daysLeft, {
        one: "يوم متبقٍ",
        two: "يومان متبقيان",
        few: "أيام متبقية",
        many: "يومًا متبقيًا",
      })}
    </span>,
  ];

  if (leader) {
    parts.push(
      <span key="leader">
        المتصدر:{" "}
        <Link
          href="/leaderboard"
          className="text-foreground transition-colors duration-200 hover:text-interactive"
        >
          {leader.name}
        </Link>{" "}
        (<Num>{leader.points}</Num>)
      </span>,
    );
  }

  return (
    <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center text-xs text-muted-foreground">
      {parts.map((part, i) => (
        <Fragment key={i}>
          {i > 0 && <span aria-hidden>·</span>}
          {part}
        </Fragment>
      ))}
    </p>
  );
}
