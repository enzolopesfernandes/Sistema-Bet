import { beforeEach, describe, expect, it, vi } from "vitest";
import Page from "@/app/(stubs)/apostas/page";
import { BET_MESSAGES } from "@/lib/apostas";

const mocks = vi.hoisted(() => ({ user: vi.fn(), history: vi.fn() }));
vi.mock("@/src/lib/auth/session", () => ({ requireUser: mocks.user }));
vi.mock("@/src/lib/apostas/service", () => ({ getBetHistory: mocks.history }));
vi.mock("@/components/page/apostas/BetHistoryPage", () => ({ default: () => null }));

beforeEach(() => {
  vi.resetAllMocks();
  mocks.user.mockResolvedValue({ id: "ana", nome: "Ana", email: "ana@example.com" });
  mocks.history.mockResolvedValue({ bets: [], pagination: { page: 1, pageSize: 10, total: 0, totalPages: 1 } });
});

describe("Página RSC do histórico", () => {
  it("exige sessão e consulta somente a conta autenticada", async () => {
    const page = await Page({ searchParams: Promise.resolve({}) });
    expect(mocks.user).toHaveBeenCalledOnce();
    expect(mocks.history).toHaveBeenCalledWith("ana", 1, 10);
    expect(page.props.user).toEqual({ nome: "Ana", email: "ana@example.com" });
    expect(page.props.error).toBeUndefined();
  });
  it("aplica página e tamanho da URL no serviço, sem paginar no cliente", async () => {
    await Page({ searchParams: Promise.resolve({ page: "3", pageSize: "20" }) });
    expect(mocks.history).toHaveBeenCalledWith("ana", 3, 20);
  });
  it("renderiza a mensagem de falha sem perder o cabeçalho da conta", async () => {
    mocks.history.mockRejectedValue(new Error("Erro interno"));
    const page = await Page({ searchParams: Promise.resolve({}) });
    expect(page.props.error).toBe(BET_MESSAGES.historyFailed);
    expect(page.props.user.nome).toBe("Ana");
  });
  it("não consulta o histórico se a sessão não for válida", async () => {
    mocks.user.mockRejectedValue(new Error("Redirecionamento para login"));
    await expect(Page({ searchParams: Promise.resolve({}) })).rejects.toThrow("login");
    expect(mocks.history).not.toHaveBeenCalled();
  });
  it("ignora identificador inválido recebido por parâmetro", async () => {
    const page = await Page({ searchParams: Promise.resolve({ aposta: "../outra-conta" }) });
    expect(page.props.initialBetId).toBeUndefined();
  });
});
