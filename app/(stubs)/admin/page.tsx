import type { Metadata } from "next";
import { requireAdmin } from "@/src/lib/admin/access";
import { listUsers } from "@/src/lib/admin/users";
import { getMatchFeed } from "@/src/lib/jogos/service";
import { getMatchDetails } from "@/src/lib/jogos/details";
import { isBettingOpen } from "@/src/lib/apostas/rules";
import { parseAdminPagination } from "@/lib/admin";
import AdminPage from "@/components/page/admin/AdminPage";
import type { Match } from "@/src/lib/jogos/types";

export const metadata: Metadata = { title: "Administração | Sistema-Bet" };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireAdmin();
  const params = await searchParams;
  const tab = params.aba === "odds" ? "odds" : "usuarios";
  const { page, pageSize } = parseAdminPagination(params);
  const search = typeof params.q === "string" ? params.q.trim().slice(0, 255) : "";
  const fixture = typeof params.jogo === "string" ? params.jogo : "";
  let error: string | undefined;
  let users: Awaited<ReturnType<typeof listUsers>> | null = null;
  let matches: Match[] = [];
  if (tab === "usuarios") {
    try { users = await listUsers(user.id, search, page, pageSize); }
    catch { error = "Não foi possível carregar os usuários neste momento"; }
  } else if (fixture) {
    if (!/^-?[1-9]\d{0,9}$/.test(fixture) || Math.abs(Number(fixture)) > 2147483647) error = "Informe um identificador de jogo válido";
    else {
      const result = await getMatchDetails(Number(fixture));
      if (result.availability === "ready" && isBettingOpen(result.match) && result.match.odds) matches = [result.match];
      else error = result.availability === "unconfigured" ? "Configure a chave API-Football para consultar jogos" : result.availability === "unavailable" ? "Não foi possível carregar as informações do jogo" : "O jogo selecionado não está disponível para configuração de odds";
    }
  } else {
    const feed = await getMatchFeed();
    matches = feed.upcoming.filter((match) => isBettingOpen(match) && match.odds);
    if (feed.availability !== "ready") error = feed.availability === "unconfigured" ? "Configure a chave API-Football para consultar jogos" : "Não foi possível carregar todos os jogos e suas odds. Tente atualizar a página.";
  }
  const totalPages = Math.max(1, Math.ceil(matches.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  return <AdminPage user={{ nome: user.nome, email: user.email, papel: user.papel }} tab={tab} search={search} fixture={fixture} error={error}
    users={users?.users ?? []} matches={matches.slice((currentPage - 1) * pageSize, currentPage * pageSize)}
    pagination={users?.pagination ?? { page: currentPage, pageSize, total: matches.length, totalPages }} />;
}
