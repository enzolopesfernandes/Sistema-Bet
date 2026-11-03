import { requireAdmin } from "@/src/lib/admin/access";
import { listGames } from "@/src/lib/admin/games";
import { parsePagination } from "@/lib/apostas";
import PageShell, { Pagination } from "@/components/page/gestao/PageShell";
import GamesPanel from "@/components/page/admin/GamesPanel";
export const metadata = { title: "Gerenciar jogos | Sistema-Bet" };
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireAdmin(), { page, pageSize } = parsePagination(await searchParams);
  let data;
  try { data = await listGames(user.id, page, pageSize); } catch { /* A mensagem abaixo permite repetir a consulta. */ }
  return <PageShell user={user} admin title="Gerenciar jogos" description="Cadastre partidas, configure cotações e informe os resultados.">{data ? <><GamesPanel games={data.items} /><Pagination value={data.pagination} path="/admin/jogos" /></> : <p role="alert">Não foi possível carregar os jogos. Atualize a página.</p>}</PageShell>;
}
