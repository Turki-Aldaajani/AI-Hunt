import { NextResponse } from "next/server";
import { readDb } from "@/lib/db/store";
import { requireAdmin } from "@/lib/services/admin";
import { pointsHistory } from "@/lib/services/points-history";

export const dynamic = "force-dynamic";

/** Every member's points per cycle. GET only: this screen never writes. */
export async function GET(req: Request) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  return NextResponse.json(pointsHistory(await readDb()));
}
