import type { ReactNode } from "react";
import Link from "next/link";
import ArrowBackRounded from "@mui/icons-material/ArrowBackRounded";
import ArrowOutwardRounded from "@mui/icons-material/ArrowOutwardRounded";
import SportsSoccerRounded from "@mui/icons-material/SportsSoccerRounded";
import Brand from "./Brand";
import styles from "./auth.module.scss";

export default function AuthShell({ children }: { children: ReactNode }) {
  return (
    <main className={styles.shell}>
      <aside className={styles.story} aria-label="Sobre o Sistema-Bet">
        <Brand />
        <div className={styles.storyContent}>
          <span className={styles.eyebrow}><span /> PAIXÃO PELO ESPORTE</span>
          <h1>O próximo lance<br />começa com <em>você.</em></h1>
          <p>Um novo jeito de viver sua paixão pelo esporte. Crie sua conta e faça parte do Sistema-Bet.</p>
          <div className={styles.pitch} aria-hidden="true">
            <div className={styles.pitchFrame}><div className={styles.pitchCircle} /></div>
            <span className={styles.ball}><SportsSoccerRounded /></span>
            <span className={styles.pitchLabel}>SUA PAIXÃO. SEU JOGO. <ArrowOutwardRounded /></span>
          </div>
        </div>
        <p className={styles.storyFooter}>Esporte é emoção. Aqui, a experiência é simulada.</p>
      </aside>

      <section className={styles.formSide} aria-label="Acesso à conta">
        <div className={styles.mobileBrand}><Brand /></div>
        <Link href="/" className={styles.back}><ArrowBackRounded /> Voltar ao início</Link>
        <div className={styles.formContainer}>{children}</div>
        <footer className={styles.footer}>
          <span className={styles.simulationDot} /> Projeto educacional · Sem dinheiro real
        </footer>
      </section>
    </main>
  );
}
