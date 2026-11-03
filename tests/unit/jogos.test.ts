import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getMatchFeed } from "@/src/lib/jogos/service";

vi.mock("server-only", () => ({}));
vi.mock("@/src/lib/jogos/local", () => ({ localFeed: async () => ({ matches: [], removed: [] }) }));
vi.mock("@/src/lib/jogos/managed-odds", () => ({ applyManagedOdds: async (matches: unknown[]) => matches }));
vi.mock("next/cache", () => ({ unstable_cache: (callback: (...args: unknown[]) => unknown) => callback }));

const fetchMock = vi.fn();
const now = new Date("2026-10-31T15:00:00-03:00");

function fixture(id: number, date: string, status = "NS", home: number | null = null, away: number | null = null) {
  return {
    fixture: { id, date, status: { short: status }, venue: { name: "Estádio de teste" } },
    league: { name: "Campeonato de teste", country: "Brasil", round: "Rodada 1" },
    teams: { home: { name: "Time A", logo: "https://media.api-sports.io/football/teams/1.png", winner: home !== null && away !== null && home > away }, away: { name: "Time B" } },
    goals: { home, away }, score: { penalty: { home: 5, away: 4 } },
  };
}

function response(items: unknown[] = [], errors: unknown = []) {
  return new Response(JSON.stringify({ errors, response: items }), { status: 200 });
}

