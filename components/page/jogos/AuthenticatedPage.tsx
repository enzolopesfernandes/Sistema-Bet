import CheckCircleOutlineRounded from "@mui/icons-material/CheckCircleOutlineRounded";
import SportsSoccerRounded from "@mui/icons-material/SportsSoccerRounded";
import Brand from "@/components/auth/Brand";
import LogoutButton from "@/components/auth/LogoutButton";
import { AUTH_MESSAGES } from "@/lib/auth-validation";
import styles from "./jogos.module.scss";

export default function AuthenticatedPage({ name, justLoggedIn }: { name: string; justLoggedIn: boolean }) {
  return (
    <main className={styles.page}>
      <header><Brand /></header>
      <section className={styles.card} aria-labelledby="session-title">
        {justLoggedIn && <p className={styles.success} role="status"><CheckCircleOutlineRounded />{AUTH_MESSAGES.loginSuccess}</p>}
        <span className={styles.icon}><SportsSoccerRounded /></span>
        <h1 id="session-title">Olá, {name}!</h1>
        <p>Você está conectado ao Sistema-Bets.</p>
        <p>A tela de jogos estará disponível em breve.</p>
        <LogoutButton />
      </section>
      <footer>Projeto educacional · Sem dinheiro real</footer>
    </main>
  );
}
