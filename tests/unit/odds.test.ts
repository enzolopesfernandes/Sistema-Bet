import { afterEach, describe, expect, it, vi } from "vitest";
import { getMatchOdds } from "@/src/lib/jogos/odds";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ unstable_cache: (callback: (...args: unknown[]) => unknown) => callback }));
afterEach(() => vi.unstubAllGlobals());

function bookmaker(home: string, draw = "3.20", away = "4.50") {
  return { name: "Fonte de teste", bets: [{ id: 1, values: [{ value: "Away", odd: away }, { value: "Home", odd: home }, { value: "Draw", odd: draw }] }] };
}

function mockOdds(bookmakers: unknown[], fixtureId = 42) {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ errors: [], response: [{ fixture: { id: fixtureId }, update: "2026-10-31T12:00:00Z", bookmakers }] })));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("Cotações de referência da API-Football", () => {
  it("consulta a partida e associa os valores pelos rótulos da API", async () => {
    const fetchMock = mockOdds([bookmaker("1.85")]);
    const odds = await getMatchOdds(42, "chave-de-teste");
    expect(odds).toEqual({ home: 1.85, draw: 3.2, away: 4.5, source: "Fonte de teste", updatedAt: "2026-10-31T12:00:00Z" });
    const [url, options] = fetchMock.mock.calls[0];
    expect(url.pathname).toBe("/odds");
    expect(url.searchParams.get("fixture")).toBe("42");
    expect(url.searchParams.get("bet")).toBe("1");
    expect(options.headers["x-apisports-key"]).toBe("chave-de-teste");
    expect(JSON.stringify(odds)).not.toContain("chave-de-teste");
  });

  it("escolhe um conjunto completo sem misturar valores de fontes diferentes", async () => {
    mockOdds([bookmaker("1.8", "inválido"), bookmaker("2.15", "3.10", "3.50")]);
    expect(await getMatchOdds(42, "teste")).toMatchObject({ home: 2.15, draw: 3.1, away: 3.5 });
  });

  it.each(["NaN", "Infinity", "0", "-1", "1", ""])("substitui cotação inválida por simulação: %s", async (home) => {
    mockOdds([bookmaker(home)]);
    expectSimulated(await getMatchOdds(42, "teste"));
  });

  it("não associa odds de outra partida", async () => {
    mockOdds([bookmaker("2.0")], 99);
    const odds = await getMatchOdds(42, "teste");
    expectSimulated(odds);
    expect(odds.source).not.toBe("Fonte de teste");
  });

  it.each([
    () => Promise.reject(new Error("Sem conexão")),
    () => new Response("", { status: 429 }),
    () => new Response("JSON inválido"),
    () => new Response(JSON.stringify({ errors: { requests: "Cota esgotada" }, response: [] })),
    () => new Response(JSON.stringify({ errors: [], response: [] })),
  ])("preenche cotação simulada sem interromper os jogos", async (result) => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(result));
    const first = await getMatchOdds(42, "teste");
    const second = await getMatchOdds(42, "teste");
    expectSimulated(first);
    expect(second).toEqual(first);
  });
});

function expectSimulated(odds: { home: number; draw: number; away: number; source: string; updatedAt: string | null }) {
  expect(odds.source).toBe("Cotação simulada");
  expect(odds.updatedAt).toBeNull();
  for (const value of [odds.home, odds.draw, odds.away]) {
    expect(value).toBeGreaterThanOrEqual(1.2);
    expect(value).toBeLessThanOrEqual(2);
    expect(value).toBe(Math.round(value * 100) / 100);
  }
}
