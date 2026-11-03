import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET as balance } from "@/app/api/saldo/route";
import { POST as recharge } from "@/app/api/saldo/recarga/route";
import { GET as history, POST as bet } from "@/app/api/apostas/route";
import { GET as details } from "@/app/api/apostas/[id]/route";
import { POST as updateResults } from "@/app/api/apostas/atualizar-resultados/route";
import { BET_MESSAGES, DEMO_METHOD } from "@/lib/apostas";
import { placeBet, getBetHistory, getBetDetails, matchEntityId } from "@/src/lib/apostas/service";
import { rechargeBalance } from "@/src/lib/saldo/service";
import { updateBetResults } from "@/src/lib/apostas/settlement";
import { ConcurrentUpdate, transaction } from "@/src/lib/apostas/transaction";

const mocks = vi.hoisted(() => ({ user: vi.fn(), match: vi.fn() }));
const db = vi.hoisted(() => ({
  usuario: { findFirst: vi.fn() },
  carteira: { findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), findFirstOrThrow: vi.fn(), upsert: vi.fn(), updateMany: vi.fn() },
  aposta: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), count: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
  item_aposta: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
  movimentacao: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn() },
  jogo: { upsert: vi.fn(), findMany: vi.fn(), updateMany: vi.fn() },
  mercado: { upsert: vi.fn(), findMany: vi.fn(), updateMany: vi.fn() },
  selecao: { upsert: vi.fn(), findMany: vi.fn(), updateMany: vi.fn() },
  $transaction: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/src/lib/prisma", () => ({ default: db }));
vi.mock("@/src/lib/auth/session", () => ({ SESSION_COOKIE: "sessao", findSessionUser: mocks.user }));
vi.mock("@/src/lib/jogos/details", () => ({ getMatchDetails: mocks.match }));

const key = "12345678-1234-4123-8123-123456789abc";
const betId = "98765432-1234-4123-8123-123456789abc";
const input = { valor: "10.00", jogoId: 42, selecao: "home" as const, odd: "1.5", idempotencyKey: key };
const rechargeInput = { valor: "100.00", metodo: DEMO_METHOD, idempotencyKey: key };

