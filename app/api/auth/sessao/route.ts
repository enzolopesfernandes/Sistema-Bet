import { NextRequest } from "next/server";
import { authFailure, authJson } from "@/src/lib/api/auth";
import { findSessionUser, SESSION_COOKIE } from "@/src/lib/auth/session";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const user = await findSessionUser(request.cookies.get(SESSION_COOKIE)?.value);
    if (!user) return authJson({ message: "Entre na sua conta para continuar" }, 401);
    return authJson({ usuario: user });
  } catch (error) {
    return authFailure(error, "Não foi possível verificar sua sessão. Tente novamente");
  }
}
