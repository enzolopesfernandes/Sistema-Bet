"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { OUTCOMES, OUTCOME_LABELS, validOdd, type OddsValues, type OddsHistory } from "@/lib/admin";
import type { Match } from "@/src/lib/jogos/types";
import styles from "./admin.module.scss";

const date = (value: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }).format(new Date(value));
const values = (match: Match): OddsValues => ({ home: match.odds!.home.toFixed(4), draw: match.odds!.draw.toFixed(4), away: match.odds!.away.toFixed(4) });

function History({ id }: { id: number }) {
  const [rows, setRows] = useState<OddsHistory[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/admin/odds/${id}`, { signal: controller.signal, cache: "no-store" }).then(async (response) => {
      if (!response.ok) throw new Error();
      const body = await response.json();
      if (!Array.isArray(body.history)) throw new Error();
      if (!controller.signal.aborted) setRows(body.history);
    }).catch(() => { if (!controller.signal.aborted) setError("Não foi possível carregar o histórico de alterações"); });
    return () => controller.abort();
  }, [id]);
  return <details className={styles.history}><summary>Últimas 20 alterações de cotação</summary>
    {error ? <p role="alert">{error}</p> : rows === null ? <p>Carregando histórico…</p> : !rows.length ? <p>Nenhuma alteração administrativa registrada.</p> : <ul>{rows.map((row) => <li key={row.id}><strong>{row.selecao}: {row.anterior} → {row.nova}</strong><span>{row.admin} · {date(row.alteradaEm)}</span>{row.motivo && <p>{row.motivo}</p>}</li>)}</ul>}
  </details>;
}

export default function OddsPanel({ matches, failed }: { matches: Match[]; failed: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const router = useRouter();
  const [selected, setSelected] = useState<Match | null>(null);
  const [review, setReview] = useState<{ odds: OddsValues; motivo: string } | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [historyKey, setHistoryKey] = useState(0);
  function close() { if (!pending) { dialog.current?.close(); trigger.current?.focus(); } }
  function open(match: Match, button: HTMLButtonElement) {
    trigger.current = button; setSelected(match); setReview(null); setError(""); setMessage(""); setHistoryKey((key) => key + 1); dialog.current?.showModal();
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const odds = Object.fromEntries(OUTCOMES.map((outcome) => [outcome, String(form.get(outcome)).trim().replace(",", ".")])) as OddsValues;
    if (!OUTCOMES.every((outcome) => validOdd(odds[outcome]))) { setError("Informe valores válidos para as odds: maiores que 1, com até quatro casas decimais."); return; }
    setError(""); setReview({ odds, motivo: String(form.get("motivo")).trim() });
  }
  async function save() {
    if (!selected || !review || pending) return;
    setPending(true); setError("");
    try {
      const response = await fetch(`/api/admin/odds/${selected.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...review, anterior: values(selected) }) });
      const body = await response.json();
      if (!response.ok) { setError(body.message || "Não foi possível atualizar as odds neste momento"); return; }
      setMessage(`Odds atualizadas com sucesso: mandante ${body.odds.home}, empate ${body.odds.draw}, visitante ${body.odds.away}.`);
      dialog.current?.close(); trigger.current?.focus(); router.refresh();
    } catch { setError("Não foi possível confirmar a alteração. Atualize a página para consultar as odds."); }
    finally { setPending(false); }
  }
  return <section aria-label="Jogos para configuração de odds">
    <p className={styles.note}>Partidas futuras da consulta de jogos. Use o ID da API-Football para consultar uma partida específica. Horários de Brasília.</p>
    {message && <p className={styles.success} role="status">{message}</p>}
    {!failed && !matches.length && <p className={styles.empty}>Nenhum jogo disponível para configuração de odds</p>}
    {matches.length > 0 && <div className={styles.tableScroll}><table className={styles.table}>
      <thead><tr><th>Jogo</th><th>Início</th><th>Mandante</th><th>Empate</th><th>Visitante</th><th>Ação</th></tr></thead>
      <tbody>{matches.map((match) => <tr key={match.id}><th scope="row">{match.home.name} × {match.away.name}<small>{match.league} · ID {match.id}</small><small>{match.odds?.source}</small></th><td>{date(match.date)}</td>{OUTCOMES.map((outcome) => <td key={outcome}>{match.odds?.[outcome].toFixed(4) ?? "—"}</td>)}<td><button disabled={!match.odds} onClick={(event) => open(match, event.currentTarget)}>Definir odds</button></td></tr>)}</tbody>
    </table></div>}
    <dialog ref={dialog} className={styles.dialog} aria-labelledby="odds-title" onCancel={(event) => { if (pending) event.preventDefault(); }} onClose={() => trigger.current?.focus()}>
      {selected && <div className={styles.dialogContent}>
        <h2 id="odds-title">{review ? "Confirmar novas odds" : "Definir odds"}</h2><p>{selected.home.name} × {selected.away.name}</p><p className={styles.note}>Resultado no tempo regulamentar · 1X2</p>
        <form key={`${selected.id}-${historyKey}`} onSubmit={submit} hidden={Boolean(review)} className={styles.form}>
          <div className={styles.oddsFields}>{OUTCOMES.map((outcome) => <label key={outcome}>{OUTCOME_LABELS[outcome]}<input name={outcome} inputMode="decimal" required maxLength={13} defaultValue={values(selected)[outcome]} /><small>Atual: {values(selected)[outcome]}</small></label>)}</div>
          <p className={styles.note}>Valores maiores que 1 e menores que 100.000.000, com até quatro casas decimais. Apostas anteriores mantêm a cotação contratada.</p>
          <label>Motivo da alteração (opcional)<textarea name="motivo" maxLength={500} rows={3} /></label>
          <div className={styles.actions}><button type="button" onClick={close}>Cancelar</button><button className={styles.primary} type="submit">Revisar alteração</button></div>
        </form>
        {review && <><dl>{OUTCOMES.map((outcome) => <div key={outcome}><dt>{OUTCOME_LABELS[outcome]}</dt><dd>{values(selected)[outcome]} → {review.odds[outcome]}</dd></div>)}</dl><p>{review.motivo}</p><p>Estas cotações passarão a ser usadas nas novas apostas.</p><div className={styles.actions}><button disabled={pending} onClick={close}>Cancelar</button><button disabled={pending} onClick={() => setReview(null)}>Voltar à edição</button><button className={styles.primary} disabled={pending} onClick={save}>{pending ? "Salvando…" : "Confirmar alteração"}</button></div></>}
        {error && <p role="alert" className={styles.error}>{error} <a href={`/admin?aba=odds&jogo=${selected.id}`}>Atualizar jogo</a></p>}
        <History key={historyKey} id={selected.id} />
      </div>}
    </dialog>
  </section>;
}
