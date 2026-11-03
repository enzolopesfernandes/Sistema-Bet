import { requireAdmin } from "@/src/lib/admin/access";
import { listPromotions } from "@/src/lib/promocoes/service";
import { parsePagination } from "@/lib/apostas";
import PageShell, { Pagination } from "@/components/page/gestao/PageShell";
import PromotionsPanel from "@/components/page/admin/PromotionsPanel";
export const metadata = { title: "Gerenciar promoções | Sistema-Bet" };
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireAdmin(), { page, pageSize } = parsePagination(await searchParams);
  let data;
  try { data = await listPromotions(user.id, page, pageSize); } catch { /* A mensagem abaixo permite repetir a consulta. */ }
  return <PageShell user={user} admin title="Gerenciar promoções" description="Defina benefícios, condições de uso e validade.">{data ? <><PromotionsPanel promotions={data.items} /><Pagination value={data.pagination} path="/admin/promocoes" /></> : <p role="alert">Não foi possível carregar as promoções. Atualize a página.</p>}</PageShell>;
}
