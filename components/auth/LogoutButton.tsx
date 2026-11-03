"use client";

import { useState } from "react";
import LogoutRounded from "@mui/icons-material/LogoutRounded";
import styles from "./auth.module.scss";

export default function LogoutButton() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function logout() {
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error();
      window.location.replace("/login");
    } catch {
      setError("Não foi possível sair da conta. Tente novamente");
      setPending(false);
    }
  }

  return (
    <div>
      <button className={styles.submit} type="button" disabled={pending} onClick={logout}><LogoutRounded />{pending ? "Saindo…" : "Sair da conta"}</button>
      {error && <p className={styles.fieldError} role="alert">{error}</p>}
    </div>
  );
}
