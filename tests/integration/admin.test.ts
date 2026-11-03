import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { PATCH as editUser } from "@/app/api/admin/usuarios/[id]/route";
import { PATCH as editOdds, GET as history } from "@/app/api/admin/odds/[id]/route";
import { listUsers, updateUser } from "@/src/lib/admin/users";
import { updateOdds } from "@/src/lib/admin/odds";
import { matchEntityId } from "@/src/lib/jogos/identity";

const mocks = vi.hoisted(() => ({ user: vi.fn(), match: vi.fn() }));
const db = vi.hoisted(() => ({
  usuario: { findFirst: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn(), update: vi.fn() },
  sessao: { updateMany: vi.fn() },
  jogo: { upsert: vi.fn(), updateMany: vi.fn() }, mercado: { upsert: vi.fn() }, selecao: { upsert: vi.fn(), update: vi.fn() },
  historico_odds: { create: vi.fn(), findMany: vi.fn() }, auditoria_admin: { create: vi.fn() }, $transaction: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/src/lib/prisma", () => ({ default: db }));
vi.mock("@/src/lib/auth/session", () => ({ SESSION_COOKIE: "sessao", findSessionUser: mocks.user }));
vi.mock("@/src/lib/jogos/details", () => ({ getMatchDetails: mocks.match }));

const adminId = "12345678-1234-4123-8123-123456789abc";
const userId = "98765432-1234-4123-8123-123456789abc";
const user = { id: userId, nome: "Ana", email: "ana@exemplo.com", papel: "APOSTADOR", status: "ATIVO", atualizado_em: new Date("2026-10-31T12:00:00Z") };
const userInput = () => ({ nome: "Ana Silva", email: user.email, status: "ATIVO", anterior: { nome: user.nome, email: user.email, status: user.status, atualizadoEm: user.atualizado_em.toISOString() } });
const oddsInput = () => ({ odds: { home: "2.1", draw: "3.2", away: "4.3" }, anterior: { home: "1.5", draw: "2", away: "1.8" }, motivo: "Revisão das cotações" });
function request(path: string, body?: unknown) {
  return new NextRequest(`http://localhost/api/admin/${path}`, { method: body === undefined ? "GET" : "PATCH", headers: { Origin: "http://localhost", "Content-Type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
const userContext = { params: Promise.resolve({ id: userId }) };
const oddsContext = { params: Promise.resolve({ id: "42" }) };

beforeEach(() => {
  vi.resetAllMocks();
  mocks.user.mockResolvedValue({ id: adminId, papel: "ADMINISTRADOR" });
  db.$transaction.mockImplementation((work) => work(db));
  db.usuario.findFirst.mockResolvedValue({ id: adminId });
  db.usuario.findUnique.mockImplementation(({ where }) => Promise.resolve(where.id === userId ? { ...user } : null));
  db.usuario.update.mockImplementation(({ data }) => Promise.resolve({ ...user, ...data }));
  db.usuario.findMany.mockResolvedValue([]);
  db.usuario.count.mockResolvedValue(0);
  db.jogo.upsert.mockResolvedValue({ id: "jogo", status: "AGENDADO", inicio_em: new Date(Date.now() + 3600000) });
  db.mercado.upsert.mockResolvedValue({ id: "mercado", status: "ABERTO" });
  db.selecao.upsert.mockImplementation(({ create }) => Promise.resolve({ ...create, status: "ABERTA", resultado: "PENDENTE", odd_manual: false }));
  db.historico_odds.findMany.mockResolvedValue([]);
  mocks.match.mockResolvedValue({ availability: "ready", match: { id: 42, status: "NS", date: new Date(Date.now() + 3600000).toISOString(), league: "Liga", home: { name: "Time A" }, away: { name: "Time B" }, odds: { home: 1.5, draw: 2, away: 1.8 } } });
});

describe("Autorização e handlers administrativos", () => {
  it.each([null, { id: userId, papel: "APOSTADOR" }])("nega escrita e histórico sem administrador: %j", async (account) => {
    mocks.user.mockResolvedValue(account);
    const expected = account ? 403 : 401;
    expect((await editUser(request("usuarios", userInput()), userContext)).status).toBe(expected);
    expect((await editOdds(request("odds", oddsInput()), oddsContext)).status).toBe(expected);
    expect((await history(request("odds"), oddsContext)).status).toBe(expected);
    expect(db.$transaction).not.toHaveBeenCalled();
  });
  it("rejeita outra origem antes de qualquer gravação", async () => {
    const req = request("odds", oddsInput()); req.headers.set("origin", "https://outro.exemplo");
    expect((await editOdds(req, oddsContext)).status).toBe(403);
    expect(db.$transaction).not.toHaveBeenCalled();
  });
  it("retorna dados públicos sem cache e ignora papel enviado pelo cliente", async () => {
    const response = await editUser(request("usuarios", { ...userInput(), papel: "ADMINISTRADOR" }), userContext);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect((await response.json()).user).toMatchObject({ nome: "Ana Silva", papel: "APOSTADOR" });
    expect(db.usuario.update.mock.calls[0][0].data).not.toHaveProperty("papel");
    expect(db.usuario.findUnique.mock.calls[0][0].select).not.toHaveProperty("senha_hash");
  });
  it("não expõe detalhes de falhas do banco", async () => {
    db.usuario.findFirst.mockRejectedValue(new Error("credenciais internas"));
    const response = await editUser(request("usuarios", userInput()), userContext);
    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toContain("credenciais internas");
  });
  it("rejeita JSON inválido e formato incorreto", async () => {
    const req = request("usuarios", userInput()); req.headers.set("content-type", "text/plain");
    expect((await editUser(req, userContext)).status).toBe(415);
    const invalid = new NextRequest("http://localhost/api/admin/usuarios", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: "{" });
    expect((await editUser(invalid, userContext)).status).toBe(400);
  });
});

describe("Gerenciar usuários com persistência simulada", () => {
  it("pagina e busca no servidor sem retornar hashes", async () => {
    db.usuario.count.mockResolvedValue(25); db.usuario.findMany.mockResolvedValue([user]);
    const result = await listUsers(adminId, "Ana", 99, 10);
    expect(result.pagination).toEqual({ page: 3, pageSize: 10, total: 25, totalPages: 3 });
    expect(db.usuario.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 20, take: 10, where: { excluido_em: null, OR: [{ nome: { contains: "Ana" } }, { email: { contains: "Ana" } }] } }));
    expect(result.users[0]).not.toHaveProperty("senha_hash");
  });
  it("bloqueia, revoga sessões e audita na mesma transação", async () => {
    await updateUser(adminId, userId, { ...userInput(), status: "BLOQUEADO" });
    expect(db.sessao.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { usuario_id: userId, revogada_em: null } }));
    expect(db.auditoria_admin.create.mock.calls[0][0].data).toMatchObject({ admin_id: adminId, entidade_id: userId, dados_anteriores: { status: "ATIVO" }, dados_novos: { status: "BLOQUEADO" } });
    expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function), expect.objectContaining({ isolationLevel: "Serializable" }));
  });
  it("normaliza e-mail e revoga sessões após sua alteração", async () => {
    await updateUser(adminId, userId, { ...userInput(), email: " NOVO@EXEMPLO.COM " });
    expect(db.usuario.update.mock.calls[0][0].data.email).toBe("novo@exemplo.com");
    expect(db.sessao.updateMany).toHaveBeenCalled();
  });
  it("desbloqueia a conta sem reativar sessões antigas", async () => {
    db.usuario.findUnique.mockImplementation(({ where }) => Promise.resolve(where.id === userId ? { ...user, status: "BLOQUEADO" } : null));
    const input = userInput(); input.anterior.status = "BLOQUEADO";
    expect(await updateUser(adminId, userId, input)).toMatchObject({ status: "ATIVO" });
    expect(db.sessao.updateMany).not.toHaveBeenCalled();
  });
  it("rejeita conta administrativa e não permite autobloqueio", async () => {
    db.usuario.findUnique.mockResolvedValue({ ...user, papel: "ADMINISTRADOR" });
    await expect(updateUser(adminId, userId, userInput())).rejects.toMatchObject({ status: 403 });
    db.usuario.findUnique.mockResolvedValue({ ...user, id: adminId });
    await expect(updateUser(adminId, adminId, userInput())).rejects.toMatchObject({ status: 403 });
    expect(db.usuario.update).not.toHaveBeenCalled();
  });
  it("revalida o administrador dentro da transação", async () => {
    db.usuario.findFirst.mockResolvedValue(null);
    await expect(updateUser(adminId, userId, userInput())).rejects.toMatchObject({ status: 403 });
    expect(db.usuario.update).not.toHaveBeenCalled();
  });
  it("rejeita edição concorrente e e-mail duplicado", async () => {
    const input = userInput(); input.anterior.nome = "Nome antigo";
    await expect(updateUser(adminId, userId, input)).rejects.toMatchObject({ status: 409 });
    db.usuario.findUnique.mockImplementation(({ where }) => Promise.resolve(where.id ? user : { id: "outra-conta" }));
    await expect(updateUser(adminId, userId, userInput())).rejects.toThrow("Já existe uma conta");
    expect(db.usuario.update).not.toHaveBeenCalled();
  });
  it("valida identificador, campos e situação", async () => {
    await expect(updateUser(adminId, "invalido", userInput())).rejects.toMatchObject({ status: 404 });
    for (const extra of [{ nome: " " }, { email: "invalido" }, { status: "REMOVIDO" }]) {
      await expect(updateUser(adminId, userId, { ...userInput(), ...extra })).rejects.toMatchObject({ status: 400 });
    }
    expect(db.usuario.update).not.toHaveBeenCalled();
  });
});

