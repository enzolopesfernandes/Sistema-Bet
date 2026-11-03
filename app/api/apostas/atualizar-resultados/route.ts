import type { NextRequest } from "next/server";
import { assertSameOrigin, authJson } from "@/src/lib/api/auth";
import { bettingFailure, bettingUser } from "@/src/lib/api/betting";
import { updateBetResults } from "@/src/lib/apostas/settlement";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const user = await bettingUser(request);
    return authJson(await updateBetResults(user.id));
  } catch (error) {
    return bettingFailure(error, "Não foi possível atualizar os resultados. Tente novamente.");
  }
}
