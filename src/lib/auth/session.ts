import "server-only";

import { randomUUID } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import prisma from "@/src/lib/prisma";
import {
  generateSessionToken,
  hashSessionToken,
  isSessionToken,
} from "./crypto";

export const SESSION_COOKIE = "sistema_bets_sessao";
export const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7;
export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
} as const;

const publicUserSelect = {
  id: true,
  nome: true,
  email: true,
  papel: true,
} as const;

export async function createSession(
  userId: string,
  previousToken?: string,
  userAgent?: string | null,
) {
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_SECONDS * 1000);

  await prisma.$transaction(async (tx) => {
    await tx.sessao.create({
      data: {
        id: randomUUID(),
        usuario_id: userId,
        refresh_token_sha256: hashSessionToken(token),
        expira_em: expiresAt,
        user_agent: userAgent?.slice(0, 512),
      },
    });

    if (isSessionToken(previousToken)) {
      await tx.sessao.updateMany({
        where: {
          refresh_token_sha256: hashSessionToken(previousToken),
          revogada_em: null,
        },
        data: { revogada_em: new Date() },
      });
    }
  });

  return { token, expiresAt };
}

export async function findSessionUser(token?: string) {
  if (!isSessionToken(token)) return null;

  const session = await prisma.sessao.findUnique({
    where: { refresh_token_sha256: hashSessionToken(token) },
    select: { usuario_id: true, expira_em: true, revogada_em: true },
  });

  if (!session || session.revogada_em || session.expira_em <= new Date()) {
    return null;
  }

  return prisma.usuario.findFirst({
    where: { id: session.usuario_id, status: "ATIVO", excluido_em: null },
    select: publicUserSelect,
  });
}

export async function revokeSession(token?: string) {
  if (!isSessionToken(token)) return;

  await prisma.sessao.updateMany({
    where: {
      refresh_token_sha256: hashSessionToken(token),
      revogada_em: null,
    },
    data: { revogada_em: new Date() },
  });
}

export const getCurrentUser = cache(async () => {
  const cookieStore = await cookies();
  return findSessionUser(cookieStore.get(SESSION_COOKIE)?.value);
});

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
