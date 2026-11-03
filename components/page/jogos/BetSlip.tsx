"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { PromotionView } from "@/lib/gestao";
import ReceiptLongOutlined from "@mui/icons-material/ReceiptLongOutlined";
import { formatCredits, formatOdd, parseAmount, type BetOutcome } from "@/lib/apostas";
import { useBalance } from "@/src/context/BalanceContext";
import type { MatchOdds } from "@/src/lib/jogos/types";
import styles from "./bet-slip.module.scss";

export default function BetSlip({ match, authenticated }: {
  match: { id: number; date: string; home: { name: string }; away: { name: string }; odds: MatchOdds };
  authenticated: boolean;
}) {
  const { balance, updateBalance } = useBalance();
  const [selection, setSelection] = useState<BetOutcome | null>(null);
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [betId, setBetId] = useState("");
  const [promotions, setPromotions] = useState<PromotionView[]>([]);
  const [promotionId, setPromotionId] = useState("");
  const [promotionError, setPromotionError] = useState("");
  useEffect(() => {
    if (!authenticated) return;
    const controller = new AbortController();
    fetch(`/api/promocoes?jogo=${match.id}`, { signal: controller.signal, cache: "no-store" }).then(async response => {
      if (!response.ok) throw new Error();
      const body = await response.json();
      setPromotions(body.items);
    }).catch(() => { if (!controller.signal.aborted) setPromotionError("Não foi possível carregar as promoções. Você pode continuar sem promoção ou atualizar a página."); });
    return () => controller.abort();
  }, [authenticated, match.id, betId]);
  const request = useRef<{ signature: string; key: string } | null>(null);
  const submitting = useRef(false);
  const amount = parseAmount(value);
  const odd = selection ? match.odds[selection] : null;
  const promotion = promotions.find(p => p.id === promotionId);
  const effectiveOdd = odd && promotion?.tipo === "ODDS_BOOST" ? Number((1 + (odd - 1) * (1 + Number(promotion.beneficio) / 100)).toFixed(4)) : odd;
  const selectionLabel = selection === "draw" ? "Empate" : selection ? match[selection].name : "";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    setError("");
    if (!selection || !odd) { setError("Selecione um resultado para apostar"); return; }
    if (!amount) { setError("Informe um valor válido para a aposta"); return; }
    if (promotion && Number(amount) < Number(promotion.minimo)) { setError(`Esta promoção exige uma aposta de pelo menos ${formatCredits(promotion.minimo)}`); return; }
    const signature = JSON.stringify([selection, amount, odd, promotion?.id, promotion?.versao]);
    if (request.current?.signature !== signature) request.current = { signature, key: crypto.randomUUID() };
    setPending(true); submitting.current = true;
    try {
      const response = await fetch("/api/apostas", {
        method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jogoId: match.id, selecao: selection, valor: amount, odd: String(odd), idempotencyKey: request.current.key, promocaoId: promotion?.id, promocaoVersao: promotion?.versao }),
      });
      const body = await response.json();
      if (!response.ok) { setError(body.message ?? "Não foi possível registrar a aposta. Tente novamente."); return; }
      updateBalance(body.saldo); setBetId(body.id); request.current = null;
    } catch { setError("Não foi possível confirmar a aposta. Tente novamente com os mesmos dados."); }
    finally { setPending(false); submitting.current = false; }
  }

  return <section id="apostar" className={styles.slip} aria-labelledby="bet-title">
    <div className={styles.heading}><span><ReceiptLongOutlined /> APOSTA SIMULADA</span><h2 id="bet-title">Qual é o seu palpite?</h2><p>Resultado no tempo regulamentar · 90 minutos e acréscimos.</p></div>
    {betId ? <div className={styles.success} role="status"><strong>Aposta simulada registrada com sucesso</strong><p>Seu palpite: {selectionLabel}. Acompanhe o resultado no histórico.</p><Link href={`/apostas?aposta=${betId}`} prefetch={false}>Ver minha aposta →</Link><button type="button" onClick={() => { setBetId(""); setValue(""); setSelection(null); }}>Fazer outra aposta</button></div> : <form onSubmit={submit} noValidate aria-busy={pending}>
      <fieldset disabled={pending}>
        <legend>Escolha o resultado da partida</legend>
        <div className={styles.selections}>{(["home", "draw", "away"] as const).map((outcome) => <button key={outcome} type="button" aria-pressed={selection === outcome} onClick={() => setSelection(outcome)}><span>{outcome === "home" ? "1 · Mandante" : outcome === "draw" ? "X · Empate" : "2 · Visitante"}</span><strong>{outcome === "draw" ? "Empate" : match[outcome].name}</strong><em>{formatOdd(match.odds[outcome])}</em></button>)}</div>
        {authenticated ? <>
          <div className={styles.formRow}><div><label htmlFor="bet-amount">Valor da aposta em créditos</label><input id="bet-amount" name="valor" type="text" inputMode="decimal" placeholder="Ex.: 10,00" maxLength={8} value={value} onChange={(event) => setValue(event.target.value)} aria-describedby="bet-limits" /><small id="bet-limits">De 0,01 a 10.000,00 créditos por aposta.</small></div><div className={styles.estimate}><span>Possível retorno</span><strong>{amount && effectiveOdd ? formatCredits(Number(amount) * effectiveOdd) : "—"}</strong><small>Inclui o valor da aposta.</small></div></div>
          <div className={styles.promotion}><label htmlFor="bet-promotion">Promoção (opcional)</label><select id="bet-promotion" value={promotionId} onChange={e => setPromotionId(e.target.value)}><option value="">Sem promoção</option>{promotions.map(p => <option key={p.id} value={p.id}>{p.nome} · mínimo {p.minimo} créditos</option>)}</select>{promotion ? <p>{promotion.descricao} · {promotion.tipo === "BONUS_CREDITO" ? `${formatCredits(promotion.beneficio)} de bônus após confirmar` : `${promotion.beneficio}% sobre o lucro da odd; odd final ${effectiveOdd ? formatOdd(effectiveOdd) : "depende da seleção"}`}. Válida até {new Date(promotion.fim).toLocaleString("pt-BR")}.</p> : <p>{promotionError || (!promotions.length ? "Nenhuma promoção disponível para esta aposta." : "Escolha um benefício ou continue sem promoção.")}</p>}</div>
          <div className={styles.available}><span>Saldo disponível: {balance === null ? "Carregando…" : formatCredits(balance)}</span><Link href="/saldo">Recarregar saldo</Link></div>
          {error && <p className={styles.error} role="alert">{error}</p>}
          <button className={styles.confirm} type="submit">{pending ? "Confirmando aposta…" : "Confirmar aposta simulada"}</button>
        </> : <p className={styles.login}><Link href="/login">Entre na sua conta</Link> para confirmar seu palpite com créditos fictícios.</p>}
      </fieldset>
    </form>}
    <p className={styles.disclaimer}>Sem dinheiro real. Créditos e retornos fictícios, sem possibilidade de saque. Partidas canceladas devolvem os créditos apostados.</p>
  </section>;
}
