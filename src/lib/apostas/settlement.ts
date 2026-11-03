import "server-only";
import { publicGameId, gameWhere } from "@/src/lib/jogos/local";

import { randomUUID } from "node:crypto";
import { Prisma } from "@/src/generated/prisma/client";
import prisma from "@/src/lib/prisma";
import { getMatchDetails } from "@/src/lib/jogos/details";
import type { MatchDetails } from "@/src/lib/jogos/types";
import { changeBalance } from "@/src/lib/saldo/service";
import { matchEntityId, outcomeDescriptions } from "./service";
import { transaction } from "./transaction";
import type { BetOutcome } from "@/lib/apostas";

/** O mercado 1X2 considera apenas os 90 minutos, inclusive em jogos com prorrogação. */
export function finalOutcome(match: MatchDetails): BetOutcome | "cancelled" | null {
  if (match.status === "CANC") return "cancelled";
  if (!["FT", "AET", "PEN"].includes(match.status)) return null;
  const fulltime = match.scores.find((score) => score.label === "Tempo regulamentar");
  const home = fulltime?.home ?? (match.status === "FT" ? match.home.goals : null);
  const away = fulltime?.away ?? (match.status === "FT" ? match.away.goals : null);
  if (home === null || away === null) return null;
  return home > away ? "home" : home < away ? "away" : "draw";
}

async function settleBet(userId: string, betId: string, fixtureId: number, result: NonNullable<ReturnType<typeof finalOutcome>>) {
  return transaction(async (tx) => {
    const bet = await tx.aposta.findFirst({ where: { id: betId, usuario_id: userId, status: "PENDENTE" } });
    if (!bet) return false;
    const items = await tx.item_aposta.findMany({ where: { aposta_id: bet.id } });
    // Apenas apostas simples criadas por este fluxo podem ser liquidadas automaticamente.
    if (items.length !== 1) return false;
    const item = items[0];
    if (!["home", "draw", "away"].some((outcome) => item.selecao_id === matchEntityId(fixtureId, outcome))) return false;
    const won = result !== "cancelled" && item.selecao_id === matchEntityId(fixtureId, result);
    const cancelled = result === "cancelled";
    const payout = cancelled ? bet.valor : won ? bet.retorno_potencial : new Prisma.Decimal(0);
    const settledAt = new Date();
    const updated = await tx.aposta.updateMany({ where: { id: bet.id, usuario_id: userId, status: "PENDENTE" }, data: { status: cancelled ? "ANULADA" : won ? "GANHA" : "PERDIDA", liquidada_em: settledAt } });
    if (updated.count !== 1) return false;
    await tx.item_aposta.update({ where: { id: item.id }, data: { resultado: cancelled ? "ANULADA" : won ? "GANHOU" : "PERDEU", liquidado_em: settledAt } });
    if (payout.greaterThan(0)) {
      const wallet = await tx.carteira.findFirstOrThrow({ where: { id: bet.carteira_id, usuario_id: userId } });
      const balance = await changeBalance(tx, wallet, payout);
      await tx.movimentacao.create({ data: {
        id: randomUUID(), carteira_id: wallet.id, aposta_id: bet.id, tipo: cancelled ? "ESTORNO" : "PREMIO",
        valor_assinado: payout, saldo_apos: balance, motivo: cancelled ? "Estorno simulado por cancelamento da partida" : "Retorno fictício da aposta ganha",
        idempotency_key: matchEntityId(fixtureId, `liquidacao:${bet.id}`),
      } });
    }
    await tx.jogo.updateMany({ where: gameWhere(fixtureId), data: {
      status: cancelled ? "CANCELADO" : "ENCERRADO", resultado: cancelled ? "Partida cancelada" : `90 minutos: ${outcomeDescriptions[result]}`, atualizado_em: settledAt,
    } });
    await tx.mercado.updateMany({ where: { id: matchEntityId(fixtureId, "1x2") }, data: { status: "FECHADO" } });
    await tx.selecao.updateMany({ where: { id: item.selecao_id }, data: { status: "FECHADA", resultado: cancelled ? "ANULADA" : won ? "GANHOU" : "PERDEU", atualizado_em: settledAt } });
    return true;
  });
}

export async function updateBetResults(userId: string) {
  const bets = await prisma.aposta.findMany({ where: { usuario_id: userId, status: "PENDENTE" }, orderBy: { criada_em: "asc" } });
  if (!bets.length) return { updated: 0, unavailable: false };
  const items = await prisma.item_aposta.findMany({ where: { aposta_id: { in: bets.map((bet) => bet.id) } } });
  const selections = await prisma.selecao.findMany({ where: { id: { in: items.map((item) => item.selecao_id) } } });
  const markets = await prisma.mercado.findMany({ where: { id: { in: selections.map((selection) => selection.mercado_id) } } });
  const games = await prisma.jogo.findMany({ where: { id: { in: markets.map((market) => market.jogo_id) }, OR: [{ inicio_em: { lte: new Date() } }, { status: "CANCELADO" }] }, orderBy: [{ atualizado_em: "asc" }, { inicio_em: "asc" }], take: 6 });
  let updated = 0;
  let unavailable = false;
  // A última consulta ordena a próxima rodada, evitando bloquear jogos mais novos.
  // O lote pequeno limita o consumo da cota e o tempo de espera na interface.
  for (const game of games) {
    const fixtureId = publicGameId(game);
    const response = await getMatchDetails(fixtureId);
    await prisma.jogo.updateMany({ where: { id: game.id }, data: { atualizado_em: new Date() } });
    if (response.availability !== "ready") { unavailable = true; continue; }
    const outcome = finalOutcome(response.match);
    if (outcome === null) continue;
    for (const bet of bets) {
      const item = items.find((entry) => entry.aposta_id === bet.id);
      if (!item || !["home", "draw", "away"].some((selection) => item.selecao_id === matchEntityId(fixtureId, selection))) continue;
      if (await settleBet(userId, bet.id, fixtureId, outcome)) updated++;
    }
  }
  return { updated, unavailable };
}
