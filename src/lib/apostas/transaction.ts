import "server-only";

import { randomInt } from "node:crypto";
import { setTimeout as waitForRetry } from "node:timers/promises";
import type { Prisma } from "@/src/generated/prisma/client";
import prisma from "@/src/lib/prisma";

export class ConcurrentUpdate extends Error {}

/** Repete a transação inteira em conflitos, sempre desfazendo as escritas anteriores. */
export async function transaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(work, { isolationLevel: "Serializable", maxWait: 5000, timeout: 10000 });
    } catch (error) {
      // O singleton pode usar outra instância da classe do Prisma após hot reload.
      const prismaConflict = error !== null && typeof error === "object" && "name" in error && error.name === "PrismaClientKnownRequestError" && "code" in error && ["P2034", "P2002"].includes(String(error.code));
      const retryable = error instanceof ConcurrentUpdate || prismaConflict;
      if (!retryable || attempt >= 3) throw error;
      await waitForRetry(20 * 2 ** attempt + randomInt(20));
    }
  }
}
