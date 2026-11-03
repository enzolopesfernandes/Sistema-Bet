"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import AccountBalanceWalletOutlined from "@mui/icons-material/AccountBalanceWalletOutlined";
import ArrowBackRounded from "@mui/icons-material/ArrowBackRounded";
import CheckCircleOutlineRounded from "@mui/icons-material/CheckCircleOutlineRounded";
import Header, { type HeaderUser } from "@/components/layout/header/Header";
import { BET_MESSAGES, DEMO_METHOD, formatCredits, validateRecharge } from "@/lib/apostas";
import { useBalance } from "@/src/context/BalanceContext";
import styles from "./saldo.module.scss";

export default function RechargePage({ user }: { user: HeaderUser }) {
  const { balance, updateBalance } = useBalance();
  const [value, setValue] = useState("");
  const [method, setMethod] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const request = useRef<{ signature: string; key: string } | null>(null);
  const submitting = useRef(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const signature = JSON.stringify([value, method]);
    if (request.current?.signature !== signature) request.current = { signature, key: crypto.randomUUID() };
    const data = { valor: value, metodo: method, idempotencyKey: request.current.key };
    const validation = validateRecharge(data);
    setSuccess(false);
    if (!validation.data) { setError(validation.message); return; }
    setError(""); setPending(true); submitting.current = true;
    try {
      const response = await fetch("/api/saldo/recarga", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      const body = await response.json();
      if (!response.ok) { setError(body.message ?? BET_MESSAGES.rechargeFailed); return; }
      updateBalance(body.saldo);
      setSuccess(true); setValue(""); setMethod(""); request.current = null;
    } catch {
      setError(BET_MESSAGES.rechargeFailed);
    } finally { setPending(false); submitting.current = false; }
  }

  return <div className={styles.page}>
    <Header user={user} />
    <main className={styles.main}>
      <Link className={styles.back} href="/"><ArrowBackRounded /> Voltar à conta</Link>
      <div className={styles.heading}><span>SUA CONTA</span><h1>Recarregar saldo<span>.</span></h1><p>Mais créditos para viver a experiência do jogo.</p></div>
      <div className={styles.columns}>
        <section className={styles.card} aria-labelledby="recharge-title">
          <span className={styles.icon}><AccountBalanceWalletOutlined /></span>
          <h2 id="recharge-title">Adicione créditos fictícios</h2>
          <p>A recarga é gratuita e simulada. Nenhum pagamento é realizado.</p>
          {success && <div className={styles.success} role="status"><CheckCircleOutlineRounded /><div><strong>{BET_MESSAGES.rechargeSuccess}</strong><span>Novo saldo: {formatCredits(balance ?? "0")}</span></div></div>}
          <form onSubmit={submit} noValidate aria-busy={pending}>
            <fieldset disabled={pending}>
              <label htmlFor="recharge-value">Valor da recarga</label>
              <div className={styles.inputWrap}><input id="recharge-value" name="valor" type="text" inputMode="decimal" placeholder="0,00" value={value} maxLength={8} aria-describedby="recharge-limit" onChange={(event) => setValue(event.target.value)} /><span>créditos</span></div>
              <small id="recharge-limit">De 0,01 a 10.000,00 créditos por recarga.</small>
              <div className={styles.presets}>{[50, 100, 250, 500].map((amount) => <button type="button" key={amount} aria-pressed={value === String(amount)} onClick={() => setValue(String(amount))}>+ {amount}</button>)}</div>
              <label htmlFor="recharge-method">Método de pagamento simulado</label>
              <select id="recharge-method" name="metodo" value={method} onChange={(event) => setMethod(event.target.value)}><option value="">Selecione o método</option><option value={DEMO_METHOD}>Créditos de demonstração · Gratuito</option></select>
              {error && <p className={styles.error} role="alert">{error}</p>}
              <button className={styles.primary} type="submit">{pending ? "Recarregando…" : "Confirmar recarga simulada"}</button>
            </fieldset>
          </form>
          <Link className={styles.cancel} href="/">Cancelar e voltar à conta</Link>
        </section>
        <aside className={styles.aside}>
          <div className={styles.balanceCard}><span>SEU SALDO DISPONÍVEL</span><strong>{balance === null ? "Carregando…" : formatCredits(balance)}</strong><small>Uso exclusivo em apostas simuladas.</small></div>
          <div className={styles.note}><h2>Uma experiência para aprender</h2><p>Todos os valores são fictícios, sem valor financeiro e sem possibilidade de saque. Os retornos das apostas também são créditos de demonstração.</p><Link href="/apostas">Ver meu histórico de apostas →</Link></div>
        </aside>
      </div>
    </main>
  </div>;
}
