"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { AdminUser } from "@/lib/admin";
import styles from "./admin.module.scss";

const labels = { ATIVO: "Ativa", BLOQUEADO: "Bloqueada", SUSPENSO: "Suspensa" };

export default function UsersPanel({ users, search, failed }: { users: AdminUser[]; search: string; failed: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [selected, setSelected] = useState<AdminUser | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [review, setReview] = useState<{ nome: string; email: string; status: string } | null>(null);
  const [editKey, setEditKey] = useState(0);
  const trigger = useRef<HTMLButtonElement | null>(null);

  function close() { if (!pending) { dialog.current?.close(); trigger.current?.focus(); } }
  function open(user: AdminUser, button: HTMLButtonElement) {
    trigger.current = button; setSelected(user); setReview(null); setError(""); setMessage(""); setEditKey((key) => key + 1); dialog.current?.showModal();
  }
  async function save() {
    if (!selected || !review || pending) return;
    setPending(true); setError("");
    try {
      const response = await fetch(`/api/admin/usuarios/${selected.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...review, anterior: selected }) });
      const body = await response.json();
      if (!response.ok) { setError(body.message || "Não foi possível concluir a operação neste momento"); return; }
      setMessage(body.message); dialog.current?.close(); trigger.current?.focus(); router.refresh();
    } catch { setError("Não foi possível confirmar a operação. Atualize a página para consultar a conta."); }
    finally { setPending(false); }
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setReview({ nome: String(form.get("nome")).trim(), email: String(form.get("email")).trim().toLowerCase(), status: String(form.get("status")) });
    setError("");
  }

  return <section aria-label="Usuários cadastrados">
    {message && <p className={styles.success} role="status">{message}</p>}
    {!failed && !users.length && <p className={styles.empty}>{search ? "Nenhum usuário encontrado com os critérios informados" : "Nenhum usuário cadastrado foi encontrado"}</p>}
    {users.length > 0 && <div className={styles.tableScroll}><table className={styles.table}>
      <thead><tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Situação</th><th>Ação</th></tr></thead>
      <tbody>{users.map((user) => <tr key={user.id}><th scope="row">{user.nome}</th><td>{user.email}</td><td>{user.papel === "ADMINISTRADOR" ? "Administrador" : "Apostador"}</td><td>{labels[user.status]}</td><td><button type="button" onClick={(event) => open(user, event.currentTarget)}>Consultar / editar</button></td></tr>)}</tbody>
    </table></div>}
    <dialog ref={dialog} className={styles.dialog} aria-labelledby="user-title" onCancel={(event) => { if (pending) event.preventDefault(); }} onClose={() => trigger.current?.focus()}>
      {selected && <div className={styles.dialogContent}>
        <h2 id="user-title">{review ? "Confirmar alteração" : "Informações da conta"}</h2>
        <p className={styles.note}>Identificador: {selected.id}</p>
        {selected.papel === "ADMINISTRADOR" ? <><dl><dt>Nome</dt><dd>{selected.nome}</dd><dt>E-mail</dt><dd>{selected.email}</dd><dt>Situação</dt><dd>{labels[selected.status]}</dd></dl><p>Contas administrativas estão disponíveis somente para consulta neste painel.</p><button onClick={close}>Voltar à administração</button></> : <>
          <form key={`${selected.id}-${editKey}`} onSubmit={submit} hidden={Boolean(review)} className={styles.form}>
            <label>Nome<input name="nome" defaultValue={selected.nome} required maxLength={120} /></label>
            <label>E-mail<input name="email" type="email" defaultValue={selected.email} required maxLength={255} /></label>
            <label>Situação da conta<select name="status" defaultValue={selected.status}><option value="ATIVO">Ativa (desbloqueada)</option><option value="BLOQUEADO">Bloqueada</option>{selected.status === "SUSPENSO" && <option value="SUSPENSO">Manter suspensa</option>}</select></label>
            <div className={styles.actions}><button type="button" onClick={close}>Cancelar</button><button className={styles.primary} type="submit">Revisar alteração</button></div>
          </form>
          {review && <><dl><dt>Nome</dt><dd>{review.nome}</dd><dt>E-mail</dt><dd>{review.email}</dd><dt>Situação</dt><dd>{labels[review.status as keyof typeof labels]}</dd></dl>
            {(review.status !== "ATIVO" || review.email !== selected.email) && <p>As sessões desta conta serão encerradas. O acesso só será permitido quando a conta estiver ativa.</p>}
            <div className={styles.actions}><button disabled={pending} onClick={close}>Cancelar</button><button disabled={pending} onClick={() => setReview(null)}>Voltar à edição</button><button className={styles.primary} disabled={pending} onClick={save}>{pending ? "Salvando…" : "Confirmar alteração"}</button></div>
          </>}
        </>}
        {error && <p role="alert" className={styles.error}>{error} <a href="/admin">Atualizar lista</a></p>}
      </div>}
    </dialog>
  </section>;
}
