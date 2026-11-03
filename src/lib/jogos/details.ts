import "server-only";
import { storedMatch } from "./local";
import { validMatchId } from "@/lib/gestao";

import { createHash } from "node:crypto";
import { unstable_cache } from "next/cache";
import { normalizeMatch } from "./service";
import { getMatchOdds } from "./odds";
import { applyManagedOdds } from "./managed-odds";
import type { MatchDetails, MatchDetailsResult, MatchPlayer, MatchSide } from "./types";

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function list(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.map(record) : [];
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function number(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
}

function statistic(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return typeof value === "string" && /^-?\d+(\.\d+)?%?$/.test(value.trim()) ? value.trim() : null;
}

function translateRound(value: string | null): string | null {
  const labels: Record<string, string> = {
    "Regular Season": "Temporada regular", "Group Stage": "Fase de grupos", Group: "Grupo",
    "Quarter-finals": "Quartas de final", "Semi-finals": "Semifinais", "Round of 16": "Oitavas de final",
    Final: "Final", Finals: "Finais", Round: "Rodada",
  };
  return value?.replace(/Regular Season|Group Stage|Quarter-finals|Semi-finals|Round of 16|Finals?\b|\bGroup\b|\bRound\b/g, (label) => labels[label]) ?? null;
}

const statisticLabels: Record<string, string> = {
  "Ball Possession": "Posse de bola", "Total Shots": "Finalizações", "Shots on Goal": "Finalizações no gol",
  "Shots off Goal": "Finalizações para fora", "Blocked Shots": "Finalizações bloqueadas",
  "Shots insidebox": "Finalizações na área", "Shots outsidebox": "Finalizações de fora da área",
  "Corner Kicks": "Escanteios", Offsides: "Impedimentos", Fouls: "Faltas",
  "Yellow Cards": "Cartões amarelos", "Red Cards": "Cartões vermelhos", "Goalkeeper Saves": "Defesas do goleiro",
  "Total passes": "Passes", "Passes accurate": "Passes certos", "Passes %": "Precisão dos passes",
  expected_goals: "Gols esperados (xG)", goals_prevented: "Gols evitados",
};

function eventDescription(event: Record<string, unknown>): { type: MatchDetails["events"][number]["type"]; label: string } | null {
  const detail = text(event.detail)?.toLowerCase();
  switch (text(event.type)?.toLowerCase()) {
    case "goal": return { type: "goal", label: detail === "own goal" ? "Gol contra" : detail === "penalty" ? "Gol de pênalti" : detail === "missed penalty" ? "Pênalti perdido" : "Gol" };
    case "card": return { type: "card", label: detail === "red card" ? "Cartão vermelho" : detail === "second yellow card" ? "Segundo cartão amarelo" : "Cartão amarelo" };
    case "subst": return { type: "substitution", label: "Substituição" };
    case "var": return { type: "var", label: detail === "goal cancelled" ? "Gol anulado pelo VAR" : detail === "penalty confirmed" ? "Pênalti confirmado pelo VAR" : "Revisão do VAR" };
    default: return null;
  }
}

function players(value: unknown): MatchPlayer[] {
  return list(value).flatMap((entry) => {
    const player = record(entry.player);
    const name = text(player.name);
    return name ? [{ name, number: number(player.number), position: ({ G: "Goleiro", D: "Defensor", M: "Meio-campista", F: "Atacante" } as Record<string, string>)[String(player.pos)] ?? null }] : [];
  });
}

function normalizeDetails(item: Record<string, unknown>): MatchDetails | null {
  const match = normalizeMatch(item);
  if (!match) return null;
  const fixture = record(item.fixture);
  const teams = record(item.teams);
  const homeId = number(record(teams.home).id);
  const awayId = number(record(teams.away).id);
  function side(value: unknown): MatchSide | null {
    const id = number(record(value).id);
    return id !== null && id === homeId ? "home" : id !== null && id === awayId ? "away" : null;
  }
  const statistics = list(item.statistics);
  const homeStats = list(statistics.find((entry) => side(entry.team) === "home")?.statistics);
  const awayStats = list(statistics.find((entry) => side(entry.team) === "away")?.statistics);

  return {
    ...match,
    round: translateRound(match.round),
    referee: text(fixture.referee), city: text(record(fixture.venue).city),
    season: number(record(item.league).season),
    elapsed: number(record(fixture.status).elapsed), extra: number(record(fixture.status).extra),
    scores: ([["halftime", "Intervalo"], ["fulltime", "Tempo regulamentar"], ["extratime", "Prorrogação"], ["penalty", "Pênaltis"]] as const).flatMap(([key, label]) => {
      const score = record(record(item.score)[key]);
      const home = number(score.home), away = number(score.away);
      return home !== null || away !== null ? [{ label, home, away }] : [];
    }),
    events: list(item.events).flatMap((event) => {
      const teamSide = side(event.team), description = eventDescription(event);
      if (!teamSide || !description) return [];
      return [{ side: teamSide, ...description, minute: number(record(event.time).elapsed), extra: number(record(event.time).extra), player: text(record(event.player).name), relatedPlayer: text(record(event.assist).name) }];
    }).sort((a, b) => (a.minute ?? 0) - (b.minute ?? 0) || (a.extra ?? 0) - (b.extra ?? 0)),
    statistics: Object.entries(statisticLabels).flatMap(([key, label]) => {
      const home = statistic(homeStats.find((entry) => entry.type === key)?.value);
      const away = statistic(awayStats.find((entry) => entry.type === key)?.value);
      return home !== null || away !== null ? [{ label, home, away }] : [];
    }),
    lineups: list(item.lineups).flatMap((lineup) => {
      const teamSide = side(lineup.team);
      return teamSide ? [{ side: teamSide, formation: text(lineup.formation), coach: text(record(lineup.coach).name), starters: players(lineup.startXI), substitutes: players(lineup.substitutes) }] : [];
    }),
    players: list(item.players).flatMap((team) => {
      const teamSide = side(team.team);
      if (!teamSide) return [];
      return list(team.players).flatMap((entry) => {
        const name = text(record(entry.player).name);
        const stats = list(entry.statistics)[0] ?? {};
        const games = record(stats.games), goals = record(stats.goals);
        return name ? [{ side: teamSide, name, minutes: number(games.minutes), rating: statistic(games.rating), goals: number(goals.total), assists: number(goals.assists), saves: number(goals.saves) }] : [];
      });
    }),
    fetchedAt: new Date().toISOString(),
  };
}

async function fetchDetails(id: number, apiKey: string): Promise<MatchDetails | null> {
  // A consulta por ID inclui eventos, estatísticas, escalações e desempenho dos jogadores.
  const url = new URL("https://v3.football.api-sports.io/fixtures");
  url.searchParams.set("id", String(id));
  url.searchParams.set("timezone", "America/Sao_Paulo");
  const response = await fetch(url, { headers: { "x-apisports-key": apiKey }, cache: "no-store", signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error("Não foi possível consultar os detalhes da partida.");
  const body = record(await response.json());
  if (!body.errors || typeof body.errors !== "object" || Object.keys(body.errors).length || !Array.isArray(body.response)) {
    throw new Error("O serviço não retornou os detalhes esperados.");
  }
  if (body.response.length === 0) return null;
  const item = record(body.response.find((value) => record(record(value).fixture).id === id));
  if (record(item.fixture).id !== id) throw new Error("O serviço retornou uma partida diferente da solicitada.");
  const country = text(record(item.league).country)?.toLowerCase();
  if (country !== "brazil" && country !== "brasil") return null;
  const match = normalizeDetails(item);
  if (!match) throw new Error("Os dados da partida estão incompletos.");
  return match;
}

export async function getMatchDetails(id: number): Promise<MatchDetailsResult> {
  if (!validMatchId(id)) return { availability: "not-found", match: null };
  try {
    const local = await storedMatch(id);
    if (local?.removed || (id < 0 && !local)) return { availability: "not-found", match: null };
    if (local?.match) return { availability: "ready", match: local.match };
  } catch { return { availability: "unavailable", match: null }; }
  const apiKey = process.env.API_FOOTBALL_KEY?.trim();
  if (!apiKey) return { availability: "unconfigured", match: null };
  const keyHash = createHash("sha256").update(apiKey).digest("hex");
  try {
    const match = await unstable_cache((fixtureId: number) => fetchDetails(fixtureId, apiKey), ["api-football-detalhes-v2", keyHash], { revalidate: 60 * 60 * 3 })(id);
    if (!match) return { availability: "not-found", match: null };
    const quoted = { ...match, odds: match.status === "NS" ? await getMatchOdds(id, apiKey) : null };
    const [managed] = await applyManagedOdds([quoted]);
    return { availability: "ready", match: managed };
  } catch {
    return { availability: "unavailable", match: null };
  }
}
