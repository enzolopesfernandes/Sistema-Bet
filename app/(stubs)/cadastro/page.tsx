import type { Metadata } from "next";
import { redirect } from "next/navigation";
import RegistrationPage from "@/components/page/cadastro/RegistrationPage";
import { getCurrentUser } from "@/src/lib/auth/session";

export const metadata: Metadata = { title: "Criar Conta | Sistema-Bet" };

export default async function Page() {
  if (await getCurrentUser()) redirect("/");
  return <RegistrationPage />;
}
