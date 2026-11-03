import { beforeEach, describe, expect, it, vi } from "vitest";
import Home from "@/app/page";
import type { Match } from "@/src/lib/jogos/types";

const mocks = vi.hoisted(() => ({ user: vi.fn(), feed: vi.fn() }));
vi.mock("@/src/lib/auth/session", () => ({ getCurrentUser: mocks.user }));
vi.mock("@/src/lib/jogos/service", () => ({ getMatchFeed: mocks.feed }));
vi.mock("@/components/page/inicio/HomePage", () => ({ default: () => null }));

const recent: Match[] = Array.from({ length: 27 }, (_, index) => ({
  id: index + 1, date: "2026-10-30T18:00:00-03:00", timestamp: 1793394000000, status: "FT",
  league: "Campeonato de teste", country: "Brasil", round: null, venue: null, odds: null,
  home: { name: "Time A", goals: 2, logo: null, penalties: null, winner: true },
  away: { name: "Time B", goals: 1, logo: null, penalties: null, winner: false },
}));

beforeEach(() => {
  mocks.user.mockResolvedValue(null);
  mocks.feed.mockResolvedValue({ upcoming: [], recent, availability: "ready" });
});

describe("Paginação RSC da tela inicial", () => {
  it("renderiza a primeira página sem exigir uma conta", async () => {
    const page = await Home({ searchParams: Promise.resolve({}) });
    expect(page.props.user).toBeNull();
    expect(page.props.pagination).toEqual({ page: 1, pageSize: 12, total: 27, totalPages: 3 });
    expect(page.props.recent.map((match: Match) => match.id)).toEqual(Array.from({ length: 12 }, (_, i) => i + 1));
  });

  it("seleciona os registros da página e respeita o tamanho solicitado na URL", async () => {
    const page = await Home({ searchParams: Promise.resolve({ page: "2", pageSize: "24" }) });
    expect(page.props.pagination).toEqual({ page: 2, pageSize: 24, total: 27, totalPages: 2 });
    expect(page.props.recent.map((match: Match) => match.id)).toEqual([25, 26, 27]);
  });

  it("limita páginas inexistentes à última página disponível", async () => {
    const page = await Home({ searchParams: Promise.resolve({ page: "100" }) });
    expect(page.props.pagination.page).toBe(3);
    expect(page.props.recent.map((match: Match) => match.id)).toEqual([25, 26, 27]);
  });

  it.each(["0", "-2", "1.5", "abc", "999999999999999999999999", ["2", "3"]])("trata parâmetros inválidos sem retornar uma página vazia: %j", async (value) => {
    const page = await Home({ searchParams: Promise.resolve({ page: value, pageSize: "999" }) });
    expect(page.props.pagination.page).toBe(1);
    expect(page.props.pagination.pageSize).toBe(12);
    expect(page.props.recent).toHaveLength(12);
  });

  it("envia nome, e-mail e papel ao cabeçalho sem expor o identificador interno", async () => {
    mocks.user.mockResolvedValue({ id: "identificador-interno", nome: "Ana Silva", email: "ana@example.com", papel: "ADMINISTRADOR" });
    const page = await Home({ searchParams: Promise.resolve({}) });
    expect(page.props.user).toEqual({ nome: "Ana Silva", email: "ana@example.com", papel: "ADMINISTRADOR" });
  });

  it("mantém uma página válida quando não há resultados", async () => {
    mocks.feed.mockResolvedValue({ upcoming: [], recent: [], availability: "unavailable" });
    const page = await Home({ searchParams: Promise.resolve({ page: "2" }) });
    expect(page.props.pagination).toEqual({ page: 1, pageSize: 12, total: 0, totalPages: 1 });
    expect(page.props.availability).toBe("unavailable");
  });
});
