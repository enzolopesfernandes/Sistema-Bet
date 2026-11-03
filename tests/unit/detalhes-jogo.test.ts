import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getMatchDetails } from "@/src/lib/jogos/details";

vi.mock("server-only", () => ({}));
vi.mock("@/src/lib/jogos/local", () => ({ storedMatch: async () => null }));
vi.mock("@/src/lib/jogos/managed-odds", () => ({ applyManagedOdds: async (matches: unknown[]) => matches }));
vi.mock("next/cache", () => ({ unstable_cache: (callback: (...args: unknown[]) => unknown) => callback }));

const fetchMock = vi.fn();
const fixture = () => ({
  fixture: { id: 42, date: "2026-10-30T18:00:00-03:00", referee: "Árbitro de teste", status: { short: "FT", elapsed: 90, extra: 5 }, venue: { name: "Estádio de teste", city: "São Paulo" } },
  league: { name: "Campeonato de teste", country: "Brazil", season: 2026, round: "Rodada 10" },
  teams: { home: { id: 10, name: "Time A", winner: true }, away: { id: 20, name: "Time B", winner: false } },
  goals: { home: 2, away: 0 },
  score: { halftime: { home: 1, away: 0 }, fulltime: { home: 2, away: 0 }, penalty: { home: null, away: null } },
  events: [
    { time: { elapsed: 90, extra: 2 }, team: { id: 20 }, player: { name: "Jogador B" }, type: "Card", detail: "Red Card" },
    { time: { elapsed: 30 }, team: { id: 10 }, player: { name: "Jogador A" }, assist: { name: "Jogador C" }, type: "Goal", detail: "Normal Goal" },
  ],
  statistics: [
    { team: { id: 20 }, statistics: [{ type: "Ball Possession", value: "40%" }, { type: "Total Shots", value: 0 }] },
    { team: { id: 10 }, statistics: [{ type: "Ball Possession", value: "60%" }, { type: "Total Shots", value: 12 }] },
  ],
  lineups: [{ team: { id: 10 }, formation: "4-3-3", coach: { name: "Técnico A" }, startXI: [{ player: { name: "Jogador A", number: 9, pos: "F" } }], substitutes: [{ player: { name: "Reserva A", number: 18, pos: "M" } }] }],
  players: [{ team: { id: 10 }, players: [{ player: { name: "Jogador A" }, statistics: [{ games: { minutes: 90, rating: "8.1" }, goals: { total: 2, assists: null, saves: 0 } }] }] }],
});

function response(items: unknown[] = [], errors: unknown = []) {
  return new Response(JSON.stringify({ errors, response: items }));
}

