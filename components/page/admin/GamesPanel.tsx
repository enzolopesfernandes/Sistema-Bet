"use client";
import Link from "next/link";
import { useState } from "react";
import type { GameView } from "@/lib/gestao";
import OperationForm from "../gestao/OperationForm";
import styles from "./admin.module.scss";

export const localDate = (date: string) => { const value = new Date(date); return new Date(value.getTime() - value.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
export default function GamesPanel({ games }: { games: GameView[] }) {
  const [selected, setSelected] = useState<GameView | "novo" | null>(null), [action, setAction] = useState("salvar");
  const [notice, setNotice] = useState("");
  const game = selected && selected !== "novo" ? selected : null;
  function choose(row: GameView | "novo", next: string) { setSelected(row); setAction(next); }
  return <>{notice && <p role="status" className={styles.success}>{notice}</p>}
    <button onClick={() => choose("novo", "salvar")}>Cadastrar jogo</button>
    {selected && <section className={styles.card}><h2>{game ? `${game.mandante} × ${game.visitante}` : "Novo jogo"}</h2>
      <OperationForm key={`${game?.id ?? "novo"}:${action}`} endpoint={`/api/admin/jogos${game ? `/${game.id}` : ""}`} method={game ? "PATCH" : "POST"} review={action === "remover" ? "Remover este jogo da listagem?" : action === "cancelar" ? "Cancelar a partida? As apostas poderão ser estornadas ao atualizar os resultados no histórico." : action === "resultado" ? "Confirma o placar do tempo regulamentar? O resultado será definitivo e usado na liquidação das apostas." : "Confirma os dados e as cotações deste jogo?"} onCancel={() => setSelected(null)} onSuccess={body => { setNotice(String(body.message ?? "Operação realizada com sucesso")); setSelected(null); }} payload={f => ({ acao: action, versao: game?.versao, ...(action === "salvar" ? { mandante: f.get("mandante"), visitante: f.get("visitante"), campeonato: f.get("campeonato"), inicio: new Date(String(f.get("inicio"))).toISOString(), odds: { home: f.get("home"), draw: f.get("draw"), away: f.get("away") } } : action === "resultado" ? { mandante: Number(f.get("mandante")), visitante: Number(f.get("visitante")) } : {}) })}>
        {action === "salvar" && <><div className={styles.grid}><label>Mandante<input name="mandante" defaultValue={game?.mandante} required maxLength={150} /></label><label>Visitante<input name="visitante" defaultValue={game?.visitante} required maxLength={150} /></label><label>Campeonato<input name="campeonato" defaultValue={game?.campeonato} required maxLength={150} /></label><label>Início (horário deste computador)<input type="datetime-local" name="inicio" defaultValue={game ? localDate(game.inicio) : ""} required /></label></div><div className={styles.oddsFields}>{(["home", "draw", "away"] as const).map((o, i) => <label key={o}>Odd: {["mandante", "empate", "visitante"][i]}<input name={o} type="number" step="0.0001" min="1.0001" max="99999999.9999" required defaultValue={game?.odds[o] ?? "2"} /></label>)}</div></>}
        {action === "resultado" && <div className={styles.grid}><label>Gols do mandante<input type="number" name="mandante" min={0} max={99} required /></label><label>Gols do visitante<input type="number" name="visitante" min={0} max={99} required /></label></div>}
        {(action === "remover" || action === "cancelar") && <p>{action === "remover" ? "Jogos com apostas não podem ser removidos." : "O cancelamento encerra novas apostas e preserva o histórico."}</p>}
      </OperationForm></section>}
    {!games.length && <p className={styles.empty}>Nenhum jogo cadastrado no sistema.</p>}
    {games.map(row => <article className={styles.card} key={row.id}><h2>{row.mandante} × {row.visitante}</h2><p>{row.campeonato} · {new Date(row.inicio).toLocaleString("pt-BR")} · {row.status}</p><p>ID: {row.fixtureId} {row.fixtureId < 0 && "· Partida local"}{row.resultado && ` · ${row.resultado}`}</p><div className={styles.actions}><Link href={`/jogos/${row.fixtureId}`} prefetch={false}>Ver partida</Link><Link href={`/admin?aba=odds&jogo=${row.fixtureId}`} prefetch={false}>Definir odds</Link>{!["ENCERRADO", "CANCELADO"].includes(row.status) && <><button onClick={() => choose(row, "salvar")}>Editar</button><button onClick={() => choose(row, "resultado")}>Informar resultado</button><button onClick={() => choose(row, "cancelar")}>Cancelar partida</button><button onClick={() => choose(row, "remover")}>Remover</button></>}</div></article>)}
  </>;
}
