"use client";

import { useState } from "react";
import Image from "next/image";
import SportsSoccerRounded from "@mui/icons-material/SportsSoccerRounded";
import styles from "./inicio.module.scss";

export default function TeamLogo({ src }: { src: string | null }) {
  const [failed, setFailed] = useState(false);
  return <span className={styles.teamLogo} aria-hidden="true">
    {src && !failed ? <Image src={src} alt="" width={34} height={34} unoptimized onError={() => setFailed(true)} /> : <SportsSoccerRounded />}
  </span>;
}
