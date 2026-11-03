import { describe, expect, it, vi } from "vitest";
import { BET_MESSAGES, DEMO_METHOD, parseAmount, parsePagination, validateBet, validateRecharge } from "@/lib/apostas";
import { finalOutcome } from "@/src/lib/apostas/settlement";
import type { MatchDetails } from "@/src/lib/jogos/types";

vi.mock("server-only", () => ({}));
vi.mock("@/src/lib/prisma", () => ({ default: {} }));

const key = "12345678-1234-4123-8123-123456789abc";

describe("Valores e solicitações de aposta e recarga", () => {
  it.each([["0,01", "0.01"], ["10,5", "10.50"], ["10000", "10000.00"], [" 23.45 ", "23.45"]])("normaliza %s sem perder centésimos", (input, output) => {
    expect(parseAmount(input)).toBe(output);
  });
  it.each(["", "0", "-1", "1e3", "Infinity", "NaN", "0.001", "10,123", "10000.01", "1.000,00", null, 10])("rejeita valores inválidos ou fora do limite: %j", (input) => {
    expect(parseAmount(input)).toBeNull();
  });
  it("exige valor e método e aceita apenas créditos de demonstração", () => {
    expect(validateRecharge({})).toEqual({ message: BET_MESSAGES.required });
    expect(validateRecharge({ valor: "-1", metodo: DEMO_METHOD, idempotencyKey: key })).toEqual({ message: BET_MESSAGES.invalidAmount });
    expect(validateRecharge({ valor: "10", metodo: "PIX", idempotencyKey: key }).data).toBeUndefined();
    expect(validateRecharge({ valor: "10", metodo: DEMO_METHOD, idempotencyKey: "inválido" }).data).toBeUndefined();
    expect(validateRecharge({ valor: "10,50", metodo: DEMO_METHOD, idempotencyKey: key }).data?.valor).toBe("10.50");
  });
  it("valida a seleção, jogo, odd e identificador sem confiar nos dados do cliente", () => {
    const input = { valor: "10", jogoId: 42, selecao: "home", odd: "1.50", idempotencyKey: key };
    expect(validateBet(input).data?.valor).toBe("10.00");
    for (const invalid of [{ jogoId: 0 }, { jogoId: 1.5 }, { jogoId: 2147483648 }, { selecao: "inexistente" }, { odd: "1" }, { odd: "1.23456" }, { idempotencyKey: "x" }]) {
      expect(validateBet({ ...input, ...invalid }).data).toBeUndefined();
    }
  });
  it("mantém a paginação na URL e limita os tamanhos disponíveis", () => {
    expect(parsePagination({ page: "3", pageSize: "20" })).toEqual({ page: 3, pageSize: 20 });
    for (const page of ["-1", "0", "1.5", "1e3", "999999999999999999999", ["2", "3"]]) {
      expect(parsePagination({ page, pageSize: "100000" })).toEqual({ page: 1, pageSize: 10 });
    }
  });
});

describe("Resultado do mercado no tempo regulamentar", () => {
  function match(status: string, home: number | null, away: number | null, fulltime?: [number | null, number | null]) {
    return { status, home: { goals: home }, away: { goals: away }, scores: fulltime ? [{ label: "Tempo regulamentar", home: fulltime[0], away: fulltime[1] }] : [] } as MatchDetails;
  }
  it("distingue vitória, empate e derrota", () => {
    expect(finalOutcome(match("FT", 2, 0))).toBe("home");
    expect(finalOutcome(match("FT", 1, 1))).toBe("draw");
    expect(finalOutcome(match("FT", 0, 1))).toBe("away");
  });
  it("não inclui gols de prorrogação nem pênaltis no resultado 1X2", () => {
    expect(finalOutcome(match("AET", 3, 2, [2, 2]))).toBe("draw");
    expect(finalOutcome(match("PEN", 1, 1, [0, 0]))).toBe("draw");
    expect(finalOutcome(match("AET", 3, 2))).toBeNull();
    expect(finalOutcome(match("PEN", 1, 1, [null, 0]))).toBeNull();
  });
  it("estorna cancelamentos e mantém jogos incompletos ou adiados pendentes", () => {
    expect(finalOutcome(match("CANC", null, null))).toBe("cancelled");
    for (const status of ["NS", "2H", "HT", "PST", "ABD", "INT"]) expect(finalOutcome(match(status, 2, 1))).toBeNull();
    expect(finalOutcome(match("FT", null, 1))).toBeNull();
  });
});
