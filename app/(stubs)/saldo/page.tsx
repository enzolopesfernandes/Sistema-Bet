import type { Metadata } from "next";
import { requireUser } from "@/src/lib/auth/session";
import RechargePage from "@/components/page/saldo/RechargePage";

export const metadata: Metadata = { title: "Recarregar saldo | Sistema-Bet" };

export default async function Page() {
  const user = await requireUser();
  return <RechargePage user={{ nome: user.nome, email: user.email, papel: user.papel }} />;
}
