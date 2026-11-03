"use client";
import { useRef, useState } from "react";
import { WITHDRAW_METHOD, type WithdrawalView } from "@/lib/gestao";
import { formatCredits } from "@/lib/apostas";
import { useBalance } from "@/src/context/BalanceContext";
import OperationForm from "../gestao/OperationForm";
import styles from "../admin/admin.module.scss";
const labels: Record<string, string> = { PENDENTE: "Aguardando aprovação", APROVADO: "Aprovado e concluído na simulação", RECUSADO: "Recusado — créditos devolvidos" };
export default function WithdrawalsPanel({ items, admin }: { items: WithdrawalView[]; admin: boolean }) {
  const { balance, updateBalance } = useBalance(), key = useRef<string | null>(null);
  const [selected, setSelected] = useState<WithdrawalView | null>(null);
  const [notice, setNotice] = useState("");
  return <>{notice && <p role="status" className={styles.success}>{notice}</p>}
    {!admin && <section className={styles.card}><h2>Solicitar saque simulado</h2><p>Saldo disponível: {balance === null ? "Carregando…" : formatCredits(balance)}</p><p>Os créditos ficam indisponíveis ao solicitar. A aprovação conclui a simulação; uma recusa devolve os créditos.</p><OperationForm endpoint="/api/saques" method="POST" review="Confirma a solicitação? O valor será descontado do saldo disponível e aguardará aprovação administrativa." payload={f => { key.current ??= crypto.randomUUID(); return { valor: f.get("valor"), metodo: WITHDRAW_METHOD, idempotencyKey: key.current }; }} onSuccess={body => { key.current = null; if (typeof body.saldo === "string") updateBalance(body.saldo); }}><label>Valor em créditos<input name="valor" type="number" min="0.01" max="10000" step="0.01" required onChange={() => { key.current = null; }} /></label><label>Método de recebimento<select name="metodo"><option value={WITHDRAW_METHOD}>Retirada de créditos de demonstração</option></select></label></OperationForm></section>}
    {selected && <section className={styles.card}><h2>Analisar solicitação</h2><p>{selected.usuario} · {selected.email} · {formatCredits(selected.valor)}</p><p>Método: retirada de créditos de demonstração</p><OperationForm key={selected.id} endpoint={`/api/admin/saques/${selected.id}`} review="Confirma a decisão sobre este saque? A aprovação não desconta o saldo novamente." payload={f => Object.fromEntries(f)} onCancel={() => setSelected(null)} onSuccess={body => { setNotice(String(body.message ?? "Operação realizada com sucesso")); setSelected(null); }}><label>Decisão<select name="decisao"><option value="APROVADO">Aprovar e concluir simulação</option><option value="RECUSADO">Recusar e devolver créditos</option></select></label><label>Motivo (obrigatório na recusa)<textarea name="motivo" maxLength={500} /></label></OperationForm></section>}
    <h2>{admin ? "Solicitações pendentes" : "Histórico de saques"}</h2>
    {!items.length && <p className={styles.empty}>{admin ? "Não existem solicitações de saque pendentes" : "Você ainda não solicitou saques"}</p>}
    {items.map(row => <article key={row.id} className={styles.card}><h3>{formatCredits(row.valor)} · {labels[row.status]}</h3>{admin && <p>{row.usuario} · {row.email}</p>}<p>Solicitado em {new Date(row.criadoEm).toLocaleString("pt-BR")}</p>{row.decididoEm && <p>Decidido em {new Date(row.decididoEm).toLocaleString("pt-BR")}</p>}{row.motivo && <p>Motivo: {row.motivo}</p>}{admin && <button onClick={() => setSelected(row)}>Analisar solicitação</button>}</article>)}
  </>;
}
