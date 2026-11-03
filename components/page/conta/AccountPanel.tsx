"use client";
import { useState } from "react";
import OperationForm from "../gestao/OperationForm";
import styles from "../admin/admin.module.scss";
export default function AccountPanel({ account, admin }: { account: { nome: string; email: string; anterior: string }; admin: boolean }) {
  const [action, setAction] = useState("dados");
  return <section className={styles.card}>
    <nav className={styles.actions} aria-label="Operações da conta">{[["dados", "Editar dados"], ["senha", "Alterar senha"], ...(!admin ? [["excluir", "Excluir conta"]] : [])].map(([value, label]) => <button key={value} aria-pressed={action === value} onClick={() => setAction(value)}>{label}</button>)}</nav>
    <OperationForm key={`${action}:${account.anterior}`} endpoint="/api/conta" review={action === "excluir" ? "A exclusão encerra seu acesso e remove seus dados de perfil. O histórico das operações será preservado sem nome e e-mail de acesso." : "Confirma a atualização da sua conta? Alterar e-mail ou senha encerra todas as sessões."} payload={f => ({ acao: action, anterior: account.anterior, ...Object.fromEntries(f) })} onSuccess={body => { if (body.sair) window.location.assign("/login"); }}>
      {action === "dados" && <><label>Nome<input name="nome" defaultValue={account.nome} required maxLength={120} autoComplete="name" /></label><label>E-mail<input name="email" defaultValue={account.email} required maxLength={255} type="email" autoComplete="email" /></label></>}
      {action === "senha" && <><label>Nova senha<input name="novaSenha" type="password" required minLength={8} maxLength={128} autoComplete="new-password" /></label><label>Confirmar nova senha<input name="confirmacaoSenha" type="password" required minLength={8} maxLength={128} autoComplete="new-password" /></label></>}
      {action === "excluir" && <><p>Conclua apostas e saques pendentes e zere o saldo antes de excluir sua conta. Você pode solicitar um saque simulado para retirar os créditos.</p><label>Digite EXCLUIR para confirmar<input name="confirmacao" required pattern="EXCLUIR" autoComplete="off" /></label></>}
      <label>Senha atual<input name="senhaAtual" type="password" required maxLength={1024} autoComplete="current-password" /></label>
    </OperationForm>
  </section>;
}
