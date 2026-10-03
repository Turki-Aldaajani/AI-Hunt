import { NextResponse } from "next/server";
import { adminRoute, readJson } from "@/lib/newsletter/http";
import { isSectionId } from "@/lib/newsletter/sections";
import {
  NewsletterError,
  addItemFromOtherCycle,
  getIssueWithContext,
  previewCycleAssignment,
} from "@/lib/newsletter/service";
import { getIssue } from "@/lib/db/store";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

type Ctx = { params: Promise<{ id: string }> };

/** What moving a contribution into this issue's cycle would do. Writes nothing. */
export async function GET(req: Request, { params }: Ctx) {
  return adminRoute(req, async () => {
    const { id } = await params;
    const contributionId = new URL(req.url).searchParams.get("contributionId") ?? "";
    const issue = await getIssue(id);
    if (!issue) throw new NewsletterError("العدد غير موجود.", 404);
    if (!contributionId) {
      return NextResponse.json({ error: "اختر مساهمة." }, { status: 400 });
    }
    return NextResponse.json({
      plan: await previewCycleAssignment(contributionId, issue.cycleKey),
    });
  });
}

/** Moves a contribution from another cycle into this issue's cycle and adds it. */
export async function POST(req: Request, { params }: Ctx) {
  return adminRoute(req, async () => {
    const { id } = await params;
    const body = await readJson(req);
    const contributionId = String(body.contributionId ?? "");
    if (!contributionId || !isSectionId(body.sectionId)) {
      return NextResponse.json({ error: "اختر مساهمة وقسمًا." }, { status: 400 });
    }
    const { error } = await addItemFromOtherCycle(id, contributionId, body.sectionId, {
      reason: String(body.reason ?? ""),
      by: String(body.by ?? ""),
      confirmPublishedEdit: body.confirmPublishedEdit === true,
    });
    return NextResponse.json({
      ...(await getIssueWithContext(id)),
      regenerateError: error,
    });
  });
}
