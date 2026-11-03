import Link from "next/link";
import SportsSoccerRounded from "@mui/icons-material/SportsSoccerRounded";
import Header, { type HeaderUser } from "@/components/layout/header/Header";
import styles from "./match-details.module.scss";

export default function MatchDetailsState({ state, user = null }: { state: "loading" | "not-found" | "unavailable"; user?: HeaderUser | null }) {
  return <div className={styles.page}>
    <Header user={user} />
    <main className={styles.main}>
      <Link href="/" className={styles.back}>← Voltar aos jogos</Link>
      <section className={styles.state} aria-busy={state === "loading"}>
        <SportsSoccerRounded />
        <h1>{state === "loading" ? "Carregando a partida…" : state === "not-found" ? "Partida não encontrada" : "Os detalhes estão indisponíveis"}</h1>
        <p role="status">{state === "loading" ? "Estamos buscando os detalhes do jogo." : state === "not-found" ? "Não encontramos esta partida do futebol brasileiro. Explore os jogos da tela inicial." : "Não foi possível consultar esta partida agora. Tente novamente em alguns instantes."}</p>
        {state === "unavailable" && <a href="" className={styles.back}>Tentar novamente</a>}
      </section>
    </main>
  </div>;
}
