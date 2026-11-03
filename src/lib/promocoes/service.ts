import "server-only";
import { randomUUID } from "node:crypto";
import prisma from "@/src/lib/prisma";
import { Prisma, type promocao } from "@/src/generated/prisma/client";
import { transaction } from "@/src/lib/apostas/transaction";
import { BetError } from "@/src/lib/apostas/errors";
import { assertAdmin } from "@/src/lib/admin/access";
import { object } from "@/lib/admin";
import { promotionInput, type PromotionView } from "@/lib/gestao";

function serialize(p: promocao): PromotionView {
  const r = object(p.regras);
  return { id: p.id, nome: p.nome, codigo: p.codigo, descricao: String(r.descricao ?? ""), tipo: p.tipo, beneficio: p.valor_bonus.toFixed(2), minimo: String(r.minimo ?? "0.01"), jogoId: typeof r.jogoId === "number" ? r.jogoId : null, inicio: p.inicio_em.toISOString(), fim: p.fim_em.toISOString(), limite: p.limite_usos, porUsuario: p.limite_por_usuario, status: p.status, versao: p.versao };
}
export async function listPromotions(adminId: string, requestedPage: number, pageSize: number) {
  await assertAdmin(adminId);
  return prisma.$transaction(async tx => {
    const where = { removida_em: null };
    const total = await tx.promocao.count({ where });
    const totalPages = Math.max(1, Math.ceil(total / pageSize)), page = Math.min(requestedPage, totalPages);
    const rows = await tx.promocao.findMany({ where, orderBy: [{ criada_em: "desc" }, { id: "desc" }], skip: (page - 1) * pageSize, take: pageSize });
    return { items: rows.map(serialize), pagination: { page, pageSize, total, totalPages } };
  }, { isolationLevel: "RepeatableRead" });
}
export async function savePromotion(adminId: string, id: string | null, input: unknown) {
  const savedId = id ?? randomUUID();
  const b = object(input), remove = b.acao === "remover";
  const data = remove ? null : promotionInput(input);
  if (!remove && !data) throw new BetError("Verifique os campos, a validade e a condição de aposta mínima da promoção", 400);
  try {
    return await transaction(async tx => {
      await assertAdmin(adminId, tx);
      const previous = id ? await tx.promocao.findUnique({ where: { id } }) : null;
      if (id && (!previous || previous.removida_em)) throw new BetError("Promoção não encontrada", 404);
      if (previous && previous.versao !== b.versao) throw new BetError("A promoção foi alterada. Atualize a página.", 409);
      if (remove) {
        if (!previous) throw new BetError("Selecione uma promoção", 400);
        await tx.promocao.update({ where: { id: previous.id }, data: { removida_em: new Date(), status: "ENCERRADA", versao: { increment: 1 } } });
      } else if (data) {
        const values = { nome: data.nome, codigo: data.codigo, tipo: data.tipo, regras: { descricao: data.descricao, minimo: data.minimo, jogoId: data.jogoId }, valor_bonus: new Prisma.Decimal(data.beneficio), limite_usos: data.limite, limite_por_usuario: data.porUsuario, inicio_em: data.inicio, fim_em: data.fim, status: data.status };
        if (previous) await tx.promocao.update({ where: { id: previous.id }, data: { ...values, versao: { increment: 1 } } });
        else await tx.promocao.create({ data: { ...values, id: savedId, criado_por_id: adminId } });
      }
      await tx.auditoria_admin.create({ data: { id: randomUUID(), admin_id: adminId, entidade: "promocao", entidade_id: savedId, acao: remove ? "REMOVER_PROMOCAO" : previous ? "EDITAR_PROMOCAO" : "CRIAR_PROMOCAO", dados_anteriores: previous ? serialize(previous) : Prisma.JsonNull, dados_novos: remove ? { removida: true } : JSON.parse(JSON.stringify(data)) } });
      return { id: savedId, message: "Operação realizada com sucesso" };
    });
  } catch (error) {
    if (object(error).code === "P2002") throw new BetError("Já existe uma promoção com esse código", 409);
    throw error;
  }
}
export async function availablePromotions(userId: string, jogoId: number) {
  const now = new Date();
  const rows = await prisma.promocao.findMany({ where: { status: "ATIVA", removida_em: null, inicio_em: { lte: now }, fim_em: { gt: now } }, orderBy: { nome: "asc" }, take: 100 });
  const available: PromotionView[] = [];
  for (const row of rows) {
    const view = serialize(row);
    if (view.jogoId !== null && view.jogoId !== jogoId) continue;
    const [total, personal] = await Promise.all([prisma.uso_promocao.count({ where: { promocao_id: row.id } }), prisma.uso_promocao.count({ where: { promocao_id: row.id, usuario_id: userId } })]);
    if ((row.limite_usos === null || total < row.limite_usos) && personal < row.limite_por_usuario) available.push(view);
  }
  return available;
}
/** Esta validação e o registro de uso pertencem à mesma transação da aposta. */
export async function promotionForBet(tx: Prisma.TransactionClient, userId: string, gameId: number, amount: Prisma.Decimal, odd: Prisma.Decimal, id?: string | null, version?: number) {
  if (!id) return { odd, bonus: new Prisma.Decimal(0), promotion: null };
  const row = await tx.promocao.findUnique({ where: { id } });
  const now = new Date();
  if (!row || row.removida_em || row.status !== "ATIVA" || row.inicio_em > now || row.fim_em <= now) throw new BetError("Esta promoção não está mais disponível", 409);
  if (row.versao !== version) throw new BetError("A promoção foi alterada. Atualize a página e revise o benefício.", 409);
  const view = serialize(row);
  if ((view.jogoId !== null && view.jogoId !== gameId) || amount.lessThan(view.minimo)) throw new BetError("Esta promoção não pode ser aplicada à aposta selecionada", 409);
  const total = await tx.uso_promocao.count({ where: { promocao_id: id } });
  const personal = await tx.uso_promocao.count({ where: { promocao_id: id, usuario_id: userId } });
  if ((row.limite_usos !== null && total >= row.limite_usos) || personal >= row.limite_por_usuario) throw new BetError("O limite de utilização desta promoção foi atingido", 409);
  const boosted = row.tipo === "ODDS_BOOST" ? odd.minus(1).mul(row.valor_bonus.div(100).add(1)).add(1).toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP) : odd;
  if (boosted.greaterThanOrEqualTo(100000000)) throw new BetError("O benefício excede a cotação máxima permitida", 400);
  return { odd: boosted, bonus: row.tipo === "BONUS_CREDITO" ? row.valor_bonus : new Prisma.Decimal(0), promotion: view };
}
