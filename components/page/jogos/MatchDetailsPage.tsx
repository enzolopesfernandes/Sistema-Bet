import Link from "next/link";
import SportsSoccerRounded from "@mui/icons-material/SportsSoccerRounded";
import LocationOnOutlined from "@mui/icons-material/LocationOnOutlined";
import ArrowBackRounded from "@mui/icons-material/ArrowBackRounded";
import Header, { type HeaderUser } from "@/components/layout/header/Header";
import TeamLogo from "@/components/page/inicio/TeamLogo";
import BetSlip from "./BetSlip";
import type { MatchDetails, MatchPlayer } from "@/src/lib/jogos/types";
import styles from "./match-details.module.scss";

const dateFormat = new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeStyle: "short", timeZone: "America/Sao_Paulo" });
const oddsFormat = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
const statusLabels: Record<string, string> = {
  TBD: "Horário a confirmar", NS: "Não iniciado", "1H": "Primeiro tempo", HT: "Intervalo", "2H": "Segundo tempo",
  ET: "Prorrogação em andamento", BT: "Intervalo da prorrogação", P: "Disputa de pênaltis", SUSP: "Suspenso",
  INT: "Interrompido", FT: "Encerrado", AET: "Encerrado após prorrogação", PEN: "Encerrado nos pênaltis",
  PST: "Adiado", CANC: "Cancelado", ABD: "Abandonado", AWD: "Resultado administrativo", WO: "Vitória por ausência", LIVE: "Em andamento",
};

function PlayerList({ players }: { players: MatchPlayer[] }) {
  return <ul className={styles.playerList}>{players.map((player, index) => <li key={`${player.name}-${index}`}>
    <span className={styles.shirt}>{player.number ?? "–"}</span>
    <span>{player.name}</span><small>{player.position ?? ""}</small>
  </li>)}</ul>;
}

function EmptySection({ children }: { children: React.ReactNode }) {
  return <p className={styles.empty}>{children}</p>;
}

