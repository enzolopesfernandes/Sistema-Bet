import { requireUser } from "@/src/lib/auth/session";
import { getAccount } from "@/src/lib/conta/service";
import PageShell from "@/components/page/gestao/PageShell";
import AccountPanel from "@/components/page/conta/AccountPanel";
export const metadata = { title: "Minha conta | Sistema-Bet" };
export default async function Page() {
  const user = await requireUser();
  let account;
  try { account = await getAccount(user.id); } catch { return <PageShell user={user} title="Minha conta" description="Gerencie suas informações"><p role="alert">Não foi possível carregar as informações da conta. Atualize a página.</p></PageShell>; }
  return <PageShell user={user} title="Minha conta" description="Atualize seus dados e sua senha"><AccountPanel admin={user.papel === "ADMINISTRADOR"} account={{ nome: account.nome, email: account.email, anterior: account.atualizado_em.toISOString() }} /></PageShell>;
}
