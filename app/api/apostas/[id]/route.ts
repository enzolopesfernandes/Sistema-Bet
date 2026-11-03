import type { NextRequest } from "next/server";
import { BET_MESSAGES } from "@/lib/apostas";
import { authJson } from "@/src/lib/api/auth";
import { bettingFailure, bettingUser } from "@/src/lib/api/betting";
import { getBetDetails } from "@/src/lib/apostas/service";

export const runtime = "nodejs";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await bettingUser(request);
    return authJson({ bet: await getBetDetails(user.id, (await params).id) });
  } catch (error) {
    return bettingFailure(error, BET_MESSAGES.detailsFailed);
  }
}
