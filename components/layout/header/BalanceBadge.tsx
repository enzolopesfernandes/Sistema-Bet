"use client";

import Link from "next/link";
import { useEffect } from "react";
import AddRounded from "@mui/icons-material/AddRounded";
import { useBalance } from "@/src/context/BalanceContext";
import { formatCredits } from "@/lib/apostas";
import styles from "./header.module.scss";

const amountFormat = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function BalanceBadge({ account }: { account: string }) {
  const { balance, error, refreshBalance } = useBalance();
  useEffect(() => {
    void refreshBalance();
    const refresh = () => { void refreshBalance(); };
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [account, refreshBalance]);

  return <div className={styles.balance}>
    <div><span>Saldo fictício</span><strong aria-live="polite" aria-label={!error && balance !== null ? formatCredits(balance) : undefined}>{error ? "Indisponível" : balance === null ? "Carregando…" : amountFormat.format(Number(balance))}</strong></div>
    {error ? <button type="button" aria-label="Tentar carregar o saldo novamente" onClick={() => void refreshBalance()}>↻</button> : <Link href="/saldo" prefetch={false} aria-label="Recarregar saldo"><AddRounded /></Link>}
  </div>;
}
