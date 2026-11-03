import { object, validOdd } from "./admin";
import { parseAmount } from "./apostas";
import { validMatchId } from "./match-id";
export { validMatchId } from "./match-id";
export function gameInput(input: unknown) {
  const b = object(input);
  const mandante = typeof b.mandante === "string" ? b.mandante.trim() : "";
  const visitante = typeof b.visitante === "string" ? b.visitante.trim() : "";
  const campeonato = typeof b.campeonato === "string" ? b.campeonato.trim() : "";
  const inicio = typeof b.inicio === "string" ? new Date(b.inicio) : new Date(NaN);
  if (![mandante, visitante, campeonato].every(v => v.length > 0 && v.length <= 150) || mandante.toLowerCase() === visitante.toLowerCase() || !Number.isFinite(inicio.getTime()) || inicio <= new Date()) return null;
  const odds = object(b.odds);
  if (!["home", "draw", "away"].every(k => validOdd(odds[k]))) return null;
  return { mandante, visitante, campeonato, inicio, odds: odds as Record<"home" | "draw" | "away", string> };
}
export type PromotionView = { id: string; nome: string; codigo: string | null; descricao: string; tipo: "BONUS_CREDITO" | "ODDS_BOOST"; beneficio: string; minimo: string; jogoId: number | null; inicio: string; fim: string; limite: number | null; porUsuario: number; status: "ATIVA" | "PAUSADA" | "ENCERRADA"; versao: number };
export function promotionInput(input: unknown) {
  const b = object(input);
  const nome = typeof b.nome === "string" ? b.nome.trim() : "";
  const descricao = typeof b.descricao === "string" ? b.descricao.trim() : "";
  const codigo = typeof b.codigo === "string" ? b.codigo.trim().toUpperCase() : "";
  const inicio = typeof b.inicio === "string" ? new Date(b.inicio) : new Date(NaN);
  const fim = typeof b.fim === "string" ? new Date(b.fim) : new Date(NaN);
  const beneficio = parseAmount(b.beneficio), minimo = parseAmount(b.minimo);
  if (!nome || nome.length > 150 || !descricao || descricao.length > 500 || (codigo && !/^[A-Z0-9_-]{1,60}$/.test(codigo)) || !beneficio || !minimo) return null;
  if (b.tipo !== "BONUS_CREDITO" && b.tipo !== "ODDS_BOOST") return null;
  if (b.tipo === "ODDS_BOOST" && Number(beneficio) > 100) return null;
  if (!Number.isFinite(inicio.getTime()) || !Number.isFinite(fim.getTime()) || fim <= inicio || fim <= new Date()) return null;
  if (b.status !== "ATIVA" && b.status !== "PAUSADA" && b.status !== "ENCERRADA") return null;
  if (b.jogoId !== null && !validMatchId(b.jogoId)) return null;
  if (!Number.isInteger(b.porUsuario) || Number(b.porUsuario) < 1 || Number(b.porUsuario) > 1000000) return null;
  if (b.limite !== null && (!Number.isInteger(b.limite) || Number(b.limite) < 1 || Number(b.limite) > 1000000)) return null;
  return { nome, descricao, codigo: codigo || null, inicio, fim, beneficio, minimo, tipo: b.tipo as PromotionView["tipo"], status: b.status as PromotionView["status"], jogoId: b.jogoId as number | null, limite: b.limite as number | null, porUsuario: b.porUsuario as number };
}
export type GameView = { id: string; fixtureId: number; mandante: string; visitante: string; campeonato: string; inicio: string; status: string; versao: number; resultado: string | null; odds: { home: string; draw: string; away: string } };
export type WithdrawalView = { id: string; usuario: string; email: string; valor: string; metodo: string; status: string; motivo: string | null; criadoEm: string; decididoEm: string | null };
export const WITHDRAW_METHOD = "CREDITOS_DEMONSTRACAO";
