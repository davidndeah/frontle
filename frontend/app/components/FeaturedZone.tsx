"use client";

// ============================================================
//  Zona destacada de Inicio: el reto del día y Flag Rush.
//
//  Dos maneras, para comparar en la prueba (pastilla "Apilado/Carrusel"):
//  · apilado: uno debajo del otro.
//  · carrusel: uno a la vez, pasa solo cada 6 s y se desliza con el dedo.
//    Se detiene mientras lo tocas y cuando la pestaña no se ve. Con
//    "reducir movimiento" sigue pasando, pero salta sin deslizarse.
//
//  El carrusel es scroll nativo con snap: el dedo, la inercia y el teclado
//  funcionan solos, sin librería. El automático solo hace scrollTo.
// ============================================================

import { Children, useEffect, useRef, useState, type ReactNode } from "react";
import type { Destacado } from "../lib/estetica";

const AUTO_MS = 6000;
/** Lo que tarda la entrada escalonada de Inicio (460 ms + retrasos). */
const ENTRADA_MS = 800;
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
  // La primera cuenta espera además a que terminen de entrar las tarjetas.
  const first = useRef(true);

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

  // Pasa solo también con "reducir movimiento" (muchos Android lo activan con
  // el ahorro de batería): ahí salta sin deslizarse, ver `go`.
  useEffect(() => {
    if (slides.length < 2) return;
    const id = setTimeout(() => {
      if (held.current || document.hidden) { setRestart((n) => n + 1); return; }
      go((index + 1) % slides.length);
    }, AUTO_MS + (first.current ? ENTRADA_MS : 0));
    first.current = false;
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
      {/* Cada punto es un botón de 44 px (zona táctil); el dibujo sigue chico. */}
      <div className="-my-2 flex justify-center">
        {slides.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => go(i)}
            aria-label={labels[i]}
            aria-current={i === index}
            className="flex h-11 w-11 items-center justify-center"
          >
            <span className="est-dot h-2.5 w-2.5 rounded-full border-2 border-deep" data-on={i === index} />
          </button>
        ))}
      </div>
    </div>
  );
}
