import "server-only";

import type { Match } from "@/src/lib/jogos/types";

export function isBettingOpen(match: Pick<Match, "status" | "date">) {
  return match.status === "NS" && Date.parse(match.date) > Date.now();
}
