import "server-only";
import { randomUUID } from "node:crypto";
import prisma from "@/src/lib/prisma";
import { Prisma } from "@/src/generated/prisma/client";
import { transaction } from "@/src/lib/apostas/transaction";
import { BetError } from "@/src/lib/apostas/errors";
import { activeUser } from "@/src/lib/conta/service";
import { assertAdmin } from "@/src/lib/admin/access";
import { getOrCreateWallet, changeBalance } from "@/src/lib/saldo/service";
import { parseAmount, UUID_PATTERN } from "@/lib/apostas";
import { object } from "@/lib/admin";
import { WITHDRAW_METHOD, type WithdrawalView } from "@/lib/gestao";

export async function requestWithdrawal(userId: string, input: unknown) {
  const b = object(input), value = parseAmount(b.valor);
  if (!value || b.metodo !== WITHDRAW_METHOD || typeof b.idempotencyKey !== "string" || !UUID_PATTERN.test(b.idempotencyKey)) throw new BetError("Informe um valor de 0,01 a 10.000 créditos e o método simulado", 400);
  const key = b.idempotencyKey, amount = new Prisma.Decimal(value);
  return transaction(async tx => {
    await activeUser(tx, userId);
    const previous = await tx.saque.findUnique({ where: { idempotency_key: key } });
    const wallet = await getOrCreateWallet(tx, userId);
    if (previous) {
      if (previous.usuario_id !== userId || !previous.valor.equals(amount)) throw new BetError("Esta solicitação já foi utilizada com outros dados", 409);
      return { id: previous.id, saldo: wallet.saldo_atual.toFixed(2) };
    }
    if (wallet.saldo_atual.lessThan(amount)) throw new BetError("Saldo insuficiente para realizar o saque", 409);
    const saldo = await changeBalance(tx, wallet, amount.negated());
    const row = await tx.saque.create({ data: { id: randomUUID(), usuario_id: userId, carteira_id: wallet.id, valor: amount, metodo: WITHDRAW_METHOD, idempotency_key: key } });
    await tx.movimentacao.create({ data: { id: randomUUID(), carteira_id: wallet.id, tipo: "SAQUE_SIMULADO", valor_assinado: amount.negated(), saldo_apos: saldo, motivo: `Reserva do saque simulado ${row.id}`, idempotency_key: key } });
    return { id: row.id, saldo: saldo.toFixed(2) };
  });
}
export async function decideWithdrawal(adminId: string, id: string, input: unknown) {
  const b = object(input);
  if (!UUID_PATTERN.test(id) || (b.decisao !== "APROVADO" && b.decisao !== "RECUSADO")) throw new BetError("Selecione uma solicitação e uma decisão válidas", 400);
  const decisao = b.decisao, motivo = typeof b.motivo === "string" ? b.motivo.trim() : "";
  if (motivo.length > 500 || (decisao === "RECUSADO" && !motivo)) throw new BetError("Informe o motivo da recusa, com até 500 caracteres", 400);
  return transaction(async tx => {
    await assertAdmin(adminId, tx);
    const row = await tx.saque.findUnique({ where: { id } });
    if (!row) throw new BetError("Solicitação não encontrada", 404);
    if (row.status !== "PENDENTE") {
      if (row.status === decisao) return { message: "Esta decisão já foi registrada" };
      throw new BetError("Esta solicitação não está mais disponível para aprovação", 409);
    }
    if (decisao === "APROVADO") await activeUser(tx, row.usuario_id);
    await tx.saque.update({ where: { id }, data: { status: decisao, admin_id: adminId, motivo: motivo || null, decidido_em: new Date() } });
    if (decisao === "RECUSADO") {
      const wallet = await tx.carteira.findUniqueOrThrow({ where: { id: row.carteira_id } });
      const saldo = await changeBalance(tx, wallet, row.valor);
      await tx.movimentacao.create({ data: { id: randomUUID(), carteira_id: wallet.id, admin_id: adminId, tipo: "ESTORNO_SAQUE", valor_assinado: row.valor, saldo_apos: saldo, motivo: `Recusa do saque ${id}: ${motivo}`.slice(0, 500), idempotency_key: id } });
    }
    await tx.auditoria_admin.create({ data: { id: randomUUID(), admin_id: adminId, entidade: "saque", entidade_id: id, acao: decisao === "APROVADO" ? "APROVAR_SAQUE_SIMULADO" : "RECUSAR_SAQUE_SIMULADO", dados_anteriores: { status: "PENDENTE" }, dados_novos: { status: decisao }, motivo: motivo || null } });
    return { message: decisao === "APROVADO" ? "Saque aprovado e concluído na simulação" : "Saque recusado. Créditos devolvidos." };
  });
}
export async function listWithdrawals(userId: string, admin: boolean, requestedPage: number, pageSize: number) {
  if (admin) await assertAdmin(userId);
  return prisma.$transaction(async tx => {
    const where = admin ? { status: "PENDENTE" as const } : { usuario_id: userId };
    const total = await tx.saque.count({ where });
    const totalPages = Math.max(1, Math.ceil(total / pageSize)), page = Math.min(requestedPage, totalPages);
    const rows = await tx.saque.findMany({ where, orderBy: [{ criado_em: "desc" }, { id: "desc" }], skip: (page - 1) * pageSize, take: pageSize });
    const users = await tx.usuario.findMany({ where: { id: { in: rows.map(r => r.usuario_id) } }, select: { id: true, nome: true, email: true } });
    const items: WithdrawalView[] = rows.map(r => ({ id: r.id, usuario: users.find(u => u.id === r.usuario_id)?.nome ?? "Conta", email: users.find(u => u.id === r.usuario_id)?.email ?? "", valor: r.valor.toFixed(2), metodo: r.metodo, status: r.status, motivo: r.motivo, criadoEm: r.criado_em.toISOString(), decididoEm: r.decidido_em?.toISOString() ?? null }));
    return { items, pagination: { page, pageSize, total, totalPages } };
  }, { isolationLevel: "RepeatableRead" });
}
