export type AuthErrorCode =
  | "EMAIL_EM_USO"
  | "CONTA_NAO_ENCONTRADA"
  | "SENHA_INCORRETA"
  | "CONTA_INDISPONIVEL";

export class AuthError extends Error {
  constructor(public readonly code: AuthErrorCode, message: string) {
    super(message);
    this.name = "AuthError";
  }
}