/** O saldo inicial é um dublê; as operações posteriores usam o Decimal criado pelo serviço. */
function wallet(value = "100.00") {
  return { id: "carteira-ana", usuario_id: "ana", versao: 0, saldo_atual: {
    toFixed: () => value,
    lessThan: (amount: { greaterThan: (value: string) => boolean }) => amount.greaterThan(value),
    add: (amount: { add: (value: string) => unknown }) => amount.add(value),
  } };
}
function request(path: string, data?: unknown) {
  return new NextRequest(`http://localhost/api/${path}`, {
    method: data === undefined ? "GET" : "POST", headers: { "Content-Type": "application/json", Origin: "http://localhost", Cookie: "sessao=token" },
    ...(data !== undefined ? { body: JSON.stringify(data) } : {}),
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  db.usuario.findFirst.mockResolvedValue({ id: "ana", status: "ATIVO" });
  mocks.user.mockResolvedValue({ id: "ana" });
  db.$transaction.mockImplementation((callback) => callback(db));
  db.carteira.findUnique.mockResolvedValue(wallet());
  db.carteira.findUniqueOrThrow.mockResolvedValue(wallet());
  db.carteira.findFirstOrThrow.mockResolvedValue(wallet());
  db.carteira.upsert.mockResolvedValue(wallet());
  db.carteira.updateMany.mockResolvedValue({ count: 1 });
  db.movimentacao.findUnique.mockResolvedValue(null);
  db.movimentacao.findMany.mockResolvedValue([]);
  db.aposta.findUnique.mockResolvedValue(null);
  db.aposta.create.mockImplementation(({ data }) => Promise.resolve(data));
  db.jogo.upsert.mockResolvedValue({ id: "jogo", status: "AGENDADO", inicio_em: new Date(Date.now() + 3600000) });
  db.mercado.upsert.mockResolvedValue({ id: "mercado", status: "ABERTO", nome: "Resultado no tempo regulamentar · 1X2" });
  db.selecao.upsert.mockResolvedValue({ id: matchEntityId(42, "home"), status: "ABERTA", resultado: "PENDENTE" });
  mocks.match.mockResolvedValue({ availability: "ready", match: { id: 42, status: "NS", date: new Date(Date.now() + 3600000).toISOString(), league: "Liga", home: { name: "Time A" }, away: { name: "Time B" }, odds: { home: 1.5, draw: 2, away: 1.8 } } });
});

describe("Saldo e aposta com persistência simulada", () => {
  it("não sobrescreve cotação administrativa e preserva o snapshot contratado", async () => {
    db.selecao.upsert.mockResolvedValue({ id: matchEntityId(42, "home"), status: "ABERTA", resultado: "PENDENTE", odd_manual: true, odd_atual: { equals: (value: { toFixed: (digits: number) => string }) => value.toFixed(4) === "1.5000" } });
    await placeBet("ana", input);
    expect(db.selecao.updateMany).not.toHaveBeenCalled();
    expect(db.item_aposta.create.mock.calls[0][0].data.odd_contratada.toFixed(4)).toBe("1.5000");
  });
  it("rejeita alteração administrativa ocorrida após a consulta da partida", async () => {
    db.selecao.upsert.mockResolvedValue({ id: matchEntityId(42, "home"), status: "ABERTA", resultado: "PENDENTE", odd_manual: true, odd_atual: { equals: () => false } });
    await expect(placeBet("ana", input)).rejects.toThrow("cotação foi alterada");
    expect(db.carteira.updateMany).not.toHaveBeenCalled();
    expect(db.aposta.create).not.toHaveBeenCalled();
  });
  it("retorna saldo privado e sem cache", async () => {
    const response = await balance(request("saldo"));
    expect(await response.json()).toEqual({ saldo: "100.00" });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
  it("credita a recarga e registra a movimentação na mesma transação", async () => {
    expect(await rechargeBalance("ana", rechargeInput)).toEqual({ saldo: "200.00" });
    expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function), expect.objectContaining({ isolationLevel: "Serializable" }));
    expect(db.movimentacao.create.mock.calls[0][0].data).toMatchObject({ tipo: "RECARGA_SIMULADA", carteira_id: "carteira-ana", idempotency_key: key });
    expect(db.movimentacao.create.mock.calls[0][0].data.saldo_apos.toFixed(2)).toBe("200.00");
  });
  it("repetir a recarga não gera novo crédito; mudar o valor com a mesma chave é rejeitado", async () => {
    await rechargeBalance("ana", rechargeInput);
    db.movimentacao.findUnique.mockResolvedValue(db.movimentacao.create.mock.calls[0][0].data);
    db.carteira.updateMany.mockClear(); db.movimentacao.create.mockClear();
    await rechargeBalance("ana", rechargeInput);
    expect(db.carteira.updateMany).not.toHaveBeenCalled();
    expect(db.movimentacao.create).not.toHaveBeenCalled();
    await expect(rechargeBalance("ana", { ...rechargeInput, valor: "50" })).rejects.toThrow("outros dados");
  });
  it("debita o saldo, preserva odd e snapshots e registra a aposta atomicamente", async () => {
    const result = await placeBet("ana", input);
    expect(result.saldo).toBe("90.00");
    const data = db.aposta.create.mock.calls[0][0].data;
    expect(data.valor.toFixed(2)).toBe("10.00");
    expect(data.retorno_potencial.toFixed(2)).toBe("15.00");
    expect(db.item_aposta.create.mock.calls[0][0].data).toMatchObject({ jogo_snapshot: "Time A × Time B", selecao_snapshot: "Time A" });
    expect(db.movimentacao.create.mock.calls[0][0].data.valor_assinado.toFixed(2)).toBe("-10.00");
  });
  it("não aposta sem saldo e não cria registros parciais", async () => {
    db.carteira.upsert.mockResolvedValue(wallet("5.00"));
    await expect(placeBet("ana", input)).rejects.toThrow(BET_MESSAGES.insufficient);
    expect(db.aposta.create).not.toHaveBeenCalled();
    expect(db.movimentacao.create).not.toHaveBeenCalled();
  });
  it("repete a transação se a versão da carteira mudar durante a gravação", async () => {
    db.carteira.updateMany.mockResolvedValueOnce({ count: 0 });
    expect((await placeBet("ana", input)).saldo).toBe("90.00");
    expect(db.$transaction).toHaveBeenCalledTimes(2);
    expect(db.aposta.create).toHaveBeenCalledTimes(1);
  });
  it("limita as tentativas de concorrência e propaga falhas sem ocultá-las", async () => {
    await expect(transaction(async () => { throw new ConcurrentUpdate(); })).rejects.toBeInstanceOf(ConcurrentUpdate);
    expect(db.$transaction).toHaveBeenCalledTimes(4);
  });
  it.each(["P2034", "P2002"])("reconhece o conflito %s do Prisma mesmo após a recarga de módulos", async (code) => {
    db.$transaction.mockRejectedValueOnce(Object.assign(new Error("Conflito"), { name: "PrismaClientKnownRequestError", code }));
    expect((await rechargeBalance("ana", rechargeInput)).saldo).toBe("200.00");
    expect(db.$transaction).toHaveBeenCalledTimes(2);
  });
  it("repetir aposta retorna a original mesmo se o provedor ficar indisponível", async () => {
    await placeBet("ana", input);
    const previous = db.aposta.create.mock.calls[0][0].data;
    db.aposta.findUnique.mockResolvedValue(previous);
    db.item_aposta.findFirst.mockResolvedValue({ selecao_id: matchEntityId(42, "home") });
    mocks.match.mockClear(); db.aposta.create.mockClear();
    expect((await placeBet("ana", input)).id).toBe(previous.id);
    expect(db.aposta.create).not.toHaveBeenCalled();
    expect(mocks.match).not.toHaveBeenCalled();
    await expect(placeBet("outra-conta", input)).rejects.toThrow("outros dados");
  });
  it("rejeita odds adulteradas, mercados fechados e partidas já iniciadas", async () => {
    await expect(placeBet("ana", { ...input, odd: "9.5" })).rejects.toThrow("cotação foi alterada");
    db.mercado.upsert.mockResolvedValueOnce({ status: "FECHADO" });
    await expect(placeBet("ana", input)).rejects.toThrow("mercado");
    mocks.match.mockResolvedValueOnce({ availability: "ready", match: { status: "NS", date: new Date(0).toISOString() } });
    await expect(placeBet("ana", input)).rejects.toThrow("encerradas");
    expect(db.carteira.updateMany).not.toHaveBeenCalled();
  });
  it("usa a conta autenticada e nega chamadas anônimas em todas as operações", async () => {
    mocks.user.mockResolvedValue(null);
    const responses = await Promise.all([balance(request("saldo")), recharge(request("saldo/recarga", rechargeInput)), bet(request("apostas", input)), history(request("apostas")), details(request(`apostas/${betId}`), { params: Promise.resolve({ id: betId }) }), updateResults(request("apostas/atualizar-resultados", {}))]);
    expect(responses.map((response) => response.status)).toEqual([401, 401, 401, 401, 401, 401]);
    expect(db.$transaction).not.toHaveBeenCalled();
  });
  it("rejeita recargas e apostas de outra origem", async () => {
    for (const [handler, path, body] of [[recharge, "saldo/recarga", rechargeInput], [bet, "apostas", input], [updateResults, "apostas/atualizar-resultados", {}]] as const) {
      const req = request(path, body); req.headers.set("origin", "https://outra-origem.test");
      expect((await handler(req)).status).toBe(403);
    }
    expect(db.$transaction).not.toHaveBeenCalled();
  });
  it("não expõe erros internos do banco", async () => {
    db.carteira.upsert.mockRejectedValue(new Error("senha-do-banco"));
    const response = await recharge(request("saldo/recarga", rechargeInput));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ message: BET_MESSAGES.balanceFailed });
  });
});

