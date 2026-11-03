import "server-only";
import prisma from "@/src/lib/prisma";
import { OUTCOMES } from "@/lib/admin";
import { matchEntityId } from "./identity";
import type { Match } from "./types";

/** Cotações administrativas são lidas fora do cache do provedor. */
export async function applyManagedOdds<T extends Match>(matches: T[]): Promise<T[]> {
  const available = matches.filter((match) => match.status === "NS" && match.odds);
  if (!available.length) return matches;
  const selections = await prisma.selecao.findMany({
    where: { id: { in: available.flatMap((match) => OUTCOMES.map((outcome) => matchEntityId(match.id, outcome))) }, odd_manual: true },
    select: { id: true, odd_atual: true, atualizado_em: true, status: true, resultado: true },
  });
  const byId = new Map(selections.map((selection) => [selection.id, selection]));
  return matches.map((match) => {
    if (match.status !== "NS" || !match.odds) return match;
    const odds = { ...match.odds };
    let updated = 0;
    for (const outcome of OUTCOMES) {
      const selection = byId.get(matchEntityId(match.id, outcome));
      if (!selection) continue;
      if (selection.status !== "ABERTA" || selection.resultado !== "PENDENTE") return { ...match, odds: null };
      odds[outcome] = Number(selection.odd_atual);
      updated = Math.max(updated, selection.atualizado_em.getTime());
    }
    return updated ? { ...match, odds: { ...odds, source: "Cotação administrativa", updatedAt: new Date(updated).toISOString() } } : match;
  });
}
