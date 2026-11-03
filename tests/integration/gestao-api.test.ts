import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST as game } from "@/app/api/admin/jogos/route";
import { PATCH as editGame } from "@/app/api/admin/jogos/[id]/route";
import { POST as promotion } from "@/app/api/admin/promocoes/route";
import { PATCH as editPromotion } from "@/app/api/admin/promocoes/[id]/route";
import { PATCH as decide } from "@/app/api/admin/saques/[id]/route";
import { POST as withdraw } from "@/app/api/saques/route";
import { PATCH as account } from "@/app/api/conta/route";
import { GET as promotions } from "@/app/api/promocoes/route";

const mocks = vi.hoisted(() => ({ user: vi.fn(), game: vi.fn(), promo: vi.fn(), decide: vi.fn(), withdraw: vi.fn(), account: vi.fn(), available: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/src/lib/auth/session", () => ({ findSessionUser: mocks.user, SESSION_COOKIE: "sessao", SESSION_COOKIE_OPTIONS: { httpOnly: true, path: "/" } }));
vi.mock("@/src/lib/admin/games", () => ({ saveGame: mocks.game }));
vi.mock("@/src/lib/promocoes/service", () => ({ savePromotion: mocks.promo, availablePromotions: mocks.available }));
vi.mock("@/src/lib/saques/service", () => ({ requestWithdrawal: mocks.withdraw, decideWithdrawal: mocks.decide }));
vi.mock("@/src/lib/conta/service", () => ({ manageAccount: mocks.account }));
const context = { params: Promise.resolve({ id: "registro" }) };
function request(method = "POST", origin = "http://localhost") { return new NextRequest("http://localhost/api/teste?jogo=-1", { method, headers: { "Content-Type": "application/json", Origin: origin }, ...(method !== "GET" ? { body: JSON.stringify({ valor: "10", usuarioId: "outro", adminId: "outro" }) } : {}) }); }
beforeEach(() => { vi.resetAllMocks(); mocks.user.mockResolvedValue({ id: "autenticado", papel: "ADMINISTRADOR" }); mocks.account.mockResolvedValue({ sair: true }); });
describe("Autorização das novas operações HTTP", () => {
  const adminRoutes = [game, promotion, (r: NextRequest) => editGame(r, context), (r: NextRequest) => editPromotion(r, context), (r: NextRequest) => decide(r, context)];
  it.each(adminRoutes.map((route, i) => [i, route] as const))("rejeita visitante e apostador na operação administrativa %i", async (_, route) => {
    mocks.user.mockResolvedValue(null); expect((await route(request())).status).toBe(401);
    mocks.user.mockResolvedValue({ id: "apostador", papel: "APOSTADOR" }); expect((await route(request())).status).toBe(403);
    expect(mocks.game).not.toHaveBeenCalled(); expect(mocks.promo).not.toHaveBeenCalled(); expect(mocks.decide).not.toHaveBeenCalled();
  });
  it("rejeita solicitações de outra origem antes de gravar", async () => {
    for (const route of [...adminRoutes, withdraw, account]) expect((await route(request("POST", "https://outra.origem"))).status).toBe(403);
    expect(mocks.withdraw).not.toHaveBeenCalled(); expect(mocks.account).not.toHaveBeenCalled();
  });
  it("usa a identidade da sessão e mantém as respostas privadas", async () => {
    mocks.withdraw.mockResolvedValue({ id: "saque", saldo: "90.00" });
    const result = await withdraw(request());
    expect(result.status).toBe(201); expect(result.headers.get("cache-control")).toBe("no-store");
    expect(mocks.withdraw.mock.calls[0][0]).toBe("autenticado");
  });
  it("apaga o cookie quando o gerenciamento da conta encerra as sessões", async () => {
    const result = await account(request("PATCH"));
    expect(result.status).toBe(200); expect(result.headers.get("set-cookie")).toContain("Max-Age=0");
    expect(mocks.account.mock.calls[0][0]).toBe("autenticado");
  });
  it("exige login também para conta, saque e promoções pessoais", async () => {
    mocks.user.mockResolvedValue(null);
    expect((await account(request("PATCH"))).status).toBe(401);
    expect((await withdraw(request())).status).toBe(401);
    expect((await promotions(request("GET"))).status).toBe(401);
  });
  it("omite detalhes internos em falhas inesperadas", async () => {
    mocks.game.mockRejectedValue(new Error("segredo do banco"));
    const response = await game(request());
    expect(response.status).toBe(503); expect(await response.text()).not.toContain("segredo");
  });
});
