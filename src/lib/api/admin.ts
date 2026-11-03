import "server-only";
import { BetError } from "@/src/lib/apostas/errors";
import { AdminError } from "@/src/lib/admin/access";
import { authFailure, authJson } from "./auth";

export function adminFailure(error: unknown) {
  if (error instanceof AdminError || error instanceof BetError) return authJson({ message: error.message }, error.status);
  return authFailure(error, "Não foi possível concluir a operação neste momento. Tente novamente.");
}