describe("Histórico, propriedade e liquidação", () => {
  it("consulta e pagina somente as apostas da conta autenticada", async () => {
    db.aposta.count.mockResolvedValue(21); db.aposta.findMany.mockResolvedValue([]);
    const result = await getBetHistory("ana", 99, 10);
    expect(result.pagination).toEqual({ page: 3, pageSize: 10, total: 21, totalPages: 3 });
    expect(db.aposta.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { usuario_id: "ana" }, skip: 20, take: 10 }));
  });
  it("não revela detalhes de apostas pertencentes a outro usuário", async () => {
    db.aposta.findFirst.mockResolvedValue(null);
    await expect(getBetDetails("outra-conta", betId)).rejects.toThrow(BET_MESSAGES.detailsFailed);
    expect(db.aposta.findFirst).toHaveBeenCalledWith({ where: { id: betId, usuario_id: "outra-conta" } });
    expect(db.item_aposta.findMany).not.toHaveBeenCalled();
  });
  it("mantém histórico vazio e falha de carregamento como estados diferentes", async () => {
    db.aposta.count.mockResolvedValue(0); db.aposta.findMany.mockResolvedValue([]);
    expect((await (await history(request("apostas"))).json()).bets).toEqual([]);
    db.aposta.count.mockRejectedValue(new Error("falha interna"));
    const response = await history(request("apostas"));
    expect(response.status).toBe(503);
    expect((await response.json()).message).toBe(BET_MESSAGES.historyFailed);
  });
  it.each(["home", "away", "cancelled"])("liquida %s uma única vez e credita apenas o retorno correto", async (outcome) => {
    await placeBet("ana", input);
    const stored = db.aposta.create.mock.calls[0][0].data;
    const item = { id: "item", aposta_id: stored.id, selecao_id: matchEntityId(42, "home") };
    db.aposta.findMany.mockResolvedValue([stored]);
    db.aposta.findFirst.mockResolvedValueOnce(stored).mockResolvedValue(null);
    db.aposta.updateMany.mockResolvedValue({ count: 1 });
    db.item_aposta.findMany.mockResolvedValue([item]);
    db.selecao.findMany.mockResolvedValue([{ id: item.selecao_id, mercado_id: "mercado" }]);
    db.mercado.findMany.mockResolvedValue([{ id: "mercado", jogo_id: "jogo" }]);
    db.jogo.findMany.mockResolvedValue([{ id: "jogo", api_football_id: 42 }]);
    mocks.match.mockResolvedValue({ availability: "ready", match: { status: outcome === "cancelled" ? "CANC" : "FT", home: { goals: outcome === "home" ? 2 : 0 }, away: { goals: 1 }, scores: [] } });
    db.movimentacao.create.mockClear(); db.carteira.updateMany.mockClear();
    expect((await updateBetResults("ana")).updated).toBe(1);
    expect((await updateBetResults("ana")).updated).toBe(0);
    const status = outcome === "home" ? "GANHA" : outcome === "away" ? "PERDIDA" : "ANULADA";
    expect(db.aposta.updateMany.mock.calls[0][0].data.status).toBe(status);
    if (outcome === "away") {
      expect(db.carteira.updateMany).not.toHaveBeenCalled(); expect(db.movimentacao.create).not.toHaveBeenCalled();
    } else {
      expect(db.movimentacao.create).toHaveBeenCalledTimes(1);
      expect(db.movimentacao.create.mock.calls[0][0].data.valor_assinado.toFixed(2)).toBe(outcome === "home" ? "15.00" : "10.00");
    }
  });
});
