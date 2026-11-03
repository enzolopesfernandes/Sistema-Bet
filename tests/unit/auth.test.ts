import { describe, expect, it, vi } from "vitest";
import { AUTH_MESSAGES, validateLogin, validateRegistration } from "@/lib/auth-validation";
import { generateSessionToken, hashPassword, hashSessionToken, isSessionToken, verifyPassword } from "@/src/lib/auth/crypto";

vi.mock("server-only", () => ({}));

describe("Validação de cadastro e login", () => {
  it.each([null, [], {}, { nome: 12, email: true, senha: {} }])("rejeita campos ausentes ou inválidos: %j", (input) => {
    expect(validateRegistration(input)).toMatchObject({ success: false, message: AUTH_MESSAGES.registrationRequired });
    expect(validateLogin(input)).toMatchObject({ success: false, message: AUTH_MESSAGES.loginRequired });
  });
  it("normaliza nome e e-mail sem alterar a senha", () => {
    expect(validateRegistration({ nome: " Ana ", email: " ANA@EXEMPLO.COM ", senha: " senha123 " })).toEqual({ success: true, data: { nome: "Ana", email: "ana@exemplo.com", senha: " senha123 " } });
  });
  it("exige oito caracteres no cadastro", () => {
    expect(validateRegistration({ nome: "Ana", email: "ana@exemplo.com", senha: "1234567" })).toMatchObject({ success: false, message: AUTH_MESSAGES.passwordTooShort });
  });
  it("não impõe a regra de cadastro ao login", () => {
    expect(validateLogin({ email: "ana@exemplo.com", senha: "curta" }).success).toBe(true);
  });
  it.each(["invalido", "a@@exemplo.com", "a b@exemplo.com"])("rejeita e-mail inválido: %s", (email) => {
    expect(validateLogin({ email, senha: "senha123" }).success).toBe(false);
  });
  it("limita os dados aos tamanhos suportados", () => {
    expect(validateRegistration({ nome: "a".repeat(121), email: "ana@exemplo.com", senha: "senha123" }).success).toBe(false);
    expect(validateLogin({ email: "ana@exemplo.com", senha: "a".repeat(1025) }).success).toBe(false);
  });
});

describe("Criptografia", () => {
  it("gera hashes Argon2id com salt e verifica a senha", async () => {
    const first = await hashPassword("senha de teste");
    const second = await hashPassword("senha de teste");
    expect(first).toMatch(/^\$argon2id\$/);
    expect(first).not.toBe(second);
    expect(await verifyPassword(first, "senha de teste")).toBe(true);
    expect(await verifyPassword(first, "senha errada")).toBe(false);
  });
  it("gera tokens aleatórios de 256 bits e armazena digest de 32 bytes", () => {
    const token = generateSessionToken();
    expect(isSessionToken(token)).toBe(true);
    expect(generateSessionToken()).not.toBe(token);
    expect(hashSessionToken(token)).toHaveLength(32);
    expect(hashSessionToken(token)).toEqual(hashSessionToken(token));
    expect(isSessionToken("token adulterado")).toBe(false);
    expect(isSessionToken(undefined)).toBe(false);
  });
});
