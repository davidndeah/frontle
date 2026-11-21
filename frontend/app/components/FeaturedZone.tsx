"use client";

// ============================================================
//  Zona destacada de Inicio: el reto del día y Flag Rush.
//
//  Dos maneras, para comparar en la prueba (pastilla "Apilado/Carrusel"):
//  · apilado: uno debajo del otro.
//  · carrusel: uno a la vez, pasa solo cada 6 s y se desliza con el dedo.
//    Se detiene mientras lo tocas, cuando la pestaña no se ve y con
//    "reducir movimiento" (ahí solo se mueve si lo deslizas tú).
//
//  El carrusel es scroll nativo con snap: el dedo, la inercia y el teclado
//  funcionan solos, sin librería. El automático solo hace scrollTo.
// ============================================================

import { Children, useEffect, useRef, useState, type ReactNode } from "react";
import type { Destacado } from "../lib/estetica";

const AUTO_MS = 6000;
// Margen para que el borde y la sombra dura de cada ficha no se recorten
// contra el borde del carrusel (sombra de 5 px + borde).
const GUTTER = 8;

export default function FeaturedZone({ label, mode, slideLabels, children }: {
  label: string;
  mode: Destacado;
  /** Nombre de cada ficha, para los puntos del carrusel. */
  slideLabels: string[];
  children: ReactNode;
}) {
  const slides = Children.toArray(children);
  return (
    <section className="flex flex-col gap-2">
      <h3 className="est-eyebrow text-[11px] font-display font-semibold uppercase tracking-[0.14em] text-neutral-400">{label}</h3>
      {mode === "carrusel" ? (
        <Carousel slides={slides} labels={slideLabels} />
      ) : (
        <div className="flex flex-col gap-3">{slides}</div>
      )}
    </section>
  );
}

function Carousel({ slides, labels }: { slides: ReactNode[]; labels: string[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const held = useRef(false);
  // Cada cambio de `index` (automático, punto o dedo) reinicia la cuenta.
  const [restart, setRestart] = useState(0);

  const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const go = (i: number) => {
    const el = ref.current;
    const slide = el?.children[i] as HTMLElement | undefined;
    if (!el || !slide) return;
    el.scrollTo({ left: slide.offsetLeft - GUTTER, behavior: reduced() ? "auto" : "smooth" });
  };

  // Qué ficha se ve: la más cercana al borde izquierdo.
  const onScroll = () => {
    const el = ref.current;
    if (!el) return;
    const w = (el.children[0] as HTMLElement | undefined)?.offsetWidth ?? 1;
    const gap = parseFloat(getComputedStyle(el).columnGap) || 0;
    const i = Math.round(el.scrollLeft / (w + gap));
    if (i !== index) { setIndex(i); setRestart((n) => n + 1); }
  };

  useEffect(() => {
    if (reduced() || slides.length < 2) return;
    const id = setTimeout(() => {
      if (held.current || document.hidden) { setRestart((n) => n + 1); return; }
      go((index + 1) % slides.length);
    }, AUTO_MS);
    return () => clearTimeout(id);
    // `go` solo lee el DOM; la cuenta depende del índice y de los reinicios.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, restart, slides.length]);

  const press = () => { held.current = true; };
  const release = () => { held.current = false; setRestart((n) => n + 1); };

  return (
    <div className="flex flex-col gap-2">
      <div
        ref={ref}
        onScroll={onScroll}
        onPointerDown={press}
        onPointerUp={release}
        onPointerCancel={release}
        onPointerLeave={release}
        className="est-carousel relative flex snap-x snap-mandatory gap-4 overflow-x-auto"
        style={{ margin: `0 -${GUTTER}px`, padding: `0 ${GUTTER}px ${GUTTER}px`, scrollPaddingInline: GUTTER }}
        aria-roledescription="carousel"
      >
        {slides.map((s, i) => (
          <div
            key={i}
            className="w-full flex-none snap-start"
            aria-roledescription="slide"
            aria-label={labels[i]}
          >
            {s}
          </div>
        ))}
      </div>
      <div className="flex justify-center gap-1.5">
        {slides.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => go(i)}
            aria-label={labels[i]}
            aria-current={i === index}
            className="est-dot h-2.5 w-2.5 rounded-full border-2 border-deep"
            data-on={i === index}
          />
        ))}
      </div>
    </div>
  );
}
