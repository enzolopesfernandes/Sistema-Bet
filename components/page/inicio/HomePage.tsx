import Link from "next/link";
import SportsSoccerRounded from "@mui/icons-material/SportsSoccerRounded";
import ArrowOutwardRounded from "@mui/icons-material/ArrowOutwardRounded";
import ArrowBackRounded from "@mui/icons-material/ArrowBackRounded";
import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import PublicRounded from "@mui/icons-material/PublicRounded";
import EventAvailableOutlined from "@mui/icons-material/EventAvailableOutlined";
import EmojiEventsOutlined from "@mui/icons-material/EmojiEventsOutlined";
import InfoOutlined from "@mui/icons-material/InfoOutlined";
import Header, { type HeaderUser } from "@/components/layout/header/Header";
import type { Match, MatchFeed } from "@/src/lib/jogos/types";
import MatchCard from "./MatchCard";
import UpcomingCarousel from "./UpcomingCarousel";
import styles from "./inicio.module.scss";

type Props = {
  user: HeaderUser | null;
  upcoming: Match[];
  recent: Match[];
  availability: MatchFeed["availability"];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
};

function EmptyMatches({ finished, unavailable }: { finished?: boolean; unavailable: boolean }) {
  return <div className={styles.emptyState}>
    <span className={styles.emptyIcon}>{finished ? <EmojiEventsOutlined /> : <EventAvailableOutlined />}</span>
    <h3>{unavailable ? "O jogo continua. Os dados voltam já." : finished ? "Nenhum resultado por aqui ainda" : "A próxima partida vem aí"}</h3>
    <p>{unavailable ? "Não foi possível carregar as partidas agora. Volte em alguns instantes." : finished ? "Os jogos encerrados dos últimos dias aparecerão aqui." : "Não há partidas programadas nos próximos dias. Acompanhe as próximas atualizações."}</p>
  </div>;
}

export default function HomePage({ user, upcoming, recent, availability, pagination }: Props) {
  const unavailable = availability === "unconfigured" || availability === "unavailable";
  const resultHref = (page: number, pageSize = pagination.pageSize) => `/?page=${page}&pageSize=${pageSize}#resultados`;
  const first = (pagination.page - 1) * pagination.pageSize + 1;

  return (
    <div className={styles.page}>
      <Header user={user} />
      <main className={styles.main}>
        <div className={styles.breadcrumb}><SportsSoccerRounded /> Futebol brasileiro <span>/</span> <span>Visão geral</span></div>
        <section className={styles.hero} aria-labelledby="home-heading">
          <div className={styles.heroCopy}>
            <span className={styles.eyebrow}><span /> SUA PAIXÃO. SEU JOGO.</span>
            <h1 id="home-heading">Cada partida,<br />uma nova <em>emoção.</em></h1>
            <p>Acompanhe os próximos confrontos e os últimos resultados.<br className={styles.desktopBreak} /> O futebol brasileiro, em um só lugar.</p>
            <a href="#proximos" className={styles.heroLink}>Explore os jogos <ArrowOutwardRounded /></a>
          </div>
          <div className={styles.pitch} aria-hidden="true"><div className={styles.pitchField}><div className={styles.pitchCenter} /><div className={styles.pitchBox} /></div><span className={styles.pitchBall}><SportsSoccerRounded /></span><span className={styles.pitchLabel}><span /> DENTRO DAS QUATRO LINHAS</span></div>
          <span className={styles.heroCorner}>FUTEBOL É CONEXÃO.</span>
        </section>

        <div className={styles.contentBar}><span><SportsSoccerRounded /> Futebol</span><span><PublicRounded /> Horário de Brasília</span></div>
        {availability === "partial" && <p className={styles.notice} role="status"><InfoOutlined /> Algumas partidas estão indisponíveis no momento. Exibindo os dados recebidos.</p>}

        <section id="proximos" className={styles.upcomingSection} aria-labelledby="upcoming-heading">
          <UpcomingCarousel count={upcoming.length}>
            {upcoming.length ? upcoming.map((match) => <MatchCard key={match.id} match={match} />) : <EmptyMatches unavailable={unavailable} />}
          </UpcomingCarousel>
          <p className={styles.sectionFootnote}><span /> Partidas programadas para os próximos dias</p>
        </section>

        <section id="resultados" className={styles.resultsSection} aria-labelledby="results-heading">
          <div className={styles.sectionHeading}>
            <div><span className={styles.sectionKicker}>APITO FINAL</span><h2 id="results-heading">Resultados recentes<span className={styles.headingDot}>.</span></h2><p>O placar já está definido. Confira como terminou.</p></div>
            <span className={styles.resultsLabel}><span /> Jogos encerrados</span>
          </div>
          {recent.length ? <div className={styles.resultsGrid}>{recent.map((match) => <MatchCard key={match.id} match={match} finished />)}</div> : <EmptyMatches finished unavailable={unavailable} />}

          {pagination.total > 0 && <div className={styles.paginationBar}>
            <span>{first}–{Math.min(first + recent.length - 1, pagination.total)} de {pagination.total} resultados</span>
            <div className={styles.pageSizes}>Por página: {[12, 24].map((size) => <Link key={size} href={resultHref(1, size)} aria-current={pagination.pageSize === size ? "true" : undefined} prefetch={false}>{size}</Link>)}</div>
            {pagination.totalPages > 1 && <nav className={styles.pagination} aria-label="Paginação dos resultados">
              {pagination.page > 1 ? <Link href={resultHref(pagination.page - 1)} aria-label="Página anterior" prefetch={false}><ArrowBackRounded /></Link> : <span aria-disabled="true"><ArrowBackRounded /></span>}
              <span>{pagination.page} <span>de</span> {pagination.totalPages}</span>
              {pagination.page < pagination.totalPages ? <Link href={resultHref(pagination.page + 1)} aria-label="Próxima página" prefetch={false}><ArrowForwardRounded /></Link> : <span aria-disabled="true"><ArrowForwardRounded /></span>}
            </nav>}
          </div>}
        </section>

        <div className={styles.education}><span className={styles.educationIcon}><SportsSoccerRounded /></span><div><strong>A emoção é do esporte. A experiência é simulada.</strong><p>Projeto educacional, sem dinheiro real. Aqui, a paixão pelo futebol é o que vale.</p></div><span className={styles.educationTag}>FEITO PARA APRENDER</span></div>
      </main>
      <footer className={styles.footer}><span>Sistema<span>-Bet</span><span className={styles.copyright}> © {new Date().getFullYear()}</span></span><p>Projeto educacional · Sem dinheiro real</p><a href="https://www.api-football.com/" target="_blank" rel="noopener noreferrer">Dados por API-Football <ArrowOutwardRounded /></a></footer>
    </div>
  );
}
