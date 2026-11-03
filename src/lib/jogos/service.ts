import "server-only";
import { localFeed } from "./local";

import { createHash } from "node:crypto";
import { unstable_cache } from "next/cache";
import type { Match, MatchFeed, MatchTeam } from "./types";
import { getMatchOdds, simulatedMatchOdds } from "./odds";
import { applyManagedOdds } from "./managed-odds";

const TIMEZONE = "America/Sao_Paulo";
const CACHE_SECONDS = 60 * 60 * 3;
const FINISHED_STATUSES = new Set(["FT", "AET", "PEN"]);
const dateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function score(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
}

function logo(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "media.api-sports.io" ? url.href : null;
  } catch {
    return null;
  }
}

export function normalizeMatch(value: unknown): Match | null {
  const item = record(value);
  const fixture = record(item.fixture);
  const status = text(record(fixture.status).short);
  const league = record(item.league);
  const country = text(league.country)?.toLowerCase();
  if (country !== "brazil" && country !== "brasil") return null;
  const teams = record(item.teams);
  const home = record(teams.home);
  const away = record(teams.away);
  const goals = record(item.goals);
  const penalties = record(record(item.score).penalty);
  const date = text(fixture.date);
  const timestamp = date ? Date.parse(date) : NaN;
  const homeName = text(home.name);
  const awayName = text(away.name);
  const leagueName = text(league.name);

  if (score(fixture.id) === null || !date || !Number.isFinite(timestamp) || !status || !homeName || !awayName || !leagueName) return null;

  function team(data: Record<string, unknown>, name: string, side: "home" | "away"): MatchTeam {
    return { name, logo: logo(data.logo), goals: score(goals[side]), penalties: score(penalties[side]), winner: data.winner === true };
  }

  return {
    id: fixture.id as number,
    date,
    timestamp,
    status,
    league: leagueName,
    country: "Brasil",
    round: text(league.round),
    venue: text(record(fixture.venue).name),
    home: team(home, homeName, "home"),
    away: team(away, awayName, "away"),
    odds: null,
  };
}

async function fetchMatches(date: string, apiKey: string): Promise<Match[]> {
  const url = new URL("https://v3.football.api-sports.io/fixtures");
  url.searchParams.set("date", date);
  url.searchParams.set("timezone", TIMEZONE);

  const response = await fetch(url, {
    headers: { "x-apisports-key": apiKey },
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error("O serviço de jogos está indisponível.");

  const body = record(await response.json());
  if (!body.errors || typeof body.errors !== "object" || Object.keys(body.errors).length > 0 || !Array.isArray(body.response)) {
    throw new Error("O serviço de jogos não retornou os dados esperados.");
  }

  return body.response.map(normalizeMatch).filter((match): match is Match => match !== null);
}

async function getProviderFeed(now = new Date()): Promise<MatchFeed> {
  const apiKey = process.env.API_FOOTBALL_KEY?.trim();
  if (!apiKey) return { upcoming: [], recent: [], availability: "unconfigured" };

  // A chave participa da identificação do cache somente por seu hash.
  const keyHash = createHash("sha256").update(apiKey).digest("hex");
  const cachedMatches = unstable_cache(
    (date: string) => fetchMatches(date, apiKey),
    ["api-football-jogos-brasil-v2", keyHash],
    { revalidate: CACHE_SECONDS },
  );
  const today = dateFormatter.format(now);
  const dates = [-3, -2, -1, 0, 1, 2, 3].map((offset) => {
    const day = new Date(`${today}T12:00:00-03:00`);
    day.setUTCDate(day.getUTCDate() + offset);
    return dateFormatter.format(day);
  });
  const responses = await Promise.allSettled(dates.map((date) => cachedMatches(date)));
  const successful = responses.filter((result) => result.status === "fulfilled");
  const matches = [...new Map(successful.flatMap((result) => result.value).map((match) => [match.id, match])).values()];
  const upcoming = matches.filter((match) => match.status === "NS" && match.timestamp > now.getTime()).sort((a, b) => a.timestamp - b.timestamp).slice(0, 12);
  // Limita a concorrência das consultas adicionais ao provedor.
  for (let start = 0; start < upcoming.length; start += 3) {
    const batch = upcoming.slice(start, start + 3);
    const odds = await Promise.allSettled(batch.map((match) => getMatchOdds(match.id, apiKey)));
    batch.forEach((match, index) => {
      const result = odds[index];
      match.odds = result.status === "fulfilled" ? result.value : simulatedMatchOdds(match.id);
    });
  }

  // Sem banco, não se oferece uma cotação que possa ignorar a definição administrativa.
  let managedUpcoming: Match[];
  let oddsUnavailable = false;
  try { managedUpcoming = await applyManagedOdds(upcoming); }
  catch { managedUpcoming = upcoming.map((match) => ({ ...match, odds: null })); oddsUnavailable = true; }
  return {
    upcoming: managedUpcoming,
    recent: matches.filter((match) => FINISHED_STATUSES.has(match.status) && match.timestamp <= now.getTime() && match.home.goals !== null && match.away.goals !== null).sort((a, b) => b.timestamp - a.timestamp),
    availability: successful.length === 0 ? "unavailable" : successful.length < dates.length || oddsUnavailable ? "partial" : "ready",
  };
}

export async function getMatchFeed(now = new Date()): Promise<MatchFeed> {
  const provider = await getProviderFeed(now);
  try {
    const local = await localFeed();
    const overrides = new Set([...local.removed, ...local.matches.map(m => m.id)]);
    const all = [...provider.upcoming, ...provider.recent].filter(m => !overrides.has(m.id)).concat(local.matches);
    const upcoming = all.filter(m => m.status === "NS" && m.timestamp > now.getTime()).sort((a, b) => a.timestamp - b.timestamp);
    const recent = all.filter(m => FINISHED_STATUSES.has(m.status) && m.timestamp <= now.getTime()).sort((a, b) => b.timestamp - a.timestamp);
    return { upcoming, recent, availability: local.matches.length && provider.availability === "unconfigured" ? "ready" : provider.availability };
  } catch { return { ...provider, upcoming: provider.upcoming.map(m => ({ ...m, odds: null })), availability: "unavailable" }; }
}
