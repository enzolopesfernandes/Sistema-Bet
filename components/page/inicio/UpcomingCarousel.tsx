"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import ArrowBackRounded from "@mui/icons-material/ArrowBackRounded";
import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import styles from "./inicio.module.scss";

export default function UpcomingCarousel({ children, count }: { children: ReactNode; count: number }) {
  const id = useId();
  const track = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ start: true, end: false });

  useEffect(() => {
    const element = track.current;
    if (!element) return;
    const observer = new ResizeObserver(() => {
      setPosition({ start: element.scrollLeft <= 2, end: element.scrollLeft + element.clientWidth >= element.scrollWidth - 2 });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [count]);

  function scroll(direction: number) {
    const element = track.current;
    if (!element) return;
    element.scrollBy({ left: direction * (element.clientWidth * .85), behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  }

  return (
    <>
      <div className={styles.sectionHeading}>
        <div><span className={styles.sectionKicker}>FIQUE DE OLHO</span><h2 id="upcoming-heading">Próximos jogos<span className={styles.headingDot}>.</span></h2><p>Os próximos encontros dentro das quatro linhas.</p></div>
        {count > 0 && <div className={styles.carouselControls}>
          <button type="button" aria-label="Jogos anteriores no carrossel" aria-controls={id} disabled={position.start} onClick={() => scroll(-1)}><ArrowBackRounded /></button>
          <button type="button" aria-label="Próximos jogos no carrossel" aria-controls={id} disabled={position.end || count <= 1} onClick={() => scroll(1)}><ArrowForwardRounded /></button>
        </div>}
      </div>
      <div id={id} ref={track} className={count > 0 ? styles.carousel : undefined} role="region" aria-label="Carrossel de próximos jogos" tabIndex={count > 0 ? 0 : undefined} onScroll={(event) => {
        const element = event.currentTarget;
        setPosition({ start: element.scrollLeft <= 2, end: element.scrollLeft + element.clientWidth >= element.scrollWidth - 2 });
      }}>{children}</div>
    </>
  );
}
