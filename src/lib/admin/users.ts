import "server-only";
import { randomUUID } from "node:crypto";
import prisma from "@/src/lib/prisma";
import { transaction } from "@/src/lib/apostas/transaction";
import { UUID_PATTERN } from "@/lib/apostas";
import { object, type AdminUser } from "@/lib/admin";
import { AdminError, assertAdmin } from "./access";

const select = { id: true, nome: true, email: true, papel: true, status: true, atualizado_em: true } as const;
function serialize(user: Omit<AdminUser, "atualizadoEm"> & { atualizado_em: Date }): AdminUser {
  return { id: user.id, nome: user.nome, email: user.email, papel: user.papel, status: user.status, atualizadoEm: user.atualizado_em.toISOString() };
}

export async function listUsers(adminId: string, search: string, requestedPage: number, pageSize: number) {
  await assertAdmin(adminId);
  const query = search.trim().slice(0, 255);
  const where = { excluido_em: null, ...(query ? { OR: [{ nome: { contains: query } }, { email: { contains: query } }] } : {}) };
  return prisma.$transaction(async (tx) => {
    const total = await tx.usuario.count({ where });
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const page = Math.min(Math.max(1, requestedPage), totalPages);
    const users = await tx.usuario.findMany({ where, select, orderBy: [{ nome: "asc" }, { id: "asc" }], skip: (page - 1) * pageSize, take: pageSize });
    return { users: users.map(serialize), pagination: { page, pageSize, total, totalPages } };
  }, { isolationLevel: "RepeatableRead" });
}

export async function updateUser(adminId: string, id: string, input: unknown) {
  const body = object(input);
  const nome = typeof body.nome === "string" ? body.nome.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const status = body.status;
  const expected = object(body.anterior);
  if (!UUID_PATTERN.test(id)) throw new AdminError("Usuário não encontrado", 404);
  if (!nome || nome.length > 120 || email.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) throw new AdminError("Informe nome e e-mail válidos");
  if (status !== "ATIVO" && status !== "BLOQUEADO" && status !== "SUSPENSO") throw new AdminError("Informe uma situação válida para a conta");
  try {
    return await transaction(async (tx) => {
      await assertAdmin(adminId, tx);
      const user = await tx.usuario.findUnique({ where: { id, excluido_em: null }, select });
      if (!user) throw new AdminError("Usuário não encontrado", 404);
      if (id === adminId || user.papel === "ADMINISTRADOR") throw new AdminError("A operação selecionada não pode ser concluída para este usuário", 403);
      if (expected.nome !== user.nome || expected.email !== user.email || expected.status !== user.status || expected.atualizadoEm !== user.atualizado_em.toISOString()) throw new AdminError("Esta conta foi alterada. Atualize a página antes de continuar.", 409);
      // SUSPENSO pode ser preservado em uma edição, mas o painel só oferece bloquear/desbloquear.
      if (status === "SUSPENSO" && user.status !== "SUSPENSO") throw new AdminError("Selecione bloquear ou desbloquear a conta");
      const conflict = await tx.usuario.findUnique({ where: { email }, select: { id: true } });
      if (conflict && conflict.id !== id) throw new AdminError("Já existe uma conta cadastrada com este e-mail", 409);
      if (nome === user.nome && email === user.email && status === user.status) return serialize(user);
      const updated = await tx.usuario.update({ where: { id }, data: { nome, email, status, atualizado_em: new Date() }, select });
      if (status !== "ATIVO" || email !== user.email) {
        await tx.sessao.updateMany({ where: { usuario_id: id, revogada_em: null }, data: { revogada_em: new Date() } });
      }
      await tx.auditoria_admin.create({ data: {
        id: randomUUID(), admin_id: adminId, acao: "ATUALIZAR_USUARIO", entidade: "usuario", entidade_id: id,
        dados_anteriores: { nome: user.nome, email: user.email, status: user.status }, dados_novos: { nome, email, status },
      } });
      return serialize(updated);
    });
  } catch (error) {
    if (error !== null && typeof error === "object" && "code" in error && error.code === "P2002") throw new AdminError("Já existe uma conta cadastrada com este e-mail", 409);
    throw error;
  }
}
