import type { Metadata } from "next";
import { BET_MESSAGES, UUID_PATTERN, parsePagination } from "@/lib/apostas";
import { requireUser } from "@/src/lib/auth/session";
import { getBetHistory } from "@/src/lib/apostas/service";
import BetHistoryPage from "@/components/page/apostas/BetHistoryPage";

export const metadata: Metadata = { title: "Histórico de Apostas | Sistema-Bet" };

export default async function Page({ searchParams }: { searchParams: Promise<{ page?: string | string[]; pageSize?: string | string[]; aposta?: string | string[] }> }) {
  const [user, params] = await Promise.all([requireUser(), searchParams]);
  const { page, pageSize } = parsePagination(params);
  const headerUser = { nome: user.nome, email: user.email, papel: user.papel };
  const initialBetId = typeof params.aposta === "string" && UUID_PATTERN.test(params.aposta) ? params.aposta : undefined;
  const history = await getBetHistory(user.id, page, pageSize).catch(() => null);
  return <BetHistoryPage user={headerUser} bets={history?.bets ?? []} pagination={history?.pagination ?? { page, pageSize, total: 0, totalPages: 1 }} initialBetId={history ? initialBetId : undefined} error={history ? undefined : BET_MESSAGES.historyFailed} />;
}
