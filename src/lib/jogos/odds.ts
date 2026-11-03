import "server-only";

import { createHash } from "node:crypto";
import { unstable_cache } from "next/cache";
import type { MatchOdds } from "./types";

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function decimal(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const number = Number(value);
  return Number.isFinite(number) && number > 1 ? number : null;
}

async function fetchOdds(fixtureId: number, apiKey: string): Promise<MatchOdds | null> {
  try {
    const url = new URL("https://v3.football.api-sports.io/odds");
    url.searchParams.set("fixture", String(fixtureId));
    url.searchParams.set("bet", "1");
    const response = await fetch(url, {
      headers: { "x-apisports-key": apiKey },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return null;
    const body = record(await response.json());
    if (!body.errors || typeof body.errors !== "object" || Object.keys(body.errors).length || !Array.isArray(body.response)) return null;

    for (const value of body.response) {
      const item = record(value);
      if (record(item.fixture).id !== fixtureId || !Array.isArray(item.bookmakers)) continue;
      for (const entry of item.bookmakers) {
        const bookmaker = record(entry);
        if (typeof bookmaker.name !== "string" || !bookmaker.name.trim() || !Array.isArray(bookmaker.bets)) continue;
        for (const betValue of bookmaker.bets) {
          const bet = record(betValue);
          if (bet.id !== 1 || !Array.isArray(bet.values)) continue;
          const values = bet.values.map(record);
          const home = decimal(values.find((odd) => odd.value === "Home")?.odd);
          const draw = decimal(values.find((odd) => odd.value === "Draw")?.odd);
          const away = decimal(values.find((odd) => odd.value === "Away")?.odd);
          if (home === null || draw === null || away === null) continue;
          const updatedAt = typeof item.update === "string" && Number.isFinite(Date.parse(item.update)) ? item.update : null;
          return { home, draw, away, source: bookmaker.name.trim(), updatedAt };
        }
      }
    }
  } catch {
    // A indisponibilidade das cotações não impede a exibição da partida.
  }
  return null;
}

const MIN_ODD = 1.2;
const MAX_ODD = 2;

function simulatedOdd(fixtureId: number, outcome: "home" | "draw" | "away"): number {
  const unit = createHash("sha256").update(`odds-simuladas:${fixtureId}:${outcome}`).digest().readUInt32BE(0) / 0xffffffff;
  const value = Math.round((MIN_ODD + unit * (MAX_ODD - MIN_ODD)) * 100) / 100;
  return Math.min(MAX_ODD, Math.max(MIN_ODD, value));
}

/** Cotação fixa por partida, usada só quando a API não entrega o 1X2. */
export function simulatedMatchOdds(fixtureId: number): MatchOdds {
  return {
    home: simulatedOdd(fixtureId, "home"),
    draw: simulatedOdd(fixtureId, "draw"),
    away: simulatedOdd(fixtureId, "away"),
    source: "Cotação simulada",
    updatedAt: null,
  };
}

export async function getMatchOdds(fixtureId: number, apiKey: string): Promise<MatchOdds> {
  const keyHash = createHash("sha256").update(apiKey).digest("hex");
  try {
    const odds = await unstable_cache(
      (id: number) => fetchOdds(id, apiKey),
      ["api-football-odds-v1", keyHash],
      { revalidate: 60 * 60 * 3 },
    )(fixtureId);
    return odds ?? simulatedMatchOdds(fixtureId);
  } catch {
    return simulatedMatchOdds(fixtureId);
  }
}
