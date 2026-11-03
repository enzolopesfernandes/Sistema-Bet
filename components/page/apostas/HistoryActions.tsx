"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import RefreshRounded from "@mui/icons-material/RefreshRounded";
import { useBalance } from "@/src/context/BalanceContext";
import styles from "./apostas.module.scss";

export default function HistoryActions({ hasPending }: { hasPending: boolean }) {
  const router = useRouter();
  const { refreshBalance } = useBalance();
  const [pending, setPending] = useState(hasPending);
  const [message, setMessage] = useState("");
  const running = useRef(false);
  const applyResult = useCallback(async (body: { updated: number; unavailable: boolean }, automatic: boolean) => {
    if (body.updated) { await refreshBalance(); router.refresh(); }
    else if (!automatic) router.refresh();
    setMessage(body.unavailable ? "Alguns resultados estão indisponíveis. As apostas aguardam confirmação." : body.updated ? "Resultados e saldo atualizados." : automatic ? "" : "Consulta concluída. Os resultados disponíveis estão atualizados.");
  }, [refreshBalance, router]);

  async function update() {
    if (running.current) return;
    running.current = true;
    try {
      const response = await fetch("/api/apostas/atualizar-resultados", { method: "POST", credentials: "same-origin" });
      const body = await response.json();
      if (!response.ok) throw new Error();
      await applyResult(body, false);
    } catch { setMessage("Não foi possível atualizar os resultados. Tente novamente."); }
    finally { setPending(false); running.current = false; }
  }

  useEffect(() => {
    if (!hasPending) return;
    const controller = new AbortController();
    running.current = true;
    fetch("/api/apostas/atualizar-resultados", { method: "POST", credentials: "same-origin", signal: controller.signal })
      .then((response) => { if (!response.ok) throw new Error(); return response.json(); })
      .then((body) => { if (!controller.signal.aborted) { setPending(false); running.current = false; return applyResult(body, true); } })
      .catch(() => { if (!controller.signal.aborted) setMessage("Não foi possível atualizar os resultados. Tente novamente."); })
      .finally(() => { if (!controller.signal.aborted) { setPending(false); running.current = false; } });
    return () => { controller.abort(); running.current = false; };
  }, [hasPending, applyResult]);

  return <div className={styles.refreshArea}><button type="button" className={styles.outlineButton} disabled={pending} onClick={() => { setPending(true); setMessage(""); void update(); }}><RefreshRounded />{pending ? "Consultando resultados…" : "Atualizar resultados"}</button>{message && <p role="status">{message}</p>}</div>;
}
