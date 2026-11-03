import "server-only";
import prisma from "@/src/lib/prisma";
import type { jogo } from "@/src/generated/prisma/client";
import { matchEntityId } from "./identity";
import type { MatchDetails } from "./types";
import { OUTCOMES } from "@/lib/admin";

export const publicGameId = (game: Pick<jogo, "api_football_id" | "local_id">) => game.api_football_id ?? -game.local_id;
export const gameWhere = (id: number) => id < 0 ? { local_id: -id, api_football_id: null } : { api_football_id: id };
export async function gameToMatch(game: jogo): Promise<MatchDetails> {
  const id = publicGameId(game);
  const selections = await prisma.selecao.findMany({ where: { id: { in: OUTCOMES.map(o => matchEntityId(id, o)) } } });
  const values = OUTCOMES.map(o => selections.find(s => s.id === matchEntityId(id, o)));
  const open = game.status === "AGENDADO" && values.every(s => s && s.status === "ABERTA" && s.resultado === "PENDENTE");
  return {
    id, date: game.inicio_em.toISOString(), timestamp: game.inicio_em.getTime(), status: { AGENDADO: "NS", AO_VIVO: "LIVE", ENCERRADO: "FT", CANCELADO: "CANC" }[game.status],
    league: game.campeonato, country: "Brasil", round: null, venue: null,
    home: { name: game.mandante, logo: null, goals: game.placar_mandante, penalties: null, winner: (game.placar_mandante ?? 0) > (game.placar_visitante ?? 0) },
    away: { name: game.visitante, logo: null, goals: game.placar_visitante, penalties: null, winner: (game.placar_visitante ?? 0) > (game.placar_mandante ?? 0) },
    odds: open ? { home: Number(values[0]!.odd_atual), draw: Number(values[1]!.odd_atual), away: Number(values[2]!.odd_atual), source: "Cotação administrativa", updatedAt: game.atualizado_em.toISOString() } : null,
    referee: null, city: null, season: game.inicio_em.getFullYear(), elapsed: null, extra: null,
    scores: game.placar_mandante !== null && game.placar_visitante !== null ? [{ label: "Tempo regulamentar", home: game.placar_mandante, away: game.placar_visitante }] : [], events: [], statistics: [], lineups: [], players: [], fetchedAt: new Date().toISOString(),
  };
}
export async function storedMatch(id: number) {
  const game = await prisma.jogo.findFirst({ where: gameWhere(id) });
  if (game?.removido_em) return { removed: true as const, match: null };
  if (game && (game.gerenciado || id < 0)) return { removed: false as const, match: await gameToMatch(game) };
  return null;
}
export async function localFeed() {
  const rows = await prisma.jogo.findMany({ where: { gerenciado: true, removido_em: null }, orderBy: { inicio_em: "asc" } });
  const removed = await prisma.jogo.findMany({ where: { removido_em: { not: null }, api_football_id: { not: null } }, select: { api_football_id: true } });
  return { matches: await Promise.all(rows.map(gameToMatch)), removed: removed.map(g => g.api_football_id!) };
}
