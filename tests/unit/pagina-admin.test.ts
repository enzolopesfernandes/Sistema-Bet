import { beforeEach, describe, expect, it, vi } from "vitest";
import Page from "@/app/(stubs)/admin/page";

const mocks = vi.hoisted(() => ({ admin: vi.fn(), users: vi.fn(), feed: vi.fn(), details: vi.fn() }));
vi.mock("@/src/lib/admin/access", () => ({ requireAdmin: mocks.admin }));
vi.mock("@/src/lib/admin/users", () => ({ listUsers: mocks.users }));
vi.mock("@/src/lib/jogos/service", () => ({ getMatchFeed: mocks.feed }));
vi.mock("@/src/lib/jogos/details", () => ({ getMatchDetails: mocks.details }));
vi.mock("@/components/page/admin/AdminPage", () => ({ default: () => null }));
vi.mock("server-only", () => ({}));

beforeEach(() => {
  vi.resetAllMocks();
  mocks.admin.mockResolvedValue({ id: "admin", nome: "Admin", email: "admin@exemplo.com", papel: "ADMINISTRADOR" });
  mocks.users.mockResolvedValue({ users: [], pagination: { page: 1, pageSize: 10, total: 0, totalPages: 1 } });
  mocks.feed.mockResolvedValue({ upcoming: [], availability: "ready" });
});

describe("Página administrativa e paginação RSC", () => {
  it("exige autorização antes de consultar dados", async () => {
    mocks.admin.mockRejectedValue(new Error("REDIRECIONAR"));
    await expect(Page({ searchParams: Promise.resolve({}) })).rejects.toThrow("REDIRECIONAR");
    expect(mocks.users).not.toHaveBeenCalled();
    expect(mocks.feed).not.toHaveBeenCalled();
  });
  it("passa busca e paginação ao serviço de usuários", async () => {
    await Page({ searchParams: Promise.resolve({ q: " Ana ", page: "2", pageSize: "20" }) });
    expect(mocks.users).toHaveBeenCalledWith("admin", "Ana", 2, 20);
  });
  it("distingue falha de consulta e lista vazia", async () => {
    expect((await Page({ searchParams: Promise.resolve({}) })).props.error).toBeUndefined();
    mocks.users.mockRejectedValue(new Error("Banco indisponível"));
    expect((await Page({ searchParams: Promise.resolve({}) })).props.error).toContain("Não foi possível carregar");
  });
  it("consulta apenas a aba ativa e pagina os jogos no servidor", async () => {
    mocks.feed.mockResolvedValue({ availability: "ready", upcoming: Array.from({ length: 12 }, (_, index) => ({ id: index + 1, status: "NS", date: new Date(Date.now() + 3600000).toISOString(), odds: { home: 2 } })) });
    const page = await Page({ searchParams: Promise.resolve({ aba: "odds", page: "2" }) });
    expect(mocks.users).not.toHaveBeenCalled();
    expect(page.props.matches.map((match: { id: number }) => match.id)).toEqual([11, 12]);
    expect(page.props.pagination).toEqual({ page: 2, pageSize: 10, total: 12, totalPages: 2 });
  });
  it("informa ausência da chave da API", async () => {
    mocks.feed.mockResolvedValue({ upcoming: [], availability: "unconfigured" });
    expect((await Page({ searchParams: Promise.resolve({ aba: "odds" }) })).props.error).toContain("Configure a chave");
  });
  it("valida ID do jogo antes da consulta", async () => {
    const page = await Page({ searchParams: Promise.resolve({ aba: "odds", jogo: "0" }) });
    expect(page.props.error).toContain("identificador");
    expect(mocks.details).not.toHaveBeenCalled();
  });
});
