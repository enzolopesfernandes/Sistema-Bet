"use client";

import { useEffect, useRef, useState } from "react";
import CloseRounded from "@mui/icons-material/CloseRounded";
import ReceiptLongOutlined from "@mui/icons-material/ReceiptLongOutlined";
import { BET_MESSAGES, BET_STATUS_LABELS, ITEM_RESULT_LABELS, formatCredits, formatOdd, isBetSummary, type BetSummary } from "@/lib/apostas";
import styles from "./apostas.module.scss";

const dateFormat = new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeStyle: "short", timeZone: "America/Sao_Paulo" });

export default function BetDetails({ id, onClose }: { id: string; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [bet, setBet] = useState<BetSummary | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const previousFocus = document.activeElement as HTMLElement | null;
    dialog.current?.showModal();
    async function load() {
      try {
        const response = await fetch(`/api/apostas/${encodeURIComponent(id)}`, { cache: "no-store", credentials: "same-origin", signal: controller.signal });
        const body = await response.json();
        if (!response.ok) throw new Error(body.message ?? BET_MESSAGES.detailsFailed);
        if (!isBetSummary(body.bet)) { setError(BET_MESSAGES.detailsInvalid); return; }
        setBet(body.bet);
      } catch (error) {
        if (!controller.signal.aborted) setError(error instanceof Error && error.message === BET_MESSAGES.detailsInvalid ? BET_MESSAGES.detailsInvalid : BET_MESSAGES.detailsFailed);
      }
    }
    void load();
    return () => { controller.abort(); previousFocus?.focus(); };
  }, [id]);

  return <dialog ref={dialog} className={styles.dialog} aria-labelledby="bet-details-title" onCancel={onClose} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className={styles.dialogContent}>
      <button type="button" className={styles.close} aria-label="Fechar detalhes e voltar ao histórico" onClick={onClose}><CloseRounded /></button>
      <span className={styles.dialogIcon}><ReceiptLongOutlined /></span>
      <h2 id="bet-details-title">Detalhes da aposta</h2>
      {error ? <><p className={styles.error} role="alert">{error}</p><button className={styles.outlineButton} type="button" onClick={onClose}>Voltar ao histórico</button></> : bet ? <>
        <span className={`${styles.status} ${styles[bet.status]}`}>{BET_STATUS_LABELS[bet.status]}</span>
        {bet.status === "PENDENTE" && <p className={styles.pendingNote} role="status">{BET_MESSAGES.pending}</p>}
        {bet.itens.map((item, index) => <section className={styles.betItem} key={index}><h3>{item.jogo}</h3><p>{item.mercado}</p><dl><div><dt>Seu palpite</dt><dd>{item.selecao}</dd></div><div><dt>Odd aplicada</dt><dd>{formatOdd(item.odd)}</dd></div><div><dt>Resultado da seleção</dt><dd>{ITEM_RESULT_LABELS[item.resultado]}</dd></div></dl></section>)}
        <dl className={styles.detailFacts}>
          {bet.promocao && <div><dt>Promoção aplicada</dt><dd>{bet.promocao}</dd></div>}
          <div><dt>Valor da aposta</dt><dd>{formatCredits(bet.valor)}</dd></div>
          <div><dt>Odd total</dt><dd>{formatOdd(bet.odd)}</dd></div>
          <div><dt>Possível retorno</dt><dd>{formatCredits(bet.retornoPotencial)}</dd></div>
          <div><dt>{bet.status === "ANULADA" ? "Créditos devolvidos" : "Valor obtido"}</dt><dd>{bet.valorObtido === null ? "Aguardando resultado" : formatCredits(bet.valorObtido)}</dd></div>
          <div><dt>Data da aposta · Brasília</dt><dd>{dateFormat.format(new Date(bet.criadaEm))}</dd></div>
          {bet.liquidadaEm && <div><dt>Conclusão · Brasília</dt><dd>{dateFormat.format(new Date(bet.liquidadaEm))}</dd></div>}
          <div><dt>Identificador</dt><dd className={styles.identifier}>{bet.id}</dd></div>
        </dl>
        <p className={styles.footnote}>Valores e retornos fictícios, sem dinheiro real.</p>
        <button type="button" className={styles.outlineButton} onClick={onClose}>Voltar ao histórico</button>
      </> : <p className={styles.loading} role="status">Carregando os detalhes da aposta…</p>}
    </div>
  </dialog>;
}
