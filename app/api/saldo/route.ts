import type { NextRequest } from "next/server";
import { authJson } from "@/src/lib/api/auth";
import { bettingFailure, bettingUser } from "@/src/lib/api/betting";
import { getBalance } from "@/src/lib/saldo/service";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const user = await bettingUser(request);
    return authJson({ saldo: await getBalance(user.id) });
  } catch (error) {
    return bettingFailure(error, "Não foi possível carregar o saldo da conta");
  }
}
