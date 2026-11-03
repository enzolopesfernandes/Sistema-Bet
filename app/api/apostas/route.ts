import type { NextRequest } from "next/server";
import { BET_MESSAGES, parsePagination, validateBet } from "@/lib/apostas";
import { authJson, readAuthBody } from "@/src/lib/api/auth";
import { bettingFailure, bettingUser } from "@/src/lib/api/betting";
import { getBetHistory, placeBet } from "@/src/lib/apostas/service";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const user = await bettingUser(request);
    const pagination = parsePagination({ page: request.nextUrl.searchParams.get("page") ?? undefined, pageSize: request.nextUrl.searchParams.get("pageSize") ?? undefined });
    return authJson(await getBetHistory(user.id, pagination.page, pagination.pageSize));
  } catch (error) {
    return bettingFailure(error, BET_MESSAGES.historyFailed);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await readAuthBody(request);
    const user = await bettingUser(request);
    const result = validateBet(body);
    if (!result.data) return authJson({ message: result.message }, 400);
    return authJson({ ...await placeBet(user.id, result.data), message: "Aposta simulada registrada com sucesso" }, 201);
  } catch (error) {
    return bettingFailure(error, "Não foi possível registrar a aposta. Tente novamente.");
  }
}
