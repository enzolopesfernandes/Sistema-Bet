"use client";

import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import AlternateEmailRounded from "@mui/icons-material/AlternateEmailRounded";
import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import CheckCircleOutlineRounded from "@mui/icons-material/CheckCircleOutlineRounded";
import ErrorOutlineRounded from "@mui/icons-material/ErrorOutlineRounded";
import LockOutlined from "@mui/icons-material/LockOutlined";
import PersonOutlineRounded from "@mui/icons-material/PersonOutlineRounded";
import ShieldOutlined from "@mui/icons-material/ShieldOutlined";
import VisibilityOffOutlined from "@mui/icons-material/VisibilityOffOutlined";
import VisibilityOutlined from "@mui/icons-material/VisibilityOutlined";
import {
  AUTH_MESSAGES,
  validateLogin,
  validateRegistration,
  type AuthField,
  type FieldErrors,
} from "@/lib/auth-validation";
import styles from "./auth.module.scss";

type Props = { mode: "login" | "cadastro"; accountCreated?: boolean };
type Notice = { kind: "error" | "success"; text: string };

export default function AuthForm({ mode, accountCreated = false }: Props) {
  const registering = mode === "cadastro";
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [notice, setNotice] = useState<Notice | null>(
    accountCreated ? { kind: "success", text: AUTH_MESSAGES.registrationSuccess } : null,
  );
  const formRef = useRef<HTMLFormElement>(null);

  function showErrors(message: string, errors: FieldErrors = {}) {
    setNotice({ kind: "error", text: message });
    setFieldErrors(errors);
    const firstField = Object.keys(errors)[0] as AuthField | undefined;
    if (firstField) {
      formRef.current?.querySelector<HTMLInputElement>(`[name="${firstField}"]`)?.focus();
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const formData = new FormData(event.currentTarget);
    const input = Object.fromEntries(formData);
    const result = registering ? validateRegistration(input) : validateLogin(input);
    if (!result.success) {
      showErrors(result.message, result.fieldErrors);
      return;
    }

    setPending(true);
    setNotice(null);
    setFieldErrors({});
    const fallback = registering ? AUTH_MESSAGES.registrationFailed : AUTH_MESSAGES.loginFailed;

    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result.data),
      });
      const body = await response.json();
      if (!response.ok) {
        showErrors(body.message ?? fallback, body.fieldErrors);
        setPending(false);
        return;
      }

      setNotice({ kind: "success", text: body.message });
      window.location.replace(registering ? "/login?cadastro=sucesso" : "/");
    } catch {
      showErrors(fallback);
      setPending(false);
    }
  }

  return (
    <>
      <nav className={styles.tabs} aria-label="Opções de acesso">
        <Link href="/login" className={!registering ? styles.activeTab : undefined} aria-current={!registering ? "page" : undefined}>Entrar</Link>
        <Link href="/cadastro" className={registering ? styles.activeTab : undefined} aria-current={registering ? "page" : undefined}>Criar Conta</Link>
      </nav>
      <div className={styles.formHeading}>
        <span className={styles.kicker}>{registering ? "FAÇA PARTE DO JOGO" : "BOM TER VOCÊ DE VOLTA"}</span>
        <h2>{registering ? "Crie sua conta" : "Entre na sua conta"}<span>.</span></h2>
        <p>{registering ? "Seu primeiro passo para entrar em campo." : "Sua paixão pelo esporte continua por aqui."}</p>
      </div>

      {notice && (
        <div className={notice.kind === "error" ? styles.errorNotice : styles.successNotice} role={notice.kind === "error" ? "alert" : "status"}>
          {notice.kind === "error" ? <ErrorOutlineRounded /> : <CheckCircleOutlineRounded />}
          <span>{notice.text}</span>
        </div>
      )}

      <form ref={formRef} onSubmit={handleSubmit} noValidate aria-busy={pending}>
        <fieldset className={styles.fields} disabled={pending}>
          <legend className={styles.srOnly}>{registering ? "Dados para cadastro" : "Dados de acesso"}</legend>
          {registering && (
            <div className={styles.field}>
              <label htmlFor="nome">Nome completo</label>
              <div className={styles.inputWrap} data-invalid={Boolean(fieldErrors.nome)}>
                <PersonOutlineRounded />
                <input id="nome" name="nome" placeholder="Como podemos chamar você?" autoComplete="name" required maxLength={120} aria-invalid={Boolean(fieldErrors.nome)} aria-describedby={fieldErrors.nome ? "nome-error" : undefined} />
              </div>
              {fieldErrors.nome && <p id="nome-error" className={styles.fieldError}>{fieldErrors.nome}</p>}
            </div>
          )}

          <div className={styles.field}>
            <label htmlFor="email">E-mail</label>
            <div className={styles.inputWrap} data-invalid={Boolean(fieldErrors.email)}>
              <AlternateEmailRounded />
              <input id="email" name="email" type="email" placeholder="seuemail@exemplo.com" autoComplete="email" autoCapitalize="none" spellCheck={false} required maxLength={255} aria-invalid={Boolean(fieldErrors.email)} aria-describedby={fieldErrors.email ? "email-error" : undefined} />
            </div>
            {fieldErrors.email && <p id="email-error" className={styles.fieldError}>{fieldErrors.email}</p>}
          </div>

          <div className={styles.field}>
            <label htmlFor="senha">Senha</label>
            <div className={styles.inputWrap} data-invalid={Boolean(fieldErrors.senha)}>
              <LockOutlined />
              <input id="senha" name="senha" type={showPassword ? "text" : "password"} placeholder={registering ? "Crie uma senha segura" : "Digite sua senha"} autoComplete={registering ? "new-password" : "current-password"} required minLength={registering ? 8 : undefined} maxLength={1024} aria-invalid={Boolean(fieldErrors.senha)} aria-describedby={fieldErrors.senha ? "senha-error" : registering ? "senha-help" : undefined} />
              <button className={styles.passwordToggle} type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"} aria-pressed={showPassword}>
                {showPassword ? <VisibilityOffOutlined /> : <VisibilityOutlined />}
              </button>
            </div>
            {fieldErrors.senha ? <p id="senha-error" className={styles.fieldError}>{fieldErrors.senha}</p> : registering && <p id="senha-help" className={styles.fieldHelp}>Use pelo menos 8 caracteres.</p>}
          </div>

          <button className={styles.submit} type="submit" disabled={pending}>
            {pending ? <><span className={styles.spinner} /> {registering ? "Criando sua conta…" : "Entrando…"}</> : <>{registering ? "Criar Conta" : "Entrar"}<ArrowForwardRounded /></>}
          </button>
        </fieldset>
        <Link href="/" className={styles.cancel}>Cancelar e voltar ao início</Link>
      </form>

      <p className={styles.switchMode}>
        {registering ? "Já faz parte do time?" : "Ainda não tem uma conta?"}{" "}
        <Link href={registering ? "/login" : "/cadastro"}>{registering ? "Entrar" : "Criar Conta"}</Link>
      </p>
      <div className={styles.security}><ShieldOutlined /><span>Seus dados protegidos. Sua diversão em primeiro lugar.</span></div>
    </>
  );
}
