import type { NextRequest } from "next/server";
import { readAuthBody, authJson } from "@/src/lib/api/auth";
import { bettingUser, bettingFailure } from "@/src/lib/api/betting";
import { requestWithdrawal } from "@/src/lib/saques/service";
export async function POST(request: NextRequest) {
  try { const body = await readAuthBody(request), user = await bettingUser(request); return authJson(await requestWithdrawal(user.id, body), 201); }
  catch (error) { return bettingFailure(error, "Não foi possível solicitar o saque simulado"); }
}
