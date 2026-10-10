import Composer from "@/components/Composer";
import HeroScene from "@/components/HeroScene";
import HomeStats from "@/components/HomeStats";
import QuietNav from "@/components/QuietNav";
import { DiamondRule } from "@/components/brand/DiamondRule";
import { Reveal } from "@/components/ui/reveal";
import { NEWSLETTER } from "@/lib/config/rules";
import { listContributions, listMembers } from "@/lib/db/store";
import { cycleLeaderboard } from "@/lib/services/leaderboard";
import { cycleKey, daysLeftInCycle } from "@/lib/util/date";

export const dynamic = "force-dynamic";

/**
 * The home page is still one action: paste a link. Above it, one quiet line
 * holds what a member wants to know before pasting, what has been sent, how
 * long is left, who is ahead, and everything else is a click away.
 */
export default async function HomePage() {
  const [members, contributions] = await Promise.all([
    listMembers(),
    listContributions(),
  ]);

  const cycle = cycleKey(new Date());
  const inCycle = contributions.filter((c) => c.cycleKey === cycle);

  const perMember: Record<string, number> = {};
  for (const c of inCycle) {
    perMember[c.memberId] = (perMember[c.memberId] ?? 0) + 1;
  }

  const board = cycleLeaderboard(members, contributions, cycle);
  const top = board.find((r) => r.points > 0) ?? null;

  return (
    <div className="space-y-12 py-6 sm:py-10">
      {/* One column: title, the cycle in a line, then the composer, the only
          card on the page. */}
      <section className="mx-auto w-full max-w-[640px]">
        <div className="mb-6 text-center">
          <h1 className="font-serif-display text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            ماذا اكتشفت؟
          </h1>
          <p className="mt-2.5 text-sm text-muted-foreground">
            الصق رابطًا واكتب الخبر بكلماتك، ورصد يتولّى التحقق والتصنيف.
          </p>
          <div className="mt-4">
            <HomeStats
              perMember={perMember}
              thisCycle={inCycle.length}
              daysLeft={daysLeftInCycle()}
              leader={
                top
                  ? { id: top.memberId, name: top.memberName, points: top.points }
                  : null
              }
            />
          </div>
        </div>

        <Composer />
      </section>

      <Reveal>
        <HeroScene />
      </Reveal>

      <DiamondRule />

      <QuietNav archiveUrl={NEWSLETTER.archiveUrl} />
    </div>
  );
}
