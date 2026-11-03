import "server-only";
import { promotionForBet } from "@/src/lib/promocoes/service";
import { activeUser } from "@/src/lib/conta/service";
import { object } from "@/lib/admin";

import { randomUUID } from "node:crypto";
import { matchEntityId } from "@/src/lib/jogos/identity";
export { matchEntityId } from "@/src/lib/jogos/identity";
import { Prisma } from "@/src/generated/prisma/client";
import prisma from "@/src/lib/prisma";
import { getMatchDetails } from "@/src/lib/jogos/details";
import { changeBalance, getOrCreateWallet } from "@/src/lib/saldo/service";
import { BET_MESSAGES, UUID_PATTERN, validateBet, type BetOutcome, type BetSummary } from "@/lib/apostas";
import { BetError } from "./errors";
import { transaction } from "./transaction";
import { isBettingOpen } from "./rules";

export const outcomeDescriptions: Record<BetOutcome, string> = { home: "Mandante", draw: "Empate", away: "Visitante" };

export async function placeBet(userId: string, input: { valor: string; jogoId: number; selecao: BetOutcome; odd: string; idempotencyKey: string; promocaoId?: string | null; promocaoVersao?: number }) {
  const validation = validateBet(input);
  if (!validation.data) throw new BetError(validation.message, 400);
  const data = validation.data;
  const amount = new Prisma.Decimal(data.valor);
  const selectionId = matchEntityId(data.jogoId, data.selecao);

  async function replay(tx: Prisma.TransactionClient) {
    const previous = await tx.aposta.findUnique({ where: { idempotency_key: data.idempotencyKey } });
    if (!previous) return null;
    const item = await tx.item_aposta.findFirst({ where: { aposta_id: previous.id } });
    if (previous.usuario_id !== userId || !previous.valor.equals(amount) || item?.selecao_id !== selectionId || !(previous.odd_solicitada ?? previous.odd_total).equals(data.odd) || (previous.promocao_id ?? null) !== (data.promocaoId ?? null) || (data.promocaoId && object(previous.promocao_snapshot).versao !== data.promocaoVersao)) throw new BetError("Esta solicitação já foi utilizada com outros dados");
    const wallet = await tx.carteira.findUniqueOrThrow({ where: { id: previous.carteira_id } });
    return { id: previous.id, saldo: wallet.saldo_atual.toFixed(2) };
  }

  // Uma repetição continua válida mesmo depois do início do jogo ou de falha do provedor.
  const previous = await replay(prisma);
  if (previous) return previous;
  const result = await getMatchDetails(data.jogoId);
  if (result.availability !== "ready") throw new BetError("Não foi possível consultar o jogo para confirmar a aposta. Tente novamente.", 503);
  const match = result.match;
  if (!isBettingOpen(match)) throw new BetError("As apostas para esta partida estão encerradas");
  const quoted = match.odds?.[data.selecao];
  if (!quoted || !Number.isFinite(quoted) || quoted <= 1 || quoted >= 100000000) throw new BetError("A cotação desta seleção está indisponível");
  const odd = new Prisma.Decimal(quoted).toDecimalPlaces(4);
  if (!odd.equals(data.odd)) throw new BetError("A cotação foi alterada. Atualize a página e confirme a nova odd.");

  return transaction(async (tx) => {
    await activeUser(tx, userId);
    const repeated = await replay(tx);
    if (repeated) return repeated;
    if (!isBettingOpen(match)) throw new BetError("As apostas para esta partida estão encerradas");
    const game = data.jogoId < 0 ? await tx.jogo.findFirstOrThrow({ where: { local_id: -data.jogoId, api_football_id: null, removido_em: null } }) : await tx.jogo.upsert({
      where: { api_football_id: match.id }, update: {},
      create: { id: matchEntityId(match.id, "jogo"), api_football_id: match.id, esporte: "Futebol", campeonato: match.league.slice(0, 150), mandante: match.home.name.slice(0, 150), visitante: match.away.name.slice(0, 150), inicio_em: new Date(match.date), status: "AGENDADO" },
    });
    if (game.removido_em || game.status !== "AGENDADO" || game.inicio_em <= new Date()) throw new BetError("As apostas para esta partida estão encerradas");
    const market = await tx.mercado.upsert({
      where: { id: matchEntityId(match.id, "1x2") }, update: {},
      create: { id: matchEntityId(match.id, "1x2"), jogo_id: game.id, nome: "Resultado no tempo regulamentar · 1X2" },
    });
    if (market.status !== "ABERTO") throw new BetError("Este mercado não está disponível para apostas");
    const selection = await tx.selecao.upsert({
      where: { id: selectionId }, update: {},
      create: { id: selectionId, mercado_id: market.id, descricao: outcomeDescriptions[data.selecao], odd_atual: odd },
    });
    if (selection.status !== "ABERTA" || selection.resultado !== "PENDENTE") throw new BetError("Esta seleção não está disponível para apostas");
    // Uma alteração administrativa pode ter ocorrido após a consulta da partida.
    if (selection.odd_manual && !selection.odd_atual.equals(odd)) throw new BetError("A cotação foi alterada. Atualize a página e confirme a nova odd.");
    if (!selection.odd_manual) await tx.selecao.updateMany({ where: { id: selectionId, odd_manual: false }, data: { odd_atual: odd, atualizado_em: new Date() } });
    const benefit = await promotionForBet(tx, userId, data.jogoId, amount, odd, data.promocaoId, data.promocaoVersao);
    const potential = amount.mul(benefit.odd).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    const wallet = await getOrCreateWallet(tx, userId);
    const balance = await changeBalance(tx, wallet, amount.negated());
    const bet = await tx.aposta.create({ data: {
      id: randomUUID(), usuario_id: userId, carteira_id: wallet.id, valor: amount, odd_total: benefit.odd, odd_solicitada: odd,
      ...(benefit.promotion ? { promocao_id: benefit.promotion.id, promocao_snapshot: benefit.promotion } : {}),
      retorno_potencial: potential, idempotency_key: data.idempotencyKey,
    } });
    await tx.item_aposta.create({ data: {
      id: randomUUID(), aposta_id: bet.id, selecao_id: selection.id, odd_contratada: benefit.odd,
      jogo_snapshot: `${match.home.name} × ${match.away.name}`.slice(0, 320), mercado_snapshot: market.nome,
      selecao_snapshot: data.selecao === "draw" ? "Empate" : match[data.selecao].name.slice(0, 150),
    } });
    await tx.movimentacao.create({ data: {
      id: randomUUID(), carteira_id: wallet.id, aposta_id: bet.id, tipo: "APOSTA", valor_assinado: amount.negated(),
      saldo_apos: balance, motivo: "Aposta simples com créditos fictícios", idempotency_key: data.idempotencyKey,
    } });
    let finalBalance = balance;
    if (benefit.promotion) {
      const usage = await tx.uso_promocao.create({ data: { id: randomUUID(), promocao_id: benefit.promotion.id, usuario_id: userId, aposta_id: bet.id, bonus_creditado: benefit.bonus } });
      if (benefit.bonus.greaterThan(0)) {
        const updatedWallet = await tx.carteira.findUniqueOrThrow({ where: { id: wallet.id } });
        finalBalance = await changeBalance(tx, updatedWallet, benefit.bonus);
        await tx.movimentacao.create({ data: { id: randomUUID(), carteira_id: wallet.id, aposta_id: bet.id, uso_promocao_id: usage.id, tipo: "BONUS", valor_assinado: benefit.bonus, saldo_apos: finalBalance, motivo: benefit.promotion.nome, idempotency_key: usage.id } });
      }
    }
    return { id: bet.id, saldo: finalBalance.toFixed(2) };
  });
}

