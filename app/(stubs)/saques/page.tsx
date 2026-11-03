import { requireUser } from "@/src/lib/auth/session";
import { listWithdrawals } from "@/src/lib/saques/service";
import { parsePagination } from "@/lib/apostas";
import PageShell, { Pagination } from "@/components/page/gestao/PageShell";
import WithdrawalsPanel from "@/components/page/saques/WithdrawalsPanel";
export const metadata = { title: "Saques simulados | Sistema-Bet" };
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser(), { page, pageSize } = parsePagination(await searchParams);
  let data;
  try { data = await listWithdrawals(user.id, false, page, pageSize); } catch { /* A mensagem abaixo permite repetir a consulta. */ }
  return <PageShell user={user} title="Saques simulados" description="Solicite uma retirada fictícia e acompanhe a aprovação.">{data ? <><WithdrawalsPanel admin={false} items={data.items} /><Pagination value={data.pagination} path="/saques" /></> : <p role="alert">Não foi possível carregar os saques. Atualize a página.</p>}</PageShell>;
}
