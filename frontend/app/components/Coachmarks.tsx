"use client";

// ============================================================
//  Coachmarks — tutorial contextual por "spotlight" (patrón del
//  coach de Gambit): oscurece la pantalla, recorta el elemento
//  objetivo con borde dorado y Bordy explica en una burbuja.
//  Genérico: recibe pasos { target(id), text }.
// ============================================================

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Bordy from "./Bordy";

export type CoachStep = { target: string; text: string };
export type CoachLabels = { skip: string; next: string; done: string };

export default function Coachmarks({
  steps, labels, onDone, offset = 0, total,
}: {
  steps: CoachStep[]; labels: CoachLabels; onDone: () => void;
  /**
   * Pasos ya recorridos ANTES de estos coachmarks. Cuando vienen encadenados
   * tras el tutorial modal, el contador debe continuar (6/7) en vez de
   * reiniciar en 1/2: si reinicia, se lee como "otro tutorial" aunque sea el
   * mismo recorrido.
   */
  offset?: number;
  /** Total del recorrido completo. Por defecto, solo estos pasos. */
  total?: number;
}) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<{ left: number; top: number; width: number; height: number; bottom: number } | null>(null);

  // Depende del TARGET (string), no de `steps` (array nuevo en cada render, que
  // hacía re-correr el efecto sin parar y reescanear a destiempo).
  const target = steps[i].target;

  useEffect(() => {
    const el = document.getElementById(target);
    if (!el) { setRect(null); return; }

    // Medir es distinto de desplazar: el scroll se hace UNA vez; la medición
    // se repite mientras el layout se asienta. El bug era medir una sola vez,
    // justo cuando el mapa aún mostraba su placeholder de carga (fetch async
    // del GeoJSON): al cargar, todo reflotaba y el spotlight quedaba clavado
    // en las coordenadas viejas, señalando una zona vacía a un lado.
    const apply = () => {
      const r = el.getBoundingClientRect();
      setRect({ left: r.left, top: r.top, width: r.width, height: r.height, bottom: r.bottom });
    };

    el.scrollIntoView({ block: "center", behavior: "auto" });
    const raf = requestAnimationFrame(apply);
    // Ráfaga corta: cubre la carga async del mapa, imágenes y la fuente.
    const timers = [80, 220, 500, 900].map((ms) => setTimeout(apply, ms));

    // Re-mide ante cualquier cambio de tamaño del objetivo o del documento
    // (el mapa creciendo de placeholder a mapa real dispara esto).
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    ro.observe(document.body);

    window.addEventListener("resize", apply);
    // `true` = fase de captura: atrapa el scroll de cualquier contenedor
    // interno, no solo el de la ventana, para re-medir tras el scrollIntoView.
    window.addEventListener("scroll", apply, true);

    return () => {
      cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
      ro.disconnect();
      window.removeEventListener("resize", apply);
      window.removeEventListener("scroll", apply, true);
    };
  }, [target]);

  if (!rect) return null;
  const pad = 8;
  const below = rect.bottom < (typeof window !== "undefined" ? window.innerHeight : 800) - 230;

  // Portal a <body>: el overlay es `position: fixed`, pero un ancestro con
  // `transform` (aquí `.tab-fade`, que retiene translateY(0) por su
  // animation-fill-mode: both) convierte ese `fixed` en relativo a ESA caja,
  // no al viewport. Entonces las coords de getBoundingClientRect (que SON de
  // viewport) se aplicaban corridas por el offset de la columna — el spotlight
  // caía ~400px a la derecha. Sacándolo del árbol transformado, `fixed` vuelve
  // a ser relativo al viewport y las coordenadas cuadran.
  return createPortal(
    <div className="fixed inset-0 z-[70]">
      {/* spotlight: el hueco lo hace el box-shadow gigante */}
      <div
        className="absolute rounded-2xl border-2 border-gold transition-all duration-300 pointer-events-none"
        style={{
          left: rect.left - pad,
          top: rect.top - pad,
          width: rect.width + pad * 2,
          height: rect.height + pad * 2,
          boxShadow: "0 0 0 9999px rgba(10,4,26,0.78), 0 0 24px rgba(252,255,82,0.35)",
        }}
      />
      {/* burbuja de Bordy */}
      <div
        className="absolute left-1/2 -translate-x-1/2 w-[92%] max-w-sm"
        style={below ? { top: rect.bottom + pad + 14 } : { bottom: (typeof window !== "undefined" ? window.innerHeight : 800) - rect.top + pad + 14 }}
      >
        <div className="flex items-center gap-2 pop-in">
          <Bordy mood="idle" className="w-12 h-14 flex-none" imgClassName="drop-shadow-xl" />
          <div className="panel px-3.5 py-3 flex-1">
            <p className="text-white text-[13px] leading-relaxed">{steps[i].text}</p>
            <div className="flex items-center justify-between mt-2.5">
              <span className="text-[10px] text-neutral-400 tabular-nums">{offset + i + 1}/{total ?? steps.length}</span>
              <div className="flex items-center gap-3">
                <button onClick={onDone} className="text-[11px] text-neutral-400 underline active:scale-95 transition">
                  {labels.skip}
                </button>
                <button
                  onClick={() => (i < steps.length - 1 ? setI(i + 1) : onDone())}
                  className="btn-3d font-display font-bold text-[13px] px-4 py-1.5"
                >
                  {i < steps.length - 1 ? labels.next : labels.done}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
