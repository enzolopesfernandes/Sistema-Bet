"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

const BalanceContext = createContext<{
  balance: string | null;
  error: boolean;
  refreshBalance: () => Promise<void>;
  updateBalance: (balance: string) => void;
} | null>(null);

export function BalanceProvider({ children }: { children: ReactNode }) {
  const [balance, setBalance] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const version = useRef(0);

  const updateBalance = useCallback((value: string) => {
    version.current++;
    setBalance(value);
    setError(false);
  }, []);

  const refreshBalance = useCallback(async () => {
    const requestVersion = ++version.current;
    try {
      const response = await fetch("/api/saldo", { cache: "no-store", credentials: "same-origin" });
      if (!response.ok) throw new Error();
      const data = await response.json();
      if (typeof data.saldo !== "string") throw new Error();
      if (requestVersion === version.current) { setBalance(data.saldo); setError(false); }
    } catch {
      if (requestVersion === version.current) setError(true);
    }
  }, []);

  return <BalanceContext.Provider value={{ balance, error, refreshBalance, updateBalance }}>{children}</BalanceContext.Provider>;
}

export function useBalance() {
  const context = useContext(BalanceContext);
  if (!context) throw new Error("O saldo precisa estar dentro do provedor de saldo");
  return context;
}