describe("Gerenciar odds com persistência simulada", () => {
  it("persiste o jogo sem apostas, as três seleções, histórico e auditoria", async () => {
    const result = await updateOdds(adminId, 42, oddsInput());
    expect(result.odds).toEqual({ home: "2.1000", draw: "3.2000", away: "4.3000" });
    expect(db.jogo.upsert.mock.calls[0][0].create.api_football_id).toBe(42);
    expect(db.selecao.update).toHaveBeenCalledTimes(3);
    expect(db.selecao.update.mock.calls[0][0]).toMatchObject({ where: { id: matchEntityId(42, "home") }, data: { odd_manual: true } });
    expect(db.historico_odds.create).toHaveBeenCalledTimes(3);
    expect(db.historico_odds.create.mock.calls[0][0].data.odd_anterior.toFixed(4)).toBe("1.5000");
    expect(db.auditoria_admin.create.mock.calls[0][0].data.admin_id).toBe(adminId);
  });
  it.each(["0", "1", "-2", "NaN", "Infinity", "2.00001", "100000000", "", "1e2"])("rejeita odd inválida %s", async (home) => {
    const input = oddsInput(); input.odds.home = home;
    await expect(updateOdds(adminId, 42, input)).rejects.toMatchObject({ status: 400 });
    expect(db.$transaction).not.toHaveBeenCalled();
  });
  it("rejeita cotações alteradas desde a abertura da tela", async () => {
    const input = oddsInput(); input.anterior.home = "1.6";
    await expect(updateOdds(adminId, 42, input)).rejects.toMatchObject({ status: 409 });
    expect(db.selecao.update).not.toHaveBeenCalled();
  });
  it("confere cotação manual dentro da transação mesmo com detalhes desatualizados", async () => {
    db.selecao.upsert.mockImplementation(({ create }) => ({ ...create, status: "ABERTA", resultado: "PENDENTE", odd_manual: true, odd_atual: { equals: () => false } }));
    await expect(updateOdds(adminId, 42, oddsInput())).rejects.toMatchObject({ status: 409 });
    expect(db.selecao.update).not.toHaveBeenCalled();
  });
  it("rejeita jogo iniciado e mercado fechado", async () => {
    db.jogo.upsert.mockResolvedValue({ status: "AGENDADO", inicio_em: new Date(0) });
    await expect(updateOdds(adminId, 42, oddsInput())).rejects.toMatchObject({ status: 409 });
    db.jogo.upsert.mockResolvedValue({ status: "AGENDADO", inicio_em: new Date(Date.now() + 60000) });
    db.mercado.upsert.mockResolvedValue({ status: "FECHADO" });
    await expect(updateOdds(adminId, 42, oddsInput())).rejects.toMatchObject({ status: 409 });
    expect(db.selecao.update).not.toHaveBeenCalled();
  });
  it("recusa alteração quando a consulta do jogo falha", async () => {
    mocks.match.mockResolvedValue({ availability: "unavailable", match: null });
    await expect(updateOdds(adminId, 42, oddsInput())).rejects.toMatchObject({ status: 503 });
    expect(db.$transaction).not.toHaveBeenCalled();
  });
  it("rejeita seleção encerrada", async () => {
    db.selecao.upsert.mockResolvedValue({ status: "FECHADA", resultado: "PENDENTE" });
    await expect(updateOdds(adminId, 42, oddsInput())).rejects.toMatchObject({ status: 409 });
    expect(db.selecao.update).not.toHaveBeenCalled();
  });
  it("propaga falha do histórico para abortar a transação", async () => {
    db.historico_odds.create.mockRejectedValue(new Error("Falha de persistência"));
    await expect(updateOdds(adminId, 42, oddsInput())).rejects.toThrow("Falha de persistência");
    expect(db.auditoria_admin.create).not.toHaveBeenCalled();
  });
  it("consulta histórico sem cache, restrito às seleções da partida", async () => {
    const response = await history(request("odds"), oddsContext);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(db.historico_odds.findMany.mock.calls[0][0]).toMatchObject({ take: 20, where: { selecao_id: { in: [matchEntityId(42, "home"), matchEntityId(42, "draw"), matchEntityId(42, "away")] } } });
  });
});
