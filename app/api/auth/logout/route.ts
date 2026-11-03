import { NextRequest } from "next/server";
import { assertSameOrigin, authFailure, authJson } from "@/src/lib/api/auth";
import {
  revokeSession,
  SESSION_COOKIE,
  SESSION_COOKIE_OPTIONS,
} from "@/src/lib/auth/session";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    await revokeSession(request.cookies.get(SESSION_COOKIE)?.value);

    const response = authJson({ message: "Você saiu da sua conta" });
    response.cookies.set(SESSION_COOKIE, "", {
      ...SESSION_COOKIE_OPTIONS,
      maxAge: 0,
      expires: new Date(0),
    });
    return response;
  } catch (error) {
    return authFailure(error, "Não foi possível sair da conta. Tente novamente");
  }
}
