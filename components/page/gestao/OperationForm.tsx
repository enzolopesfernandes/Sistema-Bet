"use client";
import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import styles from "../admin/admin.module.scss";

/** Confirma os dados capturados sem permitir alterações durante o envio. */
export default function OperationForm({ endpoint, method = "PATCH", payload, children, review, onSuccess, onCancel }: { endpoint: string; method?: "POST" | "PATCH"; payload: (form: FormData) => unknown; children: React.ReactNode; review: string; onSuccess?: (body: Record<string, unknown>) => void; onCancel?: () => void }) {
  const router = useRouter(), form = useRef<HTMLFormElement>(null), lock = useRef(false);
  const [draft, setDraft] = useState<unknown>(null), [pending, setPending] = useState(false), [message, setMessage] = useState(""), [error, setError] = useState("");
  function prepare(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setError(""); setMessage(""); try { setDraft(payload(new FormData(event.currentTarget))); } catch { setError("Verifique os campos e as datas informadas"); } }
  async function confirm() {
    if (lock.current) return;
    lock.current = true; setPending(true); setError("");
    try {
      const response = await fetch(endpoint, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) });
      const body = await response.json();
      if (!response.ok) { setError(body.message ?? "Não foi possível concluir a operação"); return; }
      setMessage(body.message ?? "Operação realizada com sucesso"); setDraft(null); form.current?.reset(); onSuccess?.(body); router.refresh();
    } catch { setError("Não foi possível confirmar a operação. Tente novamente com os mesmos dados."); }
    finally { lock.current = false; setPending(false); }
  }
  return <form ref={form} onSubmit={prepare} className={styles.form} aria-busy={pending}>
    <fieldset disabled={pending || draft !== null} className={styles.fields}>{children}</fieldset>
    {draft === null ? <div className={styles.actions}><button type="submit">Revisar operação</button>{onCancel && <button type="button" onClick={onCancel}>Cancelar</button>}</div> : <div className={styles.review} role="region" aria-label="Confirmação"><p>{review}</p><p>Confira os dados acima antes de confirmar.</p><div className={styles.actions}><button type="button" disabled={pending} onClick={() => { setDraft(null); setError(""); }}>Voltar à edição</button><button type="button" disabled={pending} onClick={() => { setDraft(null); setError(""); form.current?.reset(); onCancel?.(); }}>Cancelar</button><button type="button" disabled={pending} onClick={confirm}>{pending ? "Salvando…" : "Confirmar operação"}</button></div></div>}
    {error && <p role="alert" className={styles.error}>{error}</p>}{message && <p role="status" className={styles.success}>{message}</p>}
  </form>;
}
