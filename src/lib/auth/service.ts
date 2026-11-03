import "server-only";

import { randomUUID } from "node:crypto";
import {
  AUTH_MESSAGES,
  type LoginInput,
  type RegistrationInput,
} from "@/lib/auth-validation";
import { Prisma } from "@/src/generated/prisma/client";
import prisma from "@/src/lib/prisma";
import { hashPassword, verifyPassword } from "./crypto";
import { AuthError } from "./errors";
import { createSession } from "./session";

export async function registerUser(input: RegistrationInput) {
  const existingUser = await prisma.usuario.findUnique({
    where: { email: input.email },
    select: { id: true },
  });

  if (existingUser) {
    throw new AuthError("EMAIL_EM_USO", AUTH_MESSAGES.emailTaken);
  }

  const passwordHash = await hashPassword(input.senha);

  try {
    await prisma.usuario.create({
      data: {
        id: randomUUID(),
        nome: input.nome,
        email: input.email,
        senha_hash: passwordHash,
      },
      select: { id: true },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new AuthError("EMAIL_EM_USO", AUTH_MESSAGES.emailTaken);
    }
    throw error;
  }
}

export async function loginUser(
  input: LoginInput,
  previousToken?: string,
  userAgent?: string | null,
) {
  const user = await prisma.usuario.findUnique({
    where: { email: input.email },
    select: { id: true, senha_hash: true, status: true },
  });

  if (!user) {
    throw new AuthError("CONTA_NAO_ENCONTRADA", AUTH_MESSAGES.accountNotFound);
  }
  if (!(await verifyPassword(user.senha_hash, input.senha))) {
    throw new AuthError("SENHA_INCORRETA", AUTH_MESSAGES.wrongPassword);
  }
  if (user.status !== "ATIVO") {
    throw new AuthError(
      "CONTA_INDISPONIVEL",
      "Esta conta não está disponível para acesso",
    );
  }

  return createSession(user.id, previousToken, userAgent);
}
