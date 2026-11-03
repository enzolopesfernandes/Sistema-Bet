import type { NextRequest } from "next/server";
import { BET_MESSAGES, validateRecharge } from "@/lib/apostas";
import { authJson, readAuthBody } from "@/src/lib/api/auth";
import { bettingFailure, bettingUser } from "@/src/lib/api/betting";
import { rechargeBalance } from "@/src/lib/saldo/service";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await readAuthBody(request);
    const user = await bettingUser(request);
    const result = validateRecharge(body);
    if (!result.data) return authJson({ message: result.message }, 400);
    return authJson({ ...await rechargeBalance(user.id, result.data), message: BET_MESSAGES.rechargeSuccess });
  } catch (error) {
    return bettingFailure(error, BET_MESSAGES.balanceFailed);
  }
}
