import "server-only";
import { randomUUID } from "node:crypto";
import prisma from "@/src/lib/prisma";
import { Prisma } from "@/src/generated/prisma/client";
import { transaction } from "@/src/lib/apostas/transaction";
import { BetError } from "@/src/lib/apostas/errors";
import { assertAdmin } from "./access";
import { object, OUTCOMES, OUTCOME_LABELS } from "@/lib/admin";
import { gameInput, type GameView } from "@/lib/gestao";
import { publicGameId } from "@/src/lib/jogos/local";
import { matchEntityId } from "@/src/lib/jogos/identity";

export async function listGames(adminId: string, requestedPage: number, pageSize: number) {
  await assertAdmin(adminId);
  return prisma.$transaction(async tx => {
    const where = { removido_em: null };
    const total = await tx.jogo.count({ where });
    const totalPages = Math.max(1, Math.ceil(total / pageSize)), page = Math.min(requestedPage, totalPages);
    const rows = await tx.jogo.findMany({ where, orderBy: [{ inicio_em: "desc" }, { id: "desc" }], skip: (page - 1) * pageSize, take: pageSize });
    const selections = await tx.selecao.findMany({ where: { id: { in: rows.flatMap(r => OUTCOMES.map(o => matchEntityId(publicGameId(r), o))) } } });
    const items: GameView[] = rows.map(g => ({ id: g.id, fixtureId: publicGameId(g), mandante: g.mandante, visitante: g.visitante, campeonato: g.campeonato, inicio: g.inicio_em.toISOString(), status: g.status, resultado: g.resultado, versao: g.versao, odds: Object.fromEntries(OUTCOMES.map(o => [o, selections.find(s => s.id === matchEntityId(publicGameId(g), o))?.odd_atual.toFixed(4) ?? "2.0000"])) as GameView["odds"] }));
    return { items, pagination: { page, pageSize, total, totalPages } };
  }, { isolationLevel: "RepeatableRead" });
}
export async function saveGame(adminId: string, id: string | null, input: unknown) {
  const b = object(input), action = b.acao ?? "salvar";
  if (!["salvar", "remover", "cancelar", "resultado"].includes(String(action))) throw new BetError("Operação inválida", 400);
  const data = action === "salvar" ? gameInput(b) : null;
  if (action === "salvar" && !data) throw new BetError("Informe equipes diferentes, campeonato, data futura e odds válidas", 400);
  if (action === "resultado" && ![b.mandante, b.visitante].every(v => typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 99)) throw new BetError("Informe placares inteiros de 0 a 99", 400);
  return transaction(async tx => {
    await assertAdmin(adminId, tx);
    const previous = id ? await tx.jogo.findUnique({ where: { id } }) : null;
    if (id && (!previous || previous.removido_em)) throw new BetError("Jogo não encontrado", 404);
    if (previous && b.versao !== previous.versao) throw new BetError("Este jogo foi alterado. Atualize a página.", 409);
    if (action !== "salvar" && !previous) throw new BetError("Selecione um jogo", 400);
    if (previous && ["CANCELADO", "ENCERRADO"].includes(previous.status)) throw new BetError("O jogo selecionado não está disponível para esta operação", 409);
    const now = new Date();
    if (action === "salvar" || action === "remover") {
      if (previous) {
        const selections = OUTCOMES.map(o => matchEntityId(publicGameId(previous), o));
        if (await tx.item_aposta.count({ where: { selecao_id: { in: selections } } })) throw new BetError("Este jogo já recebeu apostas. Somente cancelamento ou resultado são permitidos.", 409);
        if (previous.inicio_em <= now) throw new BetError("Este jogo já iniciou e não pode ser editado ou removido", 409);
      }
    }
    let game = previous;
    if (action === "salvar" && data) {
      const values = { mandante: data.mandante, visitante: data.visitante, campeonato: data.campeonato, inicio_em: data.inicio, esporte: "Futebol", gerenciado: true, atualizado_em: now };
      game = previous ? await tx.jogo.update({ where: { id: previous.id }, data: { ...values, versao: { increment: 1 } } }) : await tx.jogo.create({ data: { ...values, id: randomUUID() } });
      const fixture = publicGameId(game), market = matchEntityId(fixture, "1x2");
      await tx.mercado.upsert({ where: { id: market }, update: {}, create: { id: market, jogo_id: game.id, nome: "Resultado no tempo regulamentar · 1X2" } });
      for (const outcome of OUTCOMES) {
        const selectionId = matchEntityId(fixture, outcome), value = new Prisma.Decimal(data.odds[outcome]);
        const old = await tx.selecao.findUnique({ where: { id: selectionId } });
        await tx.selecao.upsert({ where: { id: selectionId }, update: { odd_atual: value, odd_manual: true, atualizado_em: now }, create: { id: selectionId, mercado_id: market, descricao: OUTCOME_LABELS[outcome], odd_atual: value, odd_manual: true } });
        if (old && !old.odd_atual.equals(value)) await tx.historico_odds.create({ data: { id: randomUUID(), selecao_id: selectionId, admin_id: adminId, odd_anterior: old.odd_atual, odd_nova: value, motivo: "Edição do jogo" } });
      }
    } else if (previous) {
      if (action === "resultado" && previous.inicio_em > now) throw new BetError("O resultado só pode ser registrado após o início da partida", 409);
      game = await tx.jogo.update({ where: { id: previous.id }, data: { gerenciado: true, versao: { increment: 1 }, atualizado_em: now, ...(action === "remover" ? { removido_em: now } : action === "cancelar" ? { status: "CANCELADO", resultado: "Partida cancelada" } : { status: "ENCERRADO", resultado: `${b.mandante} × ${b.visitante}`, placar_mandante: b.mandante as number, placar_visitante: b.visitante as number }) } });
      await tx.mercado.updateMany({ where: { jogo_id: previous.id }, data: { status: "FECHADO" } });
      await tx.selecao.updateMany({ where: { id: { in: OUTCOMES.map(o => matchEntityId(publicGameId(previous), o)) } }, data: { status: "FECHADA" } });
    }
    await tx.auditoria_admin.create({ data: { id: randomUUID(), admin_id: adminId, entidade: "jogo", entidade_id: game!.id, acao: `JOGO_${String(action).toUpperCase()}`, dados_anteriores: previous ? JSON.parse(JSON.stringify(previous)) : Prisma.JsonNull, dados_novos: JSON.parse(JSON.stringify(game)) } });
    return { id: game!.id, fixtureId: publicGameId(game!), message: "Operação realizada com sucesso" };
  });
}