beforeEach(() => {
  vi.stubEnv("API_FOOTBALL_KEY", "chave-exclusiva-de-teste");
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset().mockImplementation(async () => response());
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("Integração dos jogos com API-Football", () => {
  it.each(["Brazil", "Brasil", " BRAZIL "])("aceita competições brasileiras e traduz o país: %s", async (country) => {
    const match = fixture(1, "2026-10-31T17:00:00-03:00");
    match.league.country = country;
    fetchMock.mockResolvedValueOnce(response([match]));
    const feed = await getMatchFeed(now);
    expect(feed.upcoming).toHaveLength(1);
    expect(feed.upcoming[0].country).toBe("Brasil");
  });

  it("exclui competições estrangeiras e internacionais antes do limite e da consulta de odds", async () => {
    const foreign = Array.from({ length: 15 }, (_, id) => ({
      ...fixture(id + 10, "2026-10-31T16:00:00-03:00"),
      league: { name: "Campeonato estrangeiro", country: id % 2 ? "England" : "World" },
    }));
    const foreignResult = { ...fixture(99, "2026-10-30T16:00:00-03:00", "FT", 2, 1), league: { country: "Argentina", name: "Campeonato estrangeiro" } };
    const missingCountry = { ...fixture(98, "2026-10-31T16:00:00-03:00"), league: { name: "País desconhecido" } };
    fetchMock.mockImplementation(async (url: URL) => url.pathname === "/odds" ? response() : response([
      ...foreign, foreignResult, missingCountry,
      fixture(1, "2026-10-31T17:00:00-03:00"),
      fixture(2, "2026-10-30T16:00:00-03:00", "FT", 1, 0),
    ]));
    const feed = await getMatchFeed(now);
    expect(feed.upcoming.map((match) => match.id)).toEqual([1]);
    expect(feed.recent.map((match) => match.id)).toEqual([2]);
    const oddsCalls = fetchMock.mock.calls.filter(([url]) => url.pathname === "/odds");
    expect(oddsCalls).toHaveLength(1);
    expect(oddsCalls[0][0].searchParams.get("fixture")).toBe("1");
  });

  it("preenche cotação simulada quando a API não entrega odds do jogo futuro", async () => {
    fetchMock.mockImplementation(async (url: URL) => url.pathname === "/odds" ? response() : response([fixture(7, "2026-10-31T17:00:00-03:00")]));
    const feed = await getMatchFeed(now);
    const odds = feed.upcoming[0].odds;
    expect(odds).toMatchObject({ source: "Cotação simulada", updatedAt: null });
    expect([odds?.home, odds?.draw, odds?.away].every((value) => typeof value === "number" && value >= 1.2 && value <= 2)).toBe(true);
    expect(feed.recent).toEqual([]);
  });

  it("carrega odds somente para os jogos futuros exibidos", async () => {
    fetchMock.mockImplementation(async (url: URL) => url.pathname === "/odds"
      ? response([{ fixture: { id: 1 }, bookmakers: [{ name: "Fonte de teste", bets: [{ id: 1, values: [{ value: "Home", odd: "2.0" }, { value: "Draw", odd: "3.0" }, { value: "Away", odd: "4.0" }] }] }] }])
      : response([fixture(1, "2026-10-31T17:00:00-03:00"), fixture(2, "2026-10-30T17:00:00-03:00", "FT", 1, 0)]));
    const feed = await getMatchFeed(now);
    expect(feed.upcoming[0].odds).toMatchObject({ home: 2, draw: 3, away: 4 });
    expect(feed.recent[0].odds).toBeNull();
    const oddsCalls = fetchMock.mock.calls.filter(([url]) => url.pathname === "/odds");
    expect(oddsCalls).toHaveLength(1);
    expect(oddsCalls[0][0].searchParams.get("fixture")).toBe("1");
  });

  it("não chama o provedor quando a chave não está configurada", async () => {
    vi.stubEnv("API_FOOTBALL_KEY", " ");
    expect(await getMatchFeed(now)).toEqual({ upcoming: [], recent: [], availability: "unconfigured" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("consulta a janela de sete dias em Brasília e envia a chave somente no header", async () => {
    await getMatchFeed(new Date("2026-11-01T01:00:00Z"));
    expect(fetchMock).toHaveBeenCalledTimes(7);
    const dates = fetchMock.mock.calls.map(([url, options]) => {
      expect(url.origin).toBe("https://v3.football.api-sports.io");
      expect(url.pathname).toBe("/fixtures");
      expect(url.searchParams.get("timezone")).toBe("America/Sao_Paulo");
      expect(url.toString()).not.toContain("chave-exclusiva-de-teste");
      expect(options.headers["x-apisports-key"]).toBe("chave-exclusiva-de-teste");
      return url.searchParams.get("date");
    });
    expect(dates).toEqual(["2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02", "2026-11-03"]);
  });

  it("separa os próximos jogos dos resultados, ordena e remove duplicados", async () => {
    const fixtures = [
      fixture(1, "2026-10-31T17:00:00-03:00"),
      fixture(2, "2026-10-31T16:00:00-03:00"),
      fixture(3, "2026-10-31T14:00:00-03:00"),
      fixture(4, "2026-10-30T16:00:00-03:00", "FT", 2, 1),
      fixture(5, "2026-10-31T10:00:00-03:00", "PEN", 1, 1),
      fixture(6, "2026-10-31T11:00:00-03:00", "AET", 3, 2),
      fixture(7, "2026-10-31T12:00:00-03:00", "PST"),
      fixture(8, "2026-10-31T12:00:00-03:00", "FT", null, 1),
      fixture(9, "2026-10-31T12:00:00-03:00", "2H", 1, 0),
      fixture(10, "2026-11-01T12:00:00-03:00", "FT", 1, 0),
      fixture(11, "2026-10-31T12:00:00-03:00", "CANC"),
    ];
    fetchMock.mockImplementation(async () => response(fixtures));
    const feed = await getMatchFeed(now);
    expect(feed.availability).toBe("ready");
    expect(feed.upcoming.map((match) => match.id)).toEqual([2, 1]);
    expect(feed.recent.map((match) => match.id)).toEqual([6, 5, 4]);
    expect(feed.recent[1].home.penalties).toBe(5);
    expect(feed.recent[2].home.winner).toBe(true);
    expect(JSON.stringify(feed)).not.toContain("chave-exclusiva-de-teste");
  });

  it("limita o carrossel aos doze confrontos mais próximos", async () => {
    fetchMock.mockResolvedValueOnce(response(Array.from({ length: 20 }, (_, id) => fixture(id + 1, `2026-11-01T${String(id).padStart(2, "0")}:00:00-03:00`))));
    const feed = await getMatchFeed(now);
    expect(feed.upcoming).toHaveLength(12);
    expect(feed.upcoming[0].id).toBe(1);
    expect(feed.upcoming[11].id).toBe(12);
  });

  it.each([
    () => Promise.reject(new Error("Falha de rede")),
    () => new Response("", { status: 429 }),
    () => response([], { token: "Chave inválida" }),
    () => new Response("JSON inválido", { status: 200 }),
    () => new Response(JSON.stringify({ response: [] }), { status: 200 }),
  ])("trata erros de rede, cota, autenticação e respostas inválidas", async (result) => {
    fetchMock.mockImplementation(result);
    expect(await getMatchFeed(now)).toEqual({ upcoming: [], recent: [], availability: "unavailable" });
  });

  it("preserva os jogos recebidos quando parte das consultas falha", async () => {
    fetchMock.mockRejectedValueOnce(new Error("Tempo esgotado"));
    fetchMock.mockResolvedValueOnce(response([fixture(1, "2026-10-31T16:00:00-03:00")]));
    const feed = await getMatchFeed(now);
    expect(feed.availability).toBe("partial");
    expect(feed.upcoming).toHaveLength(1);
  });

  it("descarta registros incompletos e escudos fora do domínio do provedor", async () => {
    const match = fixture(1, "2026-10-31T16:00:00-03:00");
    match.teams.home.logo = "https://dominio-desconhecido.invalid/escudo.png";
    fetchMock.mockResolvedValueOnce(response([null, {}, { fixture: null }, fixture(2, "data inválida"), match]));
    const feed = await getMatchFeed(now);
    expect(feed.upcoming).toHaveLength(1);
    expect(feed.upcoming[0].home.logo).toBeNull();
  });
});
