import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getMatchDetails } from "@/src/lib/jogos/details";
import { getMatchFeed } from "@/src/lib/jogos/service";
import { finalOutcome } from "@/src/lib/apostas/settlement";
import { matchEntityId } from "@/src/lib/jogos/identity";
const db = vi.hoisted(() => ({ jogo: { findFirst: vi.fn(), findMany: vi.fn() }, selecao: { findMany: vi.fn() } }));
vi.mock("server-only", () => ({}));
vi.mock("@/src/lib/prisma", () => ({ default: db }));
vi.mock("next/cache", () => ({ unstable_cache: (callback: unknown) => callback }));
const row = () => ({ id: "local", local_id: 7, api_football_id: null, gerenciado: true, removido_em: null, mandante: "Azul", visitante: "Verde", campeonato: "Demonstração", inicio_em: new Date(Date.now() + 3600000), atualizado_em: new Date(), status: "AGENDADO", placar_mandante: null, placar_visitante: null });
beforeEach(() => {
  vi.resetAllMocks(); vi.stubEnv("API_FOOTBALL_KEY", ""); vi.stubGlobal("fetch", vi.fn());
  db.jogo.findFirst.mockResolvedValue(row());
  db.jogo.findMany.mockImplementation(({ where }) => Promise.resolve(where.gerenciado ? [row()] : []));
  db.selecao.findMany.mockResolvedValue(["home", "draw", "away"].map(o => ({ id: matchEntityId(-7, o), status: "ABERTA", resultado: "PENDENTE", odd_atual: "2.50" })));
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
describe("Partidas locais integradas à consulta e liquidação", () => {
  it("carrega uma partida com odds administrativas sem consultar a API", async () => {
    const response = await getMatchDetails(-7);
    expect(response).toMatchObject({ availability: "ready", match: { id: -7, status: "NS", home: { name: "Azul" }, odds: { home: 2.5, source: "Cotação administrativa" } } });
    expect(fetch).not.toHaveBeenCalled();
  });
  it("exibe partidas locais na listagem mesmo sem chave", async () => {
    const feed = await getMatchFeed(); expect(feed.availability).toBe("ready"); expect(feed.upcoming[0].id).toBe(-7);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("não exibe jogo removido nem oferece cotação de seleção fechada", async () => {
    db.jogo.findFirst.mockResolvedValueOnce({ ...row(), removido_em: new Date() });
    expect((await getMatchDetails(-7)).availability).toBe("not-found");
    db.selecao.findMany.mockResolvedValue([]);
    expect((await getMatchDetails(-7)).match?.odds).toBeNull();
  });
  it("transforma placar administrativo no resultado usado pela liquidação", async () => {
    db.jogo.findFirst.mockResolvedValue({ ...row(), status: "ENCERRADO", placar_mandante: 0, placar_visitante: 2 });
    const response = await getMatchDetails(-7); if (response.availability !== "ready") throw new Error("Partida não carregada");
    expect(response.match.odds).toBeNull(); expect(finalOutcome(response.match)).toBe("away");
  });
  it("preserva a indisponibilidade do banco em vez de oferecer odds antigas", async () => {
    db.jogo.findFirst.mockRejectedValue(new Error("Falha interna"));
    expect((await getMatchDetails(-7)).availability).toBe("unavailable");
  });
});
