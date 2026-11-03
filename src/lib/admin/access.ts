import "server-only";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { getCurrentUser, findSessionUser, SESSION_COOKIE } from "@/src/lib/auth/session";
import prisma from "@/src/lib/prisma";
import type { Prisma } from "@/src/generated/prisma/client";

export class AdminError extends Error {
  constructor(message: string, public readonly status = 400) { super(message); }
}

export async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.papel !== "ADMINISTRADOR") redirect("/");
  return user;
}

export async function adminRequestUser(request: NextRequest) {
  const user = await findSessionUser(request.cookies.get(SESSION_COOKIE)?.value);
  if (!user) throw new AdminError("Entre na sua conta para continuar", 401);
  if (user.papel !== "ADMINISTRADOR") throw new AdminError("Acesso restrito a administradores", 403);
  return user;
}

/** Revalida a permissão dentro da transação de escrita. */
export async function assertAdmin(id: string, tx: Prisma.TransactionClient = prisma) {
  const user = await tx.usuario.findFirst({ where: { id, papel: "ADMINISTRADOR", status: "ATIVO" }, select: { id: true } });
  if (!user) throw new AdminError("Acesso restrito a administradores ativos", 403);
}
