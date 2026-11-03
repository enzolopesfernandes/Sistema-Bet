"use client";

import Link from "next/link";
import { useState } from "react";
import HistoryRounded from "@mui/icons-material/HistoryRounded";
import ArrowBackRounded from "@mui/icons-material/ArrowBackRounded";
import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import Header, { type HeaderUser } from "@/components/layout/header/Header";
import { BET_MESSAGES, BET_STATUS_LABELS, formatCredits, formatOdd, type BetPagination, type BetSummary } from "@/lib/apostas";
import BetDetails from "./BetDetails";
import HistoryActions from "./HistoryActions";
import styles from "./apostas.module.scss";

const dateFormat = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });

export default function BetHistoryPage({ user, bets, pagination, error, initialBetId }: {
  user: HeaderUser; bets: BetSummary[]; pagination: BetPagination; error?: string; initialBetId?: string;
}) {
  const [selected, setSelected] = useState<string | null>(initialBetId ?? null);
  const href = (page: number, pageSize = pagination.pageSize) => `/apostas?page=${page}&pageSize=${pageSize}`;

  return <div className={styles.page}>
    <Header user={user} />
    <main className={styles.main}>
      <Link className={styles.back} href="/"><ArrowBackRounded /> Voltar à conta</Link>
      <div className={styles.heading}><div><span>SUA TRAJETÓRIA</span><h1>Histórico de Apostas<span>.</span></h1><p>Seus palpites, resultados e créditos em um só lugar.</p></div><Link className={styles.rechargeLink} href="/saldo">Recarregar saldo <ArrowForwardRounded /></Link></div>
      <div className={styles.toolbar}><span><HistoryRounded /> {pagination.total} {pagination.total === 1 ? "aposta registrada" : "apostas registradas"}</span>{!error && <HistoryActions hasPending={bets.some((bet) => bet.status === "PENDENTE")} />}</div>
      {error ? <section className={styles.empty}><HistoryRounded /><h2>Histórico indisponível</h2><p role="alert">{error}</p><Link href={href(pagination.page)} prefetch={false}>Tentar novamente</Link></section> : bets.length ? <>
        <div className={styles.tableScroll}><table className={styles.table}><thead><tr><th scope="col">Jogo e palpite</th><th scope="col">Data · Brasília</th><th scope="col">Valor / Odd</th><th scope="col">Status</th><th scope="col">Possível retorno</th><th scope="col"><span className={styles.srOnly}>Ações</span></th></tr></thead><tbody>{bets.map((bet) => <tr key={bet.id}>
          <th scope="row"><strong>{bet.itens.map((item) => item.jogo).join(" + ")}</strong><small>{bet.itens.map((item) => item.selecao).join(" + ")}</small></th>
          <td><time dateTime={bet.criadaEm}>{dateFormat.format(new Date(bet.criadaEm))}</time></td>
          <td><strong>{formatCredits(bet.valor)}</strong><small>Odd {formatOdd(bet.odd)}</small></td>
          <td><span className={`${styles.status} ${styles[bet.status]}`}>{BET_STATUS_LABELS[bet.status]}</span></td>
          <td><strong className={styles.return}>{formatCredits(bet.retornoPotencial)}</strong>{bet.valorObtido !== null && <small>{bet.status === "ANULADA" ? "Devolvido" : "Obtido"}: {formatCredits(bet.valorObtido)}</small>}</td>
          <td><button type="button" className={styles.detailsButton} aria-label={`Ver detalhes da aposta em ${bet.itens[0].jogo}`} onClick={() => setSelected(bet.id)}>Detalhes <ArrowForwardRounded /></button></td>
        </tr>)}</tbody></table></div>
        <div className={styles.paginationBar}><span>{(pagination.page - 1) * pagination.pageSize + 1}–{Math.min(pagination.page * pagination.pageSize, pagination.total)} de {pagination.total} apostas</span><div className={styles.pageSizes}>Por página: {[10, 20].map((size) => <Link key={size} href={href(1, size)} prefetch={false} aria-current={pagination.pageSize === size ? "true" : undefined}>{size}</Link>)}</div><nav className={styles.pagination} aria-label="Paginação do histórico">{pagination.page > 1 ? <Link href={href(pagination.page - 1)} prefetch={false} aria-label="Página anterior"><ArrowBackRounded /></Link> : <span aria-disabled="true"><ArrowBackRounded /></span>}<span>{pagination.page} de {pagination.totalPages}</span>{pagination.page < pagination.totalPages ? <Link href={href(pagination.page + 1)} prefetch={false} aria-label="Próxima página"><ArrowForwardRounded /></Link> : <span aria-disabled="true"><ArrowForwardRounded /></span>}</nav></div>
      </> : <section className={styles.empty}><HistoryRounded /><h2>Seu próximo palpite começa aqui</h2><p>{BET_MESSAGES.historyEmpty}</p><Link href="/">Explorar jogos <ArrowForwardRounded /></Link></section>}
      <p className={styles.footnote}>Projeto educacional · Créditos fictícios, sem dinheiro real. Os resultados dependem da disponibilidade da API e podem levar até 3 horas para atualizar.</p>
    </main>
    {selected && <BetDetails key={selected} id={selected} onClose={() => setSelected(null)} />}
  </div>;
}
