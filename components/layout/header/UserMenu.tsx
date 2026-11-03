"use client";

import { useRef, useState, type FocusEvent } from "react";
import Link from "next/link";
import AccountBalanceWalletOutlined from "@mui/icons-material/AccountBalanceWalletOutlined";
import PersonOutlineRounded from "@mui/icons-material/PersonOutlineRounded";
import ExpandMoreRounded from "@mui/icons-material/ExpandMoreRounded";
import SettingsOutlined from "@mui/icons-material/SettingsOutlined";
import HistoryRounded from "@mui/icons-material/HistoryRounded";
import LogoutRounded from "@mui/icons-material/LogoutRounded";
import type { HeaderUser } from "./Header";
import styles from "./header.module.scss";

export default function UserMenu({ user }: { user: HeaderUser }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const trigger = useRef<HTMLButtonElement>(null);

  function closeOnBlur(event: FocusEvent<HTMLDivElement>) {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
  }

  async function logout() {
    if (pending) return;
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
      if (!response.ok) throw new Error();
      window.location.replace("/");
    } catch {
      setError("Não foi possível sair da conta. Tente novamente.");
      setPending(false);
      setOpen(true);
    }
  }

  return (
    <>
      <div className={styles.account} onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)} onBlur={closeOnBlur} onKeyDown={(event) => {
        if (event.key === "Escape") { setOpen(false); trigger.current?.focus(); }
      }}>
        <button ref={trigger} type="button" className={styles.accountTrigger} aria-label={`Menu da conta de ${user.nome}`} aria-expanded={open} aria-controls="account-dropdown" onClick={(event) => setOpen(event.detail === 0 ? !open : true)}>
          <span className={styles.avatar}><PersonOutlineRounded /></span>
          <span className={styles.greeting}>Olá, <strong>{user.nome.split(" ")[0]}</strong></span>
          <ExpandMoreRounded className={open ? styles.chevronOpen : undefined} />
        </button>
        {open && (
          <div id="account-dropdown" className={styles.dropdown}>
            <div className={styles.identity}><strong>{user.nome}</strong><span>{user.email}</span></div>
            <Link href="/conta" prefetch={false} onClick={() => setOpen(false)}><SettingsOutlined /> Gerenciar conta</Link>
            {user.papel === "ADMINISTRADOR" && <Link href="/admin" prefetch={false} onClick={() => setOpen(false)}><SettingsOutlined /> Administração</Link>}
            <Link href="/apostas" prefetch={false} onClick={() => setOpen(false)}><HistoryRounded /> Histórico de Apostas</Link>
            <Link href="/saldo" prefetch={false} onClick={() => setOpen(false)}><AccountBalanceWalletOutlined /> Recarregar Saldo</Link>
            <Link href="/saques" prefetch={false} onClick={() => setOpen(false)}><AccountBalanceWalletOutlined /> Saques simulados</Link>
            <div className={styles.divider} />
            <button type="button" className={styles.logout} disabled={pending} onClick={logout}><LogoutRounded /> {pending ? "Saindo…" : "Sair da conta"}</button>
            {error && <p className={styles.error} role="alert">{error}</p>}
          </div>
        )}
      </div>
    </>
  );
}
