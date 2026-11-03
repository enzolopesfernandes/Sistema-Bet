import type { Metadata } from "next";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v15-appRouter";
import { BalanceProvider } from "@/src/context/BalanceContext";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sistema-Bet",
  description: "Sistema-Bet — uma experiência educacional de apostas simuladas.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body><AppRouterCacheProvider options={{ enableCssLayer: true }}><BalanceProvider>{children}</BalanceProvider></AppRouterCacheProvider></body>
    </html>
  );
}
