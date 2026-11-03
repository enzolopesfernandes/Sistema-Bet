import type { Metadata } from "next";
import { redirect } from "next/navigation";
import LoginPage from "@/components/page/login/LoginPage";
import { getCurrentUser } from "@/src/lib/auth/session";

export const metadata: Metadata = { title: "Entrar | Sistema-Bet" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ cadastro?: string | string[] }>;
}) {
  if (await getCurrentUser()) redirect("/");
  const { cadastro } = await searchParams;
  return <LoginPage accountCreated={cadastro === "sucesso"} />;
}
