import Link from "next/link";
import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import Brand from "@/components/auth/Brand";
import UserMenu from "./UserMenu";
import BalanceBadge from "./BalanceBadge";
import styles from "./header.module.scss";

export type HeaderUser = { nome: string; email: string; papel?: "APOSTADOR" | "ADMINISTRADOR" };

export default function Header({ user }: { user: HeaderUser | null }) {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Brand className={styles.brand} />
        <span className={styles.tagline}>O esporte conecta. O jogo começa aqui.</span>
        {user ? <div className={styles.accountArea}><UserMenu user={user} /><BalanceBadge account={user.email} /></div> : (
          <nav className={styles.actions} aria-label="Acesso à conta">
            <Link href="/login" className={styles.login}>Login</Link>
            <Link href="/cadastro" className={styles.register}>Cadastrar <ArrowForwardRounded /></Link>
          </nav>
        )}
      </div>
    </header>
  );
}
