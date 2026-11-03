import { NextRequest } from "next/server";
import { AUTH_MESSAGES, validateLogin } from "@/lib/auth-validation";
import { authFailure, authJson, readAuthBody } from "@/src/lib/api/auth";
import { loginUser } from "@/src/lib/auth/service";
import {
  SESSION_COOKIE,
  SESSION_COOKIE_OPTIONS,
  SESSION_DURATION_SECONDS,
} from "@/src/lib/auth/session";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const result = validateLogin(await readAuthBody(request));
    if (!result.success) {
      return authJson({ message: result.message, fieldErrors: result.fieldErrors }, 400);
    }

    const session = await loginUser(
      result.data,
      request.cookies.get(SESSION_COOKIE)?.value,
      request.headers.get("user-agent"),
    );
    const response = authJson({ message: AUTH_MESSAGES.loginSuccess });
    response.cookies.set(SESSION_COOKIE, session.token, {
      ...SESSION_COOKIE_OPTIONS,
      maxAge: SESSION_DURATION_SECONDS,
      expires: session.expiresAt,
    });
    return response;
  } catch (error) {
    return authFailure(error, AUTH_MESSAGES.loginFailed);
  }
}
