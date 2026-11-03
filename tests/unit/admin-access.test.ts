import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireAdmin } from "@/src/lib/admin/access";

const mocks = vi.hoisted(() => ({ user: vi.fn(), redirect: vi.fn((path: string) => { throw new Error(`REDIRECIONAR:${path}`); }) }));
vi.mock("server-only", () => ({}));
vi.mock("@/src/lib/prisma", () => ({ default: {} }));
vi.mock("@/src/lib/auth/session", () => ({ getCurrentUser: mocks.user }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
beforeEach(() => vi.clearAllMocks());

describe("Acesso à página administrativa", () => {
  it("redireciona visitante para login", async () => {
    mocks.user.mockResolvedValue(null);
    await expect(requireAdmin()).rejects.toThrow("REDIRECIONAR:/login");
  });
  it("redireciona apostador para início", async () => {
    mocks.user.mockResolvedValue({ papel: "APOSTADOR" });
    await expect(requireAdmin()).rejects.toThrow("REDIRECIONAR:/");
  });
  it("permite o administrador autenticado", async () => {
    mocks.user.mockResolvedValue({ id: "admin", papel: "ADMINISTRADOR" });
    expect(await requireAdmin()).toMatchObject({ id: "admin" });
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});
