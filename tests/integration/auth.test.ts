import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST as register } from "@/app/api/auth/cadastro/route";
import { POST as login } from "@/app/api/auth/login/route";
import { POST as logout } from "@/app/api/auth/logout/route";
import { GET as session } from "@/app/api/auth/sessao/route";
import { hashPassword, hashSessionToken } from "@/src/lib/auth/crypto";
import { SESSION_COOKIE } from "@/src/lib/auth/session";
import { AUTH_MESSAGES } from "@/lib/auth-validation";

const db = vi.hoisted(() => ({
  usuario: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
  sessao: { create: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn() },
  $transaction: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/src/lib/prisma", () => ({ default: db }));

function request(path: string, data?: unknown, cookie?: string) {
  return new NextRequest(`http://localhost/api/auth/${path}`, {
    method: data === undefined ? "GET" : "POST",
    headers: { "Content-Type": "application/json", Origin: "http://localhost", ...(cookie && { Cookie: cookie }) },
    ...(data !== undefined && { body: JSON.stringify(data) }),
  });
}
const credentials = { nome: "Ana", email: "ana@exemplo.com", senha: "senha123" };
const token = "a".repeat(64);
let passwordHash: string;

beforeAll(async () => { passwordHash = await hashPassword(credentials.senha); });
beforeEach(() => {
  vi.resetAllMocks();
  db.$transaction.mockImplementation((callback) => callback(db));
  db.usuario.findUnique.mockResolvedValue(null);
});

describe("Handlers de autenticação com persistência simulada", () => {
  it("cadastra apenas os dados do usuário e salva Argon2id", async () => {
    const response = await register(request("cadastro", credentials));
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ message: AUTH_MESSAGES.registrationSuccess });
    const data = db.usuario.create.mock.calls[0][0].data;
    expect(data.senha_hash).toMatch(/^\$argon2id\$/);
    expect(data.senha).toBeUndefined();
    expect(response.headers.get("set-cookie")).toBeNull();
  });
  it("informa e-mail já cadastrado", async () => {
    db.usuario.findUnique.mockResolvedValue({ id: "usuario" });
    const response = await register(request("cadastro", credentials));
    expect(response.status).toBe(409);
    expect((await response.json()).message).toBe(AUTH_MESSAGES.emailTaken);
    expect(db.usuario.create).not.toHaveBeenCalled();
  });
  it("valida campos antes de consultar o banco", async () => {
    const response = await login(request("login", {}));
    expect(response.status).toBe(400);
    expect((await response.json()).message).toBe(AUTH_MESSAGES.loginRequired);
    expect(db.usuario.findUnique).not.toHaveBeenCalled();
  });
  it("trata conta inexistente", async () => {
    const response = await login(request("login", credentials));
    expect(response.status).toBe(401);
    expect((await response.json()).message).toBe(AUTH_MESSAGES.accountNotFound);
  });
  it("trata senha incorreta sem criar sessão", async () => {
    db.usuario.findUnique.mockResolvedValue({ id: "usuario", status: "ATIVO", senha_hash: passwordHash });
    const response = await login(request("login", { ...credentials, senha: "incorreta" }));
    expect((await response.json()).message).toBe(AUTH_MESSAGES.wrongPassword);
    expect(db.sessao.create).not.toHaveBeenCalled();
  });
  it("autentica com cookie HttpOnly e persiste somente SHA-256", async () => {
    db.usuario.findUnique.mockResolvedValue({ id: "usuario", status: "ATIVO", senha_hash: passwordHash });
    const response = await login(request("login", credentials, `${SESSION_COOKIE}=${token}`));
    expect(response.status).toBe(200);
    const cookie = response.headers.get("set-cookie")!;
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=lax");
    expect(cookie).toContain("Max-Age=604800");
    const issuedToken = cookie.split(";")[0].split("=")[1];
    expect(issuedToken).not.toBe(token);
    expect(db.sessao.create.mock.calls[0][0].data.refresh_token_sha256).toEqual(hashSessionToken(issuedToken));
    expect(db.sessao.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { refresh_token_sha256: hashSessionToken(token), revogada_em: null } }));
    expect(await response.json()).toEqual({ message: AUTH_MESSAGES.loginSuccess });
  });
  it.each(["SUSPENSO", "BLOQUEADO"])("não autentica usuário %s", async (status) => {
    db.usuario.findUnique.mockResolvedValue({ id: "usuario", status, senha_hash: passwordHash });
    expect((await login(request("login", credentials))).status).toBe(403);
    expect(db.sessao.create).not.toHaveBeenCalled();
  });
  it.each([
    { usuario_id: "usuario", expira_em: new Date(0), revogada_em: null },
    { usuario_id: "usuario", expira_em: new Date(Date.now() + 60000), revogada_em: new Date() },
  ])("rejeita sessão expirada ou revogada", async (stored) => {
    db.sessao.findUnique.mockResolvedValue(stored);
    expect((await session(request("sessao", undefined, `${SESSION_COOKIE}=${token}`))).status).toBe(401);
    expect(db.usuario.findFirst).not.toHaveBeenCalled();
  });
  it("não consulta o banco para token inválido", async () => {
    expect((await session(request("sessao", undefined, `${SESSION_COOKIE}=invalido`))).status).toBe(401);
    expect(db.sessao.findUnique).not.toHaveBeenCalled();
  });
  it("revoga a sessão e remove o cookie no logout", async () => {
    const response = await logout(request("logout", {}, `${SESSION_COOKIE}=${token}`));
    expect(response.status).toBe(200);
    expect(db.sessao.updateMany).toHaveBeenCalled();
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
  });
  it("não expõe detalhes de falhas do banco", async () => {
    db.usuario.findUnique.mockRejectedValue(new Error("detalhe interno"));
    const response = await login(request("login", credentials));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ message: AUTH_MESSAGES.loginFailed });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
  it("rejeita solicitações de outra origem", async () => {
    const req = request("cadastro", credentials);
    req.headers.set("origin", "https://outro.exemplo");
    expect((await register(req)).status).toBe(403);
    expect(db.usuario.create).not.toHaveBeenCalled();
  });
});
