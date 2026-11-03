import { AUTH_MESSAGES, validateRegistration } from "@/lib/auth-validation";
import { authFailure, authJson, readAuthBody } from "@/src/lib/api/auth";
import { registerUser } from "@/src/lib/auth/service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const result = validateRegistration(await readAuthBody(request));
    if (!result.success) {
      return authJson({ message: result.message, fieldErrors: result.fieldErrors }, 400);
    }

    await registerUser(result.data);
    return authJson({ message: AUTH_MESSAGES.registrationSuccess }, 201);
  } catch (error) {
    return authFailure(error, AUTH_MESSAGES.registrationFailed);
  }
}
