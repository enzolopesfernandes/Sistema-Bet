import "server-only";
import { activeUser } from "@/src/lib/conta/service";

import { randomUUID } from "node:crypto";
import { Prisma } from "@/src/generated/prisma/client";
import prisma from "@/src/lib/prisma";
import { BET_MESSAGES, DEMO_METHOD, validateRecharge } from "@/lib/apostas";
import { BetError } from "@/src/lib/apostas/errors";
import { ConcurrentUpdate, transaction } from "@/src/lib/apostas/transaction";

export async function getBalance(userId: string) {
  const wallet = await prisma.carteira.findUnique({ where: { usuario_id_tipo: { usuario_id: userId, tipo: "NORMAL" } } });
  return wallet?.saldo_atual.toFixed(2) ?? "0.00";
}

export async function getOrCreateWallet(tx: Prisma.TransactionClient, userId: string) {
  return tx.carteira.upsert({
    where: { usuario_id_tipo: { usuario_id: userId, tipo: "NORMAL" } },
    create: { id: randomUUID(), usuario_id: userId, tipo: "NORMAL" }, update: {},
  });
}

export async function changeBalance(tx: Prisma.TransactionClient, wallet: { id: string; versao: number; saldo_atual: Prisma.Decimal }, amount: Prisma.Decimal) {
  if (amount.isNegative() && wallet.saldo_atual.lessThan(amount.abs())) throw new BetError(BET_MESSAGES.insufficient);
  const updated = await tx.carteira.updateMany({
    where: { id: wallet.id, versao: wallet.versao, ...(amount.isNegative() ? { saldo_atual: { gte: amount.abs() } } : {}) },
    data: { saldo_atual: { increment: amount }, versao: { increment: 1 }, atualizada_em: new Date() },
  });
  if (updated.count !== 1) throw new ConcurrentUpdate();
  return wallet.saldo_atual.add(amount);
}

export async function rechargeBalance(userId: string, input: { valor: string; metodo: string; idempotencyKey: string }) {
  const validation = validateRecharge(input);
  if (!validation.data) throw new BetError(validation.message, 400);
  const amount = new Prisma.Decimal(validation.data.valor);
  return transaction(async (tx) => {
    await activeUser(tx, userId);
    const wallet = await getOrCreateWallet(tx, userId);
    const previous = await tx.movimentacao.findUnique({ where: { idempotency_key: input.idempotencyKey } });
    if (previous) {
      if (previous.carteira_id !== wallet.id || previous.tipo !== "RECARGA_SIMULADA" || !previous.valor_assinado.equals(amount)) throw new BetError("Esta solicitação já foi utilizada com outros dados");
      return { saldo: wallet.saldo_atual.toFixed(2) };
    }
    const balance = await changeBalance(tx, wallet, amount);
    await tx.movimentacao.create({ data: {
      id: randomUUID(), carteira_id: wallet.id, tipo: "RECARGA_SIMULADA", valor_assinado: amount,
      saldo_apos: balance, motivo: `Recarga de créditos fictícios · ${DEMO_METHOD}`, idempotency_key: input.idempotencyKey,
    } });
    return { saldo: balance.toFixed(2) };
  });
}
