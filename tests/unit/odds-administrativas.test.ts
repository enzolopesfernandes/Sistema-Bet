import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyManagedOdds } from "@/src/lib/jogos/managed-odds";
import { matchEntityId } from "@/src/lib/jogos/identity";
import type { Match } from "@/src/lib/jogos/types";

const db = vi.hoisted(() => ({ selecao: { findMany: vi.fn() } }));
vi.mock("server-only", () => ({}));
vi.mock("@/src/lib/prisma", () => ({ default: db }));
const match = { id: 42, status: "NS", odds: { home: 1.5, draw: 2, away: 1.8, source: "Provedor", updatedAt: null } } as Match;
beforeEach(() => { db.selecao.findMany.mockReset().mockResolvedValue([]); });

describe("Cotações administrativas fora do cache externo", () => {
  it("sobrepõe a odd manual sem alterar o objeto do provedor", async () => {
    db.selecao.findMany.mockResolvedValue([{ id: matchEntityId(42, "home"), odd_atual: "2.3456", status: "ABERTA", resultado: "PENDENTE", atualizado_em: new Date("2026-10-31T12:00:00Z") }]);
    const [result] = await applyManagedOdds([match]);
    expect(result.odds).toMatchObject({ home: 2.3456, draw: 2, away: 1.8, source: "Cotação administrativa" });
    expect(match.odds?.home).toBe(1.5);
    expect(db.selecao.findMany.mock.calls[0][0].where.odd_manual).toBe(true);
  });
  it("mantém as cotações sem alteração administrativa", async () => {
    expect(await applyManagedOdds([match])).toEqual([match]);
  });
  it("não consulta odds de partida encerrada", async () => {
    await applyManagedOdds([{ ...match, status: "FT", odds: null }]);
    expect(db.selecao.findMany).not.toHaveBeenCalled();
  });
  it("não oferece odds de seleção suspensa", async () => {
    db.selecao.findMany.mockResolvedValue([{ id: matchEntityId(42, "home"), status: "SUSPENSA" }]);
    expect((await applyManagedOdds([match]))[0].odds).toBeNull();
  });
  it("propaga falha do banco em vez de ignorar a cotação manual", async () => {
    db.selecao.findMany.mockRejectedValue(new Error("Sem conexão"));
    await expect(applyManagedOdds([match])).rejects.toThrow("Sem conexão");
  });
});