async function serializeBets(tx: Prisma.TransactionClient, bets: Awaited<ReturnType<typeof prisma.aposta.findMany>>): Promise<BetSummary[]> {
  if (!bets.length) return [];
  const ids = bets.map((bet) => bet.id);
  const [items, credits] = await Promise.all([
    tx.item_aposta.findMany({ where: { aposta_id: { in: ids } }, orderBy: { id: "asc" } }),
    tx.movimentacao.findMany({ where: { aposta_id: { in: ids }, tipo: { in: ["PREMIO", "ESTORNO"] } } }),
  ]);
  return bets.map((bet) => {
    const betItems = items.filter((item) => item.aposta_id === bet.id);
    if (!betItems.length) throw new BetError(BET_MESSAGES.detailsInvalid, 503);
    const obtained = credits.filter((credit) => credit.aposta_id === bet.id && credit.carteira_id === bet.carteira_id).reduce((total, credit) => total.add(credit.valor_assinado), new Prisma.Decimal(0));
    return {
      id: bet.id, valor: bet.valor.toFixed(2), odd: bet.odd_total.toFixed(4), retornoPotencial: bet.retorno_potencial.toFixed(2),
      valorObtido: bet.status === "PENDENTE" ? null : obtained.toFixed(2), status: bet.status,
      promocao: typeof object(bet.promocao_snapshot).nome === "string" ? String(object(bet.promocao_snapshot).nome) : null,
      criadaEm: bet.criada_em.toISOString(), liquidadaEm: bet.liquidada_em?.toISOString() ?? null,
      itens: betItems.map((item) => ({ jogo: item.jogo_snapshot, mercado: item.mercado_snapshot, selecao: item.selecao_snapshot, odd: item.odd_contratada.toFixed(4), resultado: item.resultado })),
    };
  });
}

export async function getBetHistory(userId: string, requestedPage: number, pageSize: number) {
  return prisma.$transaction(async (tx) => {
    const total = await tx.aposta.count({ where: { usuario_id: userId } });
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const page = Math.min(Math.max(1, requestedPage), totalPages);
    const bets = await tx.aposta.findMany({ where: { usuario_id: userId }, orderBy: [{ criada_em: "desc" }, { id: "desc" }], skip: (page - 1) * pageSize, take: pageSize });
    return { bets: await serializeBets(tx, bets), pagination: { page, pageSize, total, totalPages } };
  }, { isolationLevel: "RepeatableRead" });
}

export async function getBetDetails(userId: string, id: string) {
  if (!UUID_PATTERN.test(id)) throw new BetError(BET_MESSAGES.detailsFailed, 404);
  return prisma.$transaction(async (tx) => {
    const bet = await tx.aposta.findFirst({ where: { id, usuario_id: userId } });
    if (!bet) throw new BetError(BET_MESSAGES.detailsFailed, 404);
    return (await serializeBets(tx, [bet]))[0];
  }, { isolationLevel: "RepeatableRead" });
}
