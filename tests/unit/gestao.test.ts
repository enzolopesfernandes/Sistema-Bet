import { describe, expect, it } from "vitest";
import { gameInput, promotionInput, validMatchId } from "@/lib/gestao";
import { validateBet } from "@/lib/apostas";
const future = () => new Date(Date.now() + 86400000).toISOString();
const game = () => ({ mandante: "Azul", visitante: "Verde", campeonato: "Liga local", inicio: future(), odds: { home: "2.00", draw: "3.50", away: "2.75" } });
const promotion = () => ({ nome: "Boas-vindas", descricao: "Bônus ao apostar", codigo: "BONUS", tipo: "BONUS_CREDITO", beneficio: "5", minimo: "10", jogoId: null, inicio: new Date().toISOString(), fim: future(), limite: 10, porUsuario: 1, status: "ATIVA" });
describe("Regras de jogos locais e promoções", () => {
  it("distingue IDs locais negativos de IDs do provedor e rejeita valores não inteiros", () => {
    expect(validMatchId(-1)).toBe(true); expect(validMatchId(42)).toBe(true);
    for (const id of [0, 1.5, -2147483648, 2147483648, NaN, "42"]) expect(validMatchId(id)).toBe(false);
  });
  it("valida equipes distintas, limite de texto, data futura e precisão das odds", () => {
    expect(gameInput(game())).not.toBeNull();
    for (const patch of [{ visitante: " azul " }, { mandante: "" }, { campeonato: "a".repeat(151) }, { inicio: "inválido" }, { inicio: "2020-01-01" }, { odds: { home: "1", draw: "3", away: "2" } }, { odds: { home: "2.00001", draw: "3", away: "2" } }]) expect(gameInput({ ...game(), ...patch })).toBeNull();
  });
  it("exige uma condição de aposta mínima e validade coerente", () => {
    expect(promotionInput(promotion())?.beneficio).toBe("5.00");
    for (const patch of [{ minimo: "0" }, { descricao: "" }, { fim: "2020-01-01" }, { inicio: "2100-01-01" }, { porUsuario: 0 }, { limite: -1 }, { codigo: "código inválido" }, { jogoId: 0 }, { tipo: "OUTRO" }]) expect(promotionInput({ ...promotion(), ...patch })).toBeNull();
  });
  it("limita o aumento percentual a 100%, sem limitar bônus a esse valor", () => {
    expect(promotionInput({ ...promotion(), tipo: "ODDS_BOOST", beneficio: "100" })).not.toBeNull();
    expect(promotionInput({ ...promotion(), tipo: "ODDS_BOOST", beneficio: "100.01" })).toBeNull();
    expect(promotionInput({ ...promotion(), beneficio: "500" })).not.toBeNull();
  });
  it("a aposta aceita partida local mas exige identificação e versão da promoção", () => {
    const data = { jogoId: -1, valor: "10", odd: "2", selecao: "home", idempotencyKey: "12345678-1234-4123-8123-123456789abc" };
    expect(validateBet(data).data).toBeDefined();
    expect(validateBet({ ...data, promocaoId: data.idempotencyKey }).data).toBeUndefined();
    expect(validateBet({ ...data, promocaoId: data.idempotencyKey, promocaoVersao: 0 }).data).toBeDefined();
    expect(validateBet({ ...data, promocaoId: "x", promocaoVersao: 0 }).data).toBeUndefined();
  });
});
