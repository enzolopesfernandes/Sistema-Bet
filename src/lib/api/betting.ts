import "server-only";

import type { NextRequest } from "next/server";
import { authFailure, authJson } from "./auth";
import { findSessionUser, SESSION_COOKIE } from "@/src/lib/auth/session";
import { BetError } from "@/src/lib/apostas/errors";

export async function bettingUser(request: NextRequest) {
  const user = await findSessionUser(request.cookies.get(SESSION_COOKIE)?.value);
  if (!user) throw new BetError("Entre na sua conta para continuar", 401);
  return user;
}

export function bettingFailure(error: unknown, fallback: string) {
  if (error instanceof BetError) return authJson({ message: error.message }, error.status);
  return authFailure(error, fallback);
}
