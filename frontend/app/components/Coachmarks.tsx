"use client";

// ============================================================
//  Coachmarks — tutorial contextual por "spotlight" (patrón del
//  coach de Gambit): oscurece la pantalla, recorta el elemento
//  objetivo con borde dorado y Bordy explica en una burbuja.
//  Genérico: recibe pasos { target(id), text }.
// ============================================================

import { useEffect, useState } from "react";

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

  useEffect(() => {
    let raf = 0;
    function measure() {
      const el = document.getElementById(steps[i].target);
      if (!el) { setRect(null); return; }
      el.scrollIntoView({ block: "center", behavior: "auto" });
      raf = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        setRect({ left: r.left, top: r.top, width: r.width, height: r.height, bottom: r.bottom });
      });
    }
    measure();
    window.addEventListener("resize", measure);
    return () => { window.removeEventListener("resize", measure); cancelAnimationFrame(raf); };
  }, [i, steps]);

  if (!rect) return null;
  const pad = 8;
  const below = rect.bottom < (typeof window !== "undefined" ? window.innerHeight : 800) - 230;

  return (
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
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/bordy-m2.webp" alt="Bordy" className="w-12 h-14 object-contain flex-none bordy-float-sm drop-shadow-xl" />
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
    </div>
  );
}
