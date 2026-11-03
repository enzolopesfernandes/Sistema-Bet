import { requireAdmin } from "@/src/lib/admin/access";
import { listWithdrawals } from "@/src/lib/saques/service";
import { parsePagination } from "@/lib/apostas";
import PageShell, { Pagination } from "@/components/page/gestao/PageShell";
import WithdrawalsPanel from "@/components/page/saques/WithdrawalsPanel";
export const metadata = { title: "Aprovar saques | Sistema-Bet" };
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireAdmin(), { page, pageSize } = parsePagination(await searchParams);
  let data;
  try { data = await listWithdrawals(user.id, true, page, pageSize); } catch { /* A mensagem abaixo permite repetir a consulta. */ }
  return <PageShell user={user} admin title="Aprovar saques" description="Analise as solicitações de retirada de créditos fictícios.">{data ? <><WithdrawalsPanel admin items={data.items} /><Pagination value={data.pagination} path="/admin/saques" /></> : <p role="alert">Não foi possível carregar os saques. Atualize a página.</p>}</PageShell>;
}
