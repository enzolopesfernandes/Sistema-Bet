import { beforeEach, describe, expect, it, vi } from "vitest";
import Page from "@/app/(stubs)/jogos/[id]/page";

const mocks = vi.hoisted(() => ({ details: vi.fn(), user: vi.fn(), notFound: vi.fn(() => { throw new Error("PARTIDA_NAO_ENCONTRADA"); }) }));
vi.mock("server-only", () => ({}));
vi.mock("@/src/lib/jogos/details", () => ({ getMatchDetails: mocks.details }));
vi.mock("@/src/lib/auth/session", () => ({ getCurrentUser: mocks.user }));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("@/components/page/jogos/MatchDetailsPage", () => ({ default: () => null }));
vi.mock("@/components/page/jogos/MatchDetailsState", () => ({ default: () => null }));

beforeEach(() => {
  mocks.details.mockResolvedValue({ availability: "ready", match: { id: 42 } });
  mocks.user.mockResolvedValue(null);
});

describe("Página RSC de detalhes do jogo", () => {
  it("abre os detalhes sem exigir autenticação", async () => {
    const page = await Page({ params: Promise.resolve({ id: "42" }) });
    expect(mocks.details).toHaveBeenCalledWith(42);
    expect(page.props.match.id).toBe(42);
    expect(page.props.user).toBeNull();
  });

  it("envia nome, e-mail e papel ao cabeçalho sem expor o identificador interno", async () => {
    mocks.user.mockResolvedValue({ id: "interno", nome: "Ana", email: "ana@example.com", papel: "APOSTADOR" });
    const page = await Page({ params: Promise.resolve({ id: "42" }) });
    expect(page.props.user).toEqual({ nome: "Ana", email: "ana@example.com", papel: "APOSTADOR" });
  });

  it.each(["0", "-0", "1.5", "abc", "1e2", "9999999999999999999999"])("retorna 404 para ID inválido sem consultar a API: %s", async (id) => {
    await expect(Page({ params: Promise.resolve({ id }) })).rejects.toThrow("PARTIDA_NAO_ENCONTRADA");
    expect(mocks.details).not.toHaveBeenCalled();
  });

  it("retorna 404 quando a partida não é encontrada", async () => {
    mocks.details.mockResolvedValue({ availability: "not-found", match: null });
    await expect(Page({ params: Promise.resolve({ id: "42" }) })).rejects.toThrow("PARTIDA_NAO_ENCONTRADA");
  });

  it.each(["unconfigured", "unavailable"])("preserva a navegação quando o serviço está %s", async (availability) => {
    mocks.details.mockResolvedValue({ availability, match: null });
    const page = await Page({ params: Promise.resolve({ id: "42" }) });
    expect(page.props.state).toBe("unavailable");
    expect(mocks.notFound).not.toHaveBeenCalled();
  });
});
