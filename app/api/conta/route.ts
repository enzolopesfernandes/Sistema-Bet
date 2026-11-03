import type { NextRequest } from "next/server";
import { readAuthBody, authJson } from "@/src/lib/api/auth";
import { bettingUser, bettingFailure } from "@/src/lib/api/betting";
import { manageAccount } from "@/src/lib/conta/service";
import { SESSION_COOKIE, SESSION_COOKIE_OPTIONS } from "@/src/lib/auth/session";
export async function PATCH(request: NextRequest) {
  try {
    const body = await readAuthBody(request), user = await bettingUser(request);
    const result = await manageAccount(user.id, body), response = authJson(result);
    if (result.sair) response.cookies.set(SESSION_COOKIE, "", { ...SESSION_COOKIE_OPTIONS, maxAge: 0 });
    return response;
  } catch (error) { return bettingFailure(error, "Não foi possível atualizar sua conta"); }
}
