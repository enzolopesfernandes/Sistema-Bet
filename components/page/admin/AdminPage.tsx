import Link from "next/link";
import Header, { type HeaderUser } from "@/components/layout/header/Header";
import type { AdminUser, AdminPagination } from "@/lib/admin";
import type { Match } from "@/src/lib/jogos/types";
import UsersPanel from "./UsersPanel";
import OddsPanel from "./OddsPanel";
import styles from "./admin.module.scss";

type Props = { user: HeaderUser; tab: "usuarios" | "odds"; search: string; fixture: string; error?: string; users: AdminUser[]; matches: Match[]; pagination: AdminPagination };

export default function AdminPage({ user, tab, search, fixture, error, users, matches, pagination }: Props) {
  function href(page: number, pageSize = pagination.pageSize) {
    return `/admin?${new URLSearchParams({ aba: tab, q: search, jogo: fixture, page: String(page), pageSize: String(pageSize) })}`;
  }
  return <div className={styles.page}>
    <Header user={user} />
    <main className={styles.main}>
      <Link href="/" className={styles.back}>← Voltar aos jogos</Link>
      <div className={styles.heading}><span>PAINEL ADMINISTRATIVO</span><h1>Administração</h1><p>Gerencie as contas e as cotações dos jogos.</p></div>
      <nav className={styles.tabs} aria-label="Administração">
        <Link href="/admin" prefetch={false} aria-current={tab === "usuarios" ? "page" : undefined}>Gerenciar usuários</Link>
        <Link href="/admin?aba=odds" prefetch={false} aria-current={tab === "odds" ? "page" : undefined}>Definir odds</Link>
        <Link href="/admin/jogos" prefetch={false}>Gerenciar jogos</Link>
        <Link href="/admin/promocoes" prefetch={false}>Promoções</Link>
        <Link href="/admin/saques" prefetch={false}>Saques pendentes</Link>
      </nav>
      <form action="/admin" method="get" className={styles.search}>
        <input type="hidden" name="aba" value={tab} />
        <label htmlFor="admin-search">{tab === "usuarios" ? "Buscar por nome ou e-mail" : "Consultar pelo ID da partida (negativo para jogos locais)"}</label>
        <div><input key={tab} id="admin-search" name={tab === "usuarios" ? "q" : "jogo"} type="search" defaultValue={tab === "usuarios" ? search : fixture} maxLength={tab === "usuarios" ? 255 : 10} /><button type="submit">Buscar</button><Link href={tab === "usuarios" ? "/admin" : "/admin?aba=odds"}>Limpar</Link></div>
      </form>
      {error && <p role="alert" className={styles.error}>{error} <Link href={href(pagination.page)} prefetch={false}>Tentar novamente</Link></p>}
      {tab === "usuarios" ? <UsersPanel users={users} search={search} failed={Boolean(error)} /> : <OddsPanel matches={matches} failed={Boolean(error)} />}
      {pagination.total > 0 && <nav className={styles.pagination} aria-label="Paginação">
        <span>{pagination.total} {tab === "usuarios" ? "conta(s)" : "jogo(s)"} · Página {pagination.page} de {pagination.totalPages}</span>
        {pagination.page > 1 && <Link href={href(pagination.page - 1)} prefetch={false}>Anterior</Link>}
        {pagination.page < pagination.totalPages && <Link href={href(pagination.page + 1)} prefetch={false}>Próxima</Link>}
        <span>Por página:</span>{[10, 20].map((size) => <Link key={size} href={href(1, size)} prefetch={false} aria-current={size === pagination.pageSize ? "true" : undefined}>{size}</Link>)}
      </nav>}
      <p className={styles.note}>Ambiente educacional. Apostas, saldos e prêmios são fictícios.</p>
    </main>
  </div>;
}
