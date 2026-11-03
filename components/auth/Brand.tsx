import Link from "next/link";
import SportsSoccerRounded from "@mui/icons-material/SportsSoccerRounded";
import styles from "./auth.module.scss";

export default function Brand({ className = "" }: { className?: string }) {
  return (
    <Link href="/" className={`${styles.brand} ${className}`} aria-label="Sistema-Bet — início">
      <span className={styles.brandIcon}><SportsSoccerRounded /></span>
      <span>Sistema<span className={styles.brandAccent}>-Bet</span></span>
    </Link>
  );
}
