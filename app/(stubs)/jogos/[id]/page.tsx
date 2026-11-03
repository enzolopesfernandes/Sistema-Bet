import type { Metadata } from "next";
import { notFound } from "next/navigation";
import MatchDetailsPage from "@/components/page/jogos/MatchDetailsPage";
import MatchDetailsState from "@/components/page/jogos/MatchDetailsState";
import { getCurrentUser } from "@/src/lib/auth/session";
import { getMatchDetails } from "@/src/lib/jogos/details";
import { isBettingOpen } from "@/src/lib/apostas/rules";

export const metadata: Metadata = {
  title: "Detalhes do jogo | Sistema-Bet",
  description: "Confira placar, eventos, estatísticas e escalações do futebol brasileiro.",
};

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^-?[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id))) notFound();
  const [result, user] = await Promise.all([getMatchDetails(Number(id)), getCurrentUser()]);
  if (result.availability === "not-found") notFound();
  const headerUser = user ? { nome: user.nome, email: user.email, papel: user.papel } : null;
  if (result.availability !== "ready") return <MatchDetailsState state="unavailable" user={headerUser} />;
  return <MatchDetailsPage match={result.match} user={headerUser} bettingOpen={isBettingOpen(result.match)} />;
}
