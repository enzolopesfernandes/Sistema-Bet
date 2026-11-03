import Link from "next/link";
import Header, { type HeaderUser } from "@/components/layout/header/Header";
import type { AdminPagination } from "@/lib/admin";
import styles from "../admin/admin.module.scss";

export function AdminNav() {
  return <nav className={styles.tabs} aria-label="Administração"><Link href="/admin">Usuários</Link><Link href="/admin?aba=odds">Odds</Link><Link href="/admin/jogos">Jogos</Link><Link href="/admin/promocoes">Promoções</Link><Link href="/admin/saques">Saques pendentes</Link></nav>;
}
export function Pagination({ value, path }: { value: AdminPagination; path: string }) {
  return <nav className={styles.pagination} aria-label="Paginação"><span>{value.total} registro(s) · Página {value.page} de {value.totalPages}</span>{value.page > 1 && <Link href={`${path}?page=${value.page - 1}&pageSize=${value.pageSize}`} prefetch={false}>Anterior</Link>}{value.page < value.totalPages && <Link href={`${path}?page=${value.page + 1}&pageSize=${value.pageSize}`} prefetch={false}>Próxima</Link>}</nav>;
}
export default function PageShell({ user, title, description, admin = false, children }: { user: HeaderUser; title: string; description: string; admin?: boolean; children: React.ReactNode }) {
  return <div className={styles.page}><Header user={user} /><main className={styles.main}><Link href="/jogos" className={styles.back}>← Voltar aos jogos</Link><div className={styles.heading}><span>{admin ? "PAINEL ADMINISTRATIVO" : "MINHA CONTA"}</span><h1>{title}</h1><p>{description}</p></div>{admin && <AdminNav />}{children}<p className={styles.note}>Ambiente educacional. Créditos, apostas e saques são simulados.</p></main></div>;
}
