import "server-only";
import { randomUUID } from "node:crypto";
import prisma from "@/src/lib/prisma";
import { transaction } from "@/src/lib/apostas/transaction";
import { BetError } from "@/src/lib/apostas/errors";
import { hashPassword, verifyPassword } from "@/src/lib/auth/crypto";
import { object } from "@/lib/admin";
import type { Prisma } from "@/src/generated/prisma/client";

export async function activeUser(tx: Prisma.TransactionClient, id: string) {
  const user = await tx.usuario.findFirst({ where: { id, status: "ATIVO", excluido_em: null } });
  if (!user) throw new BetError("Esta conta não está disponível para acesso", 403);
  return user;
}
export async function getAccount(id: string) {
  return prisma.usuario.findUniqueOrThrow({ where: { id }, select: { nome: true, email: true, atualizado_em: true } });
}
export async function manageAccount(id: string, input: unknown) {
  const b = object(input);
  if (typeof b.senhaAtual !== "string" || b.senhaAtual.length > 1024) throw new BetError("Informe sua senha atual", 400);
  if (!["dados", "senha", "excluir"].includes(String(b.acao))) throw new BetError("Selecione uma operação válida", 400);
  const current = await activeUser(prisma, id);
  if (!await verifyPassword(current.senha_hash, b.senhaAtual)) throw new BetError("Senha atual incorreta", 400);
  const nome = typeof b.nome === "string" ? b.nome.trim() : "";
  const email = typeof b.email === "string" ? b.email.trim().toLowerCase() : "";
  if (b.acao === "dados" && (!nome || nome.length > 120 || email.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) throw new BetError("Informe nome e e-mail válidos", 400);
  if (b.acao === "senha" && (typeof b.novaSenha !== "string" || b.novaSenha.length < 8 || b.novaSenha.length > 128 || b.novaSenha !== b.confirmacaoSenha)) throw new BetError("Confirme uma nova senha de 8 a 128 caracteres", 400);
  if (b.acao === "excluir" && b.confirmacao !== "EXCLUIR") throw new BetError("Digite EXCLUIR para confirmar", 400);
  const password = b.acao === "senha" ? await hashPassword(b.novaSenha as string) : b.acao === "excluir" ? await hashPassword(randomUUID()) : current.senha_hash;
  try {
    return await transaction(async tx => {
      const user = await activeUser(tx, id);
      if (user.senha_hash !== current.senha_hash || user.atualizado_em.toISOString() !== b.anterior) throw new BetError("Sua conta foi alterada. Atualize a página e tente novamente.", 409);
      const now = new Date();
      if (b.acao === "excluir") {
        if (user.papel === "ADMINISTRADOR") throw new BetError("Contas administrativas não podem ser excluídas por este fluxo", 403);
        const [bets, withdrawals, wallets] = await Promise.all([tx.aposta.count({ where: { usuario_id: id, status: "PENDENTE" } }), tx.saque.count({ where: { usuario_id: id, status: "PENDENTE" } }), tx.carteira.count({ where: { usuario_id: id, saldo_atual: { not: 0 } } })]);
        if (bets || withdrawals || wallets) throw new BetError("Conclua apostas e saques pendentes e zere seus créditos antes de excluir a conta", 409);
        await tx.usuario.update({ where: { id }, data: { nome: "Conta excluída", email: `${id}@excluida.invalid`, senha_hash: password, status: "BLOQUEADO", excluido_em: now, atualizado_em: now } });
        await tx.perfil_apostador.deleteMany({ where: { usuario_id: id } });
        await tx.token_recuperacao.deleteMany({ where: { usuario_id: id } });
      } else {
        await tx.usuario.update({ where: { id }, data: { ...(b.acao === "dados" ? { nome, email } : { senha_hash: password }), atualizado_em: now } });
      }
      const sair = b.acao !== "dados" || email !== user.email;
      if (sair) await tx.sessao.updateMany({ where: { usuario_id: id, revogada_em: null }, data: { revogada_em: now } });
      return { sair, message: "Operação realizada com sucesso" };
    });
  } catch (error) {
    if (object(error).code === "P2002") throw new BetError("Já existe uma conta cadastrada com este e-mail", 409);
    throw error;
  }
}
