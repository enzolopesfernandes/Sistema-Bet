import Link from "next/link";
import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import AccessTimeRounded from "@mui/icons-material/AccessTimeRounded";
import LocationOnOutlined from "@mui/icons-material/LocationOnOutlined";
import type { Match } from "@/src/lib/jogos/types";
import TeamLogo from "./TeamLogo";
import styles from "./inicio.module.scss";

const dateFormat = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", timeZone: "America/Sao_Paulo" });
const timeFormat = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
const oddsFormat = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 4 });

export default function MatchCard({ match, finished = false }: { match: Match; finished?: boolean }) {
  const date = new Date(match.date);
  const resultLabel = match.status === "PEN" ? "Nos pênaltis" : match.status === "AET" ? "Prorrogação" : "Encerrado";

  return (
    <article className={`${styles.matchCard} ${finished ? styles.resultCard : ""}`} aria-label={`${match.home.name} contra ${match.away.name}`}>
      <div className={styles.matchTop}>
        <span className={styles.league} title={`${match.country} · ${match.league}`}>{match.league}</span>
        <span className={finished ? styles.finishedBadge : styles.upcomingBadge}>{finished ? resultLabel : "Em breve"}</span>
      </div>
      <div className={styles.matchMeta}>
        <span>{match.country}</span><span aria-hidden="true">·</span>
        <time dateTime={match.date}>{dateFormat.format(date)}{!finished && ` · ${timeFormat.format(date)}`}</time>
      </div>
      <div className={styles.teams}>
        {([match.home, match.away]).map((team, index) => (
          <div key={index} className={styles.team}>
            <TeamLogo src={team.logo} />
            <span className={finished && team.winner ? styles.winner : undefined}>{team.name}</span>
            {finished && <strong className={team.winner ? styles.winningScore : styles.score}>{team.goals}</strong>}
          </div>
        ))}
      </div>
      {!finished && match.status === "NS" && <div className={styles.oddsBlock}>
        <span className={styles.oddsHeading}>Resultado da partida · 1X2</span>
        {match.odds ? <>
          <dl className={styles.oddsGrid}>
            {([
              ["1", "Mandante", match.home.name, match.odds.home],
              ["X", "Empate", "Empate", match.odds.draw],
              ["2", "Visitante", match.away.name, match.odds.away],
            ] as const).map(([symbol, label, title, odd]) => <div key={symbol} title={title}>
              <dt><span>{symbol}</span> {label}</dt><dd>{oddsFormat.format(odd)}</dd>
            </div>)}
          </dl>
          <p className={styles.oddsSource}>Fonte: {match.odds.source}{match.odds.updatedAt && <> · <time dateTime={match.odds.updatedAt}>{dateFormat.format(new Date(match.odds.updatedAt))} às {timeFormat.format(new Date(match.odds.updatedAt))}</time></>}</p>
        </> : <p className={styles.oddsUnavailable}>Odds indisponíveis para esta partida.</p>}
        <p className={styles.oddsDisclaimer}>Cotações de referência para simulação.</p>
      </div>}
      <div className={styles.matchFooter}>
        {finished ? <>
          <span className={styles.resultDot} />
          <span>{match.status === "PEN" && match.home.penalties !== null && match.away.penalties !== null ? `Pênaltis: ${match.home.penalties} × ${match.away.penalties}` : "Resultado final"}</span>
          <span className={styles.footerTime}>{timeFormat.format(date)}</span>
        </> : <><LocationOnOutlined /><span title={match.venue ?? undefined}>{match.venue ?? "Local a confirmar"}</span><AccessTimeRounded className={styles.footerTime} /></>}
      </div>
      <Link href={`/jogos/${match.id}`} prefetch={false} className={styles.detailsLink} aria-label={`Ver detalhes de ${match.home.name} contra ${match.away.name}`}>
        Ver detalhes <ArrowForwardRounded />
      </Link>
    </article>
  );
}
