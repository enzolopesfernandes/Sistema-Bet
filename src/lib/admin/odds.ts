import "server-only";
import { validMatchId } from "@/lib/gestao";
import { randomUUID } from "node:crypto";
import { Prisma } from "@/src/generated/prisma/client";
import prisma from "@/src/lib/prisma";
import { transaction } from "@/src/lib/apostas/transaction";
import { isBettingOpen } from "@/src/lib/apostas/rules";
import { getMatchDetails } from "@/src/lib/jogos/details";
import { matchEntityId } from "@/src/lib/jogos/identity";
import { object, validOdd, OUTCOMES, OUTCOME_LABELS, type OddsHistory, type OddsValues } from "@/lib/admin";
import { AdminError, assertAdmin } from "./access";

function fixtureId(id: number) {
  if (!validMatchId(id)) throw new AdminError("Informe um identificador de jogo válido");
}

export async function updateOdds(adminId: string, id: number, input: unknown) {
  fixtureId(id);
  const body = object(input), values = object(body.odds), expected = object(body.anterior);
  if (!OUTCOMES.every((outcome) => validOdd(values[outcome]) && validOdd(expected[outcome]))) throw new AdminError("Informe valores válidos para as odds");
  const motivo = typeof body.motivo === "string" ? body.motivo.trim() : "";
  if (motivo.length > 500) throw new AdminError("O motivo deve possuir no máximo 500 caracteres");
  await assertAdmin(adminId);
  const result = await getMatchDetails(id);
  if (result.availability === "not-found") throw new AdminError("Jogo não encontrado", 404);
  if (result.availability !== "ready") throw new AdminError("Não foi possível carregar as informações do jogo", 503);
  const match = result.match;
  if (!isBettingOpen(match) || !match.odds) throw new AdminError("As odds informadas não podem ser aplicadas ao jogo selecionado", 409);
  const quoted = match.odds;

  return transaction(async (tx) => {
    await assertAdmin(adminId, tx);
    if (!isBettingOpen(match)) throw new AdminError("Este jogo não está mais disponível para configuração de odds", 409);
    const game = id < 0 ? await tx.jogo.findFirstOrThrow({ where: { local_id: -id, api_football_id: null, removido_em: null } }) : await tx.jogo.upsert({
      where: { api_football_id: id }, update: {},
      create: { id: matchEntityId(id, "jogo"), api_football_id: id, esporte: "Futebol", campeonato: match.league.slice(0, 150), mandante: match.home.name.slice(0, 150), visitante: match.away.name.slice(0, 150), inicio_em: new Date(match.date), status: "AGENDADO" },
    });
    if (game.removido_em || game.status !== "AGENDADO" || game.inicio_em <= new Date()) throw new AdminError("Este jogo não está mais disponível para configuração de odds", 409);
    const market = await tx.mercado.upsert({
      where: { id: matchEntityId(id, "1x2") }, update: {},
      create: { id: matchEntityId(id, "1x2"), jogo_id: game.id, nome: "Resultado no tempo regulamentar · 1X2" },
    });
    if (market.status !== "ABERTO") throw new AdminError("Este mercado não está disponível para configuração de odds", 409);
    const previous: Partial<OddsValues> = {}, next: Partial<OddsValues> = {};
    const now = new Date();
    for (const outcome of OUTCOMES) {
      const selection = await tx.selecao.upsert({
        where: { id: matchEntityId(id, outcome) }, update: {},
        create: { id: matchEntityId(id, outcome), mercado_id: market.id, descricao: OUTCOME_LABELS[outcome], odd_atual: new Prisma.Decimal(quoted[outcome]).toDecimalPlaces(4) },
      });
      if (selection.status !== "ABERTA" || selection.resultado !== "PENDENTE") throw new AdminError("As odds informadas não podem ser aplicadas ao jogo selecionado", 409);
      const current = selection.odd_manual ? selection.odd_atual : new Prisma.Decimal(quoted[outcome]).toDecimalPlaces(4);
      if (!current.equals(expected[outcome] as string)) throw new AdminError("As odds foram alteradas. Atualize a página e confira os novos valores.", 409);
      const updated = new Prisma.Decimal(values[outcome] as string);
      previous[outcome] = current.toFixed(4);
      next[outcome] = updated.toFixed(4);
      // Ativar o controle manual também é uma alteração, mesmo com o mesmo valor.
      if (!selection.odd_manual || !current.equals(updated)) {
        await tx.selecao.update({ where: { id: selection.id }, data: { odd_atual: updated, odd_manual: true, atualizado_em: now } });
        await tx.historico_odds.create({ data: { id: randomUUID(), selecao_id: selection.id, admin_id: adminId, odd_anterior: current, odd_nova: updated, motivo: motivo || null, alterada_em: now } });
      }
    }
    await tx.jogo.updateMany({ where: { id: game.id }, data: { versao: { increment: 1 }, atualizado_em: now } });
    await tx.auditoria_admin.create({ data: {
      id: randomUUID(), admin_id: adminId, acao: "DEFINIR_ODDS", entidade: "jogo", entidade_id: game.id,
      dados_anteriores: previous, dados_novos: next, motivo: motivo || null,
    } });
    return { odds: next as OddsValues };
  });
}

export async function getOddsHistory(adminId: string, id: number): Promise<OddsHistory[]> {
  fixtureId(id);
  await assertAdmin(adminId);
  const ids = OUTCOMES.map((outcome) => matchEntityId(id, outcome));
  const history = await prisma.historico_odds.findMany({ where: { selecao_id: { in: ids } }, orderBy: [{ alterada_em: "desc" }, { id: "desc" }], take: 20 });
  const admins = await prisma.usuario.findMany({ where: { id: { in: [...new Set(history.map((row) => row.admin_id))] } }, select: { id: true, nome: true } });
  return history.map((row) => ({
    id: row.id, selecao: OUTCOME_LABELS[OUTCOMES[ids.indexOf(row.selecao_id)]], anterior: row.odd_anterior.toFixed(4), nova: row.odd_nova.toFixed(4),
    motivo: row.motivo, alteradaEm: row.alterada_em.toISOString(), admin: admins.find((admin) => admin.id === row.admin_id)?.nome ?? "Administrador",
  }));
}
