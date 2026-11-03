import type { NextRequest } from "next/server";
import { authJson } from "@/src/lib/api/auth";
import { bettingUser, bettingFailure } from "@/src/lib/api/betting";
import { availablePromotions } from "@/src/lib/promocoes/service";
import { validMatchId } from "@/lib/gestao";
export async function GET(request: NextRequest) {
  try {
    const user = await bettingUser(request), id = Number(request.nextUrl.searchParams.get("jogo"));
    if (!validMatchId(id)) return authJson({ message: "Selecione um jogo válido" }, 400);
    return authJson({ items: await availablePromotions(user.id, id) });
  } catch (error) { return bettingFailure(error, "Não foi possível carregar as promoções"); }
}
