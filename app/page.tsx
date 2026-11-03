import type { Metadata } from "next";
import HomePage from "@/components/page/inicio/HomePage";
import { getCurrentUser } from "@/src/lib/auth/session";
import { getMatchFeed } from "@/src/lib/jogos/service";

export const metadata: Metadata = {
  title: "Sistema-Bet | Futebol e resultados",
  description: "Acompanhe os próximos jogos e os resultados recentes do futebol brasileiro no Sistema-Bet. Uma experiência educacional, sem dinheiro real.",
};

export default async function Home({ searchParams }: {
  searchParams: Promise<{ page?: string | string[]; pageSize?: string | string[] }>;
}) {
  const [user, feed, params] = await Promise.all([getCurrentUser(), getMatchFeed(), searchParams]);
  const pageSize = params.pageSize === "24" ? 24 : 12;
  const requestedPage = typeof params.page === "string" && /^[1-9]\d*$/.test(params.page) ? Number(params.page) : 1;
  const totalPages = Math.max(1, Math.ceil(feed.recent.length / pageSize));
  const page = Number.isSafeInteger(requestedPage) ? Math.min(requestedPage, totalPages) : 1;

  return <HomePage
    user={user ? { nome: user.nome, email: user.email, papel: user.papel } : null}
    upcoming={feed.upcoming}
    recent={feed.recent.slice((page - 1) * pageSize, page * pageSize)}
    availability={feed.availability}
    pagination={{ page, pageSize, total: feed.recent.length, totalPages }}
  />;
}