export default function MatchDetailsPage({ match, user, bettingOpen }: { match: MatchDetails; user: HeaderUser | null; bettingOpen: boolean }) {
  const scheduled = match.status === "NS" || match.status === "TBD";
  const live = ["1H", "HT", "2H", "ET", "BT", "P", "LIVE"].includes(match.status);
  return <div className={styles.page}>
    <Header user={user} />
    <main className={styles.main}>
      <Link href="/" className={styles.back}><ArrowBackRounded /> Voltar aos jogos</Link>
      <div className={styles.heading}><span>FUTEBOL BRASILEIRO</span><h1>{match.home.name} <span>×</span> {match.away.name}</h1><p>{match.league}{match.season ? ` · ${match.season}` : ""}{match.round ? ` · ${match.round}` : ""}</p></div>

      <section className={styles.scoreboard} aria-label="Placar da partida">
        <span className={`${styles.badge} ${live ? styles.live : ""}`}>{statusLabels[match.status] ?? "Situação não informada"}{live && match.elapsed !== null ? ` · ${match.elapsed}${match.extra ? `+${match.extra}` : ""}′` : ""}</span>
        <div className={styles.scoreRow}>
          <div className={styles.team}><TeamLogo src={match.home.logo} /><strong>{match.home.name}</strong><small>Mandante</small></div>
          <div className={styles.score}><strong>{scheduled ? "VS" : `${match.home.goals ?? "–"} : ${match.away.goals ?? "–"}`}</strong>{match.status === "PEN" && match.home.penalties !== null && match.away.penalties !== null && <span>Pênaltis: {match.home.penalties} × {match.away.penalties}</span>}</div>
          <div className={styles.team}><TeamLogo src={match.away.logo} /><strong>{match.away.name}</strong><small>Visitante</small></div>
        </div>
        <time dateTime={match.date}>{dateFormat.format(new Date(match.date))} · Brasília</time>
        <p className={styles.venue}><LocationOnOutlined /> {match.venue ?? "Estádio a confirmar"}{match.city ? ` · ${match.city}` : ""}</p>
        {match.scores.length > 0 && <dl className={styles.periods}>{match.scores.map((score) => <div key={score.label}><dt>{score.label}</dt><dd>{score.home ?? "–"} × {score.away ?? "–"}</dd></div>)}</dl>}
      </section>

      <nav className={styles.sections} aria-label="Seções da partida"><a href="#informacoes">Informações</a><a href="#estatisticas">Estatísticas</a><a href="#eventos">Eventos</a><a href="#escalacoes">Escalações</a>{match.players.length > 0 && <a href="#jogadores">Jogadores</a>}</nav>

      <div className={styles.columns}>
        <section id="informacoes" className={styles.panel} aria-labelledby="info-heading"><h2 id="info-heading">Informações da partida</h2>
          <dl className={styles.facts}><div><dt>Competição</dt><dd>{match.league}</dd></div><div><dt>Rodada</dt><dd>{match.round ?? "Não informada"}</dd></div><div><dt>Temporada</dt><dd>{match.season ?? "Não informada"}</dd></div><div><dt>Árbitro</dt><dd>{match.referee ?? "Não informado"}</dd></div><div><dt>Estádio</dt><dd>{match.venue ?? "A confirmar"}</dd></div><div><dt>Cidade</dt><dd>{match.city ?? "Não informada"}</dd></div></dl>
        </section>
        {scheduled && <section className={styles.panel} aria-labelledby="odds-heading"><h2 id="odds-heading">Cotações de referência <small>1X2</small></h2>
          {match.odds ? <><dl className={styles.odds}>{([["1 · Mandante", match.odds.home], ["X · Empate", match.odds.draw], ["2 · Visitante", match.odds.away]] as const).map(([label, odd]) => <div key={label}><dt>{label}</dt><dd>{oddsFormat.format(odd)}</dd></div>)}</dl><p className={styles.caption}>Fonte: {match.odds.source}{match.odds.updatedAt && <> · <time dateTime={match.odds.updatedAt}>{dateFormat.format(new Date(match.odds.updatedAt))}</time></>}</p></> : <EmptySection>Odds indisponíveis para esta partida.</EmptySection>}
          <p className={styles.caption}>Cotações para simulação. Projeto educacional, sem dinheiro real.</p>
        </section>}
      </div>

      {bettingOpen && match.odds && <BetSlip match={{ ...match, odds: match.odds }} authenticated={user !== null} />}

      <section id="estatisticas" className={styles.panel} aria-labelledby="stats-heading"><h2 id="stats-heading">O jogo em números</h2>
        {match.statistics.length ? <div className={styles.tableScroll}><table className={styles.statsTable}><thead><tr><th scope="col">{match.home.name}</th><th scope="col">Estatística</th><th scope="col">{match.away.name}</th></tr></thead><tbody>{match.statistics.map((stat) => <tr key={stat.label}><td>{stat.home?.replace(".", ",") ?? "–"}</td><th scope="row">{stat.label}</th><td>{stat.away?.replace(".", ",") ?? "–"}</td></tr>)}</tbody></table></div> : <EmptySection>{scheduled ? "As estatísticas serão disponibilizadas após o início da partida, conforme a cobertura da competição." : "A API ainda não disponibilizou estatísticas para esta partida."}</EmptySection>}
      </section>

      <section id="eventos" className={styles.panel} aria-labelledby="events-heading"><h2 id="events-heading">Linha do tempo</h2>
        {match.events.length ? <ol className={styles.timeline}>{match.events.map((event, index) => <li key={index}>
          <span className={styles.minute}>{event.minute ?? "–"}{event.extra ? `+${event.extra}` : ""}′</span>
          <span className={styles.eventIcon} aria-hidden="true">{event.type === "goal" ? <SportsSoccerRounded /> : event.type === "card" ? "▰" : event.type === "substitution" ? "⇄" : "VAR"}</span>
          <div><strong>{event.label}</strong><p>{event.type === "substitution" ? "Sai: " : ""}{event.player ?? "Jogador não informado"}{event.relatedPlayer && <span>{event.type === "substitution" ? " · Entra: " : " · Assistência: "}{event.relatedPlayer}</span>}</p><small>{match[event.side].name}</small></div>
        </li>)}</ol> : <EmptySection>{scheduled ? "Os lances aparecerão aqui quando a partida começar e os dados estiverem disponíveis." : "Nenhum evento disponibilizado pela API para esta partida."}</EmptySection>}
      </section>

      <section id="escalacoes" className={styles.panel} aria-labelledby="lineups-heading"><h2 id="lineups-heading">Quem entra em campo</h2>
        <p className={styles.caption}>Escalações e reservas dependem da confirmação e da cobertura da competição.</p>
        <div className={styles.lineups}>{(["home", "away"] as const).map((side) => {
          const lineup = match.lineups.find((entry) => entry.side === side);
          return <div key={side} className={styles.lineup}><h3><TeamLogo src={match[side].logo} />{match[side].name}{lineup?.formation && <span>{lineup.formation}</span>}</h3>
            {lineup ? <><p className={styles.coach}>Técnico: {lineup.coach ?? "Não informado"}</p><h4>Titulares</h4>{lineup.starters.length ? <PlayerList players={lineup.starters} /> : <EmptySection>Titulares ainda não informados.</EmptySection>}<details className={styles.substitutes}><summary>Reservas ({lineup.substitutes.length})</summary>{lineup.substitutes.length ? <PlayerList players={lineup.substitutes} /> : <EmptySection>Reservas ainda não informados.</EmptySection>}</details></> : <EmptySection>Escalação ainda não disponibilizada.</EmptySection>}
          </div>;
        })}</div>
      </section>

      {match.players.length > 0 && <section id="jogadores" className={styles.panel} aria-labelledby="players-heading"><h2 id="players-heading">Desempenho dos jogadores</h2><p className={styles.caption}>A nota é fornecida pela API. O traço indica um dado não informado.</p>
        {(["home", "away"] as const).map((side) => {
          const players = match.players.filter((player) => player.side === side);
          return players.length > 0 && <div key={side}><h3>{match[side].name}</h3><div className={styles.tableScroll}><table className={styles.playersTable}><thead><tr>{["Jogador", "Minutos", "Nota", "Gols", "Assistências", "Defesas"].map((label) => <th scope="col" key={label}>{label}</th>)}</tr></thead><tbody>{players.map((player, index) => <tr key={index}><th scope="row">{player.name}</th><td>{player.minutes ?? "–"}</td><td>{player.rating?.replace(".", ",") ?? "–"}</td><td>{player.goals ?? "–"}</td><td>{player.assists ?? "–"}</td><td>{player.saves ?? "–"}</td></tr>)}</tbody></table></div></div>;
        })}
      </section>}

      <footer className={styles.footer}><p>Projeto educacional · Sem dinheiro real</p><p>Consultado em <time dateTime={match.fetchedAt}>{dateFormat.format(new Date(match.fetchedAt))}</time>. Os dados podem levar até 3 horas para atualizar.</p><a href="https://www.api-football.com/" target="_blank" rel="noopener noreferrer">Dados por API-Football ↗</a></footer>
    </main>
  </div>;
}