beforeEach(() => {
  vi.stubEnv("API_FOOTBALL_KEY", "chave-de-teste");
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset().mockImplementation(async () => response([fixture()]));
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("Detalhes de uma partida na API-Football", () => {
  it("consulta apenas a partida solicitada e mantém a chave no servidor", async () => {
    const result = await getMatchDetails(42);
    expect(result.availability).toBe("ready");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url.origin).toBe("https://v3.football.api-sports.io");
    expect(url.pathname).toBe("/fixtures");
    expect(url.searchParams.get("id")).toBe("42");
    expect(url.searchParams.get("timezone")).toBe("America/Sao_Paulo");
    expect(options.headers["x-apisports-key"]).toBe("chave-de-teste");
    expect(JSON.stringify(result)).not.toContain("chave-de-teste");
  });

  it("associa estatísticas por ID da equipe, preserva zeros e traduz os rótulos", async () => {
    const { match } = await getMatchDetails(42);
    expect(match?.statistics).toEqual([
      { label: "Posse de bola", home: "60%", away: "40%" },
      { label: "Finalizações", home: "12", away: "0" },
    ]);
    expect(match).toMatchObject({ referee: "Árbitro de teste", city: "São Paulo", season: 2026, elapsed: 90, extra: 5 });
    expect(match?.scores).toEqual([{ label: "Intervalo", home: 1, away: 0 }, { label: "Tempo regulamentar", home: 2, away: 0 }]);
  });

  it("ordena os lances e identifica jogadores, acréscimos, cartões e equipe", async () => {
    const { match } = await getMatchDetails(42);
    expect(match?.events).toEqual([
      { side: "home", type: "goal", label: "Gol", minute: 30, extra: null, player: "Jogador A", relatedPlayer: "Jogador C" },
      { side: "away", type: "card", label: "Cartão vermelho", minute: 90, extra: 2, player: "Jogador B", relatedPlayer: null },
    ]);
  });

  it("preserva métricas que admitem valores negativos, como gols evitados", async () => {
    const item = fixture();
    item.statistics[0].statistics.push({ type: "goals_prevented", value: -0.7 });
    item.statistics[1].statistics.push({ type: "goals_prevented", value: "1.20" });
    fetchMock.mockResolvedValueOnce(response([item]));
    expect((await getMatchDetails(42)).match?.statistics).toContainEqual({ label: "Gols evitados", home: "1.20", away: "-0.7" });
  });

  it("normaliza titulares, reservas, formação, técnico e desempenho sem inventar valores", async () => {
    const { match } = await getMatchDetails(42);
    expect(match?.lineups[0]).toEqual({ side: "home", formation: "4-3-3", coach: "Técnico A", starters: [{ name: "Jogador A", number: 9, position: "Atacante" }], substitutes: [{ name: "Reserva A", number: 18, position: "Meio-campista" }] });
    expect(match?.players[0]).toEqual({ side: "home", name: "Jogador A", minutes: 90, rating: "8.1", goals: 2, assists: null, saves: 0 });
  });

  it.each([["Regular Season - 33", "Temporada regular - 33"], ["Quarter-finals", "Quartas de final"], ["Semi-finals", "Semifinais"], ["Round of 16", "Oitavas de final"]])("traduz a fase da competição: %s", async (round, expected) => {
    const item = fixture();
    item.league.round = round;
    fetchMock.mockResolvedValueOnce(response([item]));
    expect((await getMatchDetails(42)).match?.round).toBe(expected);
  });

  it("preserva os dados principais quando as seções opcionais estão ausentes", async () => {
    const item = { ...fixture(), events: null, statistics: null, lineups: null, players: null, score: null };
    fetchMock.mockResolvedValueOnce(response([item]));
    const result = await getMatchDetails(42);
    expect(result.availability).toBe("ready");
    expect(result.match).toMatchObject({ id: 42, events: [], statistics: [], lineups: [], players: [], scores: [] });
  });

  it("ignora dados de equipes desconhecidas e valores estatísticos inválidos", async () => {
    const item = fixture();
    item.events[0].team.id = 99;
    item.lineups[0].team.id = 99;
    item.players[0].team.id = 99;
    item.statistics[0].statistics[0].value = "não disponível";
    fetchMock.mockResolvedValueOnce(response([item]));
    const { match } = await getMatchDetails(42);
    expect(match?.events).toHaveLength(1);
    expect(match?.lineups).toEqual([]);
    expect(match?.players).toEqual([]);
    expect(match?.statistics[0]).toEqual({ label: "Posse de bola", home: "60%", away: null });
  });

  it.each(["Own Goal", "Penalty", "Missed Penalty"])("traduz o evento de gol %s", async (detail) => {
    const item = fixture();
    item.events[1].detail = detail;
    fetchMock.mockResolvedValueOnce(response([item]));
    const { match } = await getMatchDetails(42);
    expect(match?.events[0].label).toBe(({ "Own Goal": "Gol contra", Penalty: "Gol de pênalti", "Missed Penalty": "Pênalti perdido" })[detail]);
  });

  it("carrega as odds do jogo futuro e usa cotação simulada se a API falhar", async () => {
    const item = fixture();
    item.fixture.status.short = "NS";
    fetchMock.mockImplementation(async (url: URL) => url.pathname === "/odds" ? new Response("", { status: 429 }) : response([item]));
    const result = await getMatchDetails(42);
    expect(result).toMatchObject({ availability: "ready", match: { id: 42, odds: { source: "Cotação simulada", updatedAt: null } } });
    for (const value of [result.match?.odds?.home, result.match?.odds?.draw, result.match?.odds?.away]) {
      expect(value).toBeGreaterThanOrEqual(1.2);
      expect(value).toBeLessThanOrEqual(2);
    }
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0].searchParams.get("fixture")).toBe("42");
  });

  it("não consulta a API sem chave", async () => {
    vi.stubEnv("API_FOOTBALL_KEY", " ");
    expect(await getMatchDetails(42)).toEqual({ availability: "unconfigured", match: null });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])("rejeita ID inválido antes da consulta: %s", async (id) => {
    expect(await getMatchDetails(id)).toEqual({ availability: "not-found", match: null });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("retorna não encontrado para partida inexistente ou estrangeira", async () => {
    fetchMock.mockResolvedValueOnce(response());
    expect(await getMatchDetails(42)).toEqual({ availability: "not-found", match: null });
    const foreign = fixture();
    foreign.league.country = "England";
    fetchMock.mockResolvedValueOnce(response([foreign]));
    expect(await getMatchDetails(42)).toEqual({ availability: "not-found", match: null });
  });

  it.each([
    () => Promise.reject(new Error("Falha de rede")),
    () => new Response("", { status: 429 }),
    () => new Response("JSON inválido"),
    () => response([], { requests: "Cota excedida" }),
    () => new Response(JSON.stringify({ response: [] })),
    () => response([{ ...fixture(), fixture: { ...fixture().fixture, id: 99 } }]),
    () => response([{ ...fixture(), goals: null, fixture: { ...fixture().fixture, date: "inválida" } }]),
  ])("trata falhas do provedor sem confundir indisponibilidade com partida inexistente", async (result) => {
    fetchMock.mockImplementation(result);
    expect(await getMatchDetails(42)).toEqual({ availability: "unavailable", match: null });
  });
});
