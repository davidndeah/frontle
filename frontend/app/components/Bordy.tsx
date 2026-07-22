"use client";

// ============================================================
//  Frontle — Bordy reactivo
//
//  `bordy-m2.webp` es un render estático: su cara no puede cambiar. Así que
//  la expresión se comunica con tres cosas que sí se pueden animar encima:
//   · MOVIMIENTO — salta al acertar, se sacude y queda ladeado al fallar,
//     se mece mientras piensa
//   · el LED de su antena — semáforo de color sobre la bolita del render
//   · PARTÍCULAS — chispas en racha, puntitos al pensar
//
//  Las animaciones son CSS puro (globals.css); aquí solo se eligen clases.
//  Nada de JS por frame.
// ============================================================

import { useEffect, useRef, useState } from "react";

/** Estado emocional de Bordy. `idle` es el reposo de siempre. */
export type BordyMood = "idle" | "acierto" | "desvio" | "fallo" | "racha" | "pensando";

// Color del LED por estado. El idle usa ámbar (encendido pero neutro), no
// apagado: un LED negro parece que el robot está muerto.
const LED: Record<BordyMood, string> = {
  idle: "#fbbf24",
  acierto: "#34d399",
  desvio: "#fbbf24",
  fallo: "#f87171",
  racha: "#fcff52",
  pensando: "#38bdf8",
};

// Cuánto dura el one-shot de cada estado antes de volver a idle. null = la
// pose se sostiene hasta que el estado cambie desde fuera.
const DURACION: Partial<Record<BordyMood, number>> = {
  acierto: 700,
  desvio: 550,
  fallo: 1600, // sacudida (550) + un rato ladeado, para que se lea
  racha: 1150, // voltereta completa (1.05s) + margen para reasentarse
};

export default function Bordy({
  mood = "idle",
  className = "",
  imgClassName = "",
  float = true,
  alt = "Bordy",
}: {
  mood?: BordyMood;
  /** Clases del contenedor: aquí van el tamaño y la posición. */
  className?: string;
  /** Clases extra de la imagen. */
  imgClassName?: string;
  /** Flote ambiental. Apagarlo si el contenedor ya se mueve por su cuenta. */
  float?: boolean;
  alt?: string;
}) {
  // `key` re-monta la capa del one-shot para que la animación vuelva a correr
  // aunque se repita el MISMO estado (dos aciertos seguidos deben saltar dos
  // veces; sin esto, CSS ve la misma clase y no reinicia).
  const [tick, setTick] = useState(0);
  const previo = useRef<BordyMood>(mood);

  useEffect(() => {
    if (previo.current !== mood) {
      previo.current = mood;
      setTick((t) => t + 1);
    }
  }, [mood]);

  const shot =
    mood === "acierto" ? "bordy-hop"
    : mood === "racha" ? "bordy-hop-big"
    : mood === "fallo" || mood === "desvio" ? "bordy-shake"
    : "";

  const pose =
    mood === "fallo" ? "bordy-pose-sad"
    : mood === "pensando" ? "bordy-pose-think"
    : "";

  const ledPulse =
    mood === "racha" ? "bordy-led-fast"
    : mood === "pensando" ? "bordy-led-slow"
    : mood === "idle" ? "bordy-led-blink"
    : "";

  return (
    <div className={`relative ${className}`}>
      <div className={float ? "bordy-float-sm" : ""}>
        <div className={`bordy-pose ${pose}`}>
          <div key={tick} className={shot}>
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/bordy-m2.webp"
                alt={alt}
                className={`w-full h-full object-contain ${imgClassName}`}
              />
              <span
                className={`bordy-led ${ledPulse}`}
                style={{ ["--led" as string]: LED[mood] }}
              />
              {mood === "racha" && (
                <>
                  <span className="bordy-spark" style={{ left: "8%", top: "14%" }} />
                  <span className="bordy-spark" style={{ right: "6%", top: "8%", animationDelay: "0.35s" }} />
                  <span className="bordy-spark" style={{ right: "12%", top: "38%", animationDelay: "0.7s" }} />
                </>
              )}
              {mood === "pensando" && (
                <>
                  <span className="bordy-think-dot" style={{ width: 8, height: 8, right: "17%", top: "16%" }} />
                  <span className="bordy-think-dot" style={{ width: 11, height: 11, right: "11%", top: "10%", animationDelay: "0.3s" }} />
                  <span className="bordy-think-dot" style={{ width: 14, height: 14, right: "4%", top: "3%", animationDelay: "0.6s" }} />
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Mantiene un estado de Bordy que vuelve solo a `idle` cuando el one-shot
 * termina. El llamador solo dice "pasó esto" y se olvida de limpiar.
 */
export function useBordyMood(): [BordyMood, (m: BordyMood) => void] {
  const [mood, setMood] = useState<BordyMood>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const react = (m: BordyMood) => {
    if (timer.current) clearTimeout(timer.current);
    setMood(m);
    const ms = DURACION[m];
    if (ms) timer.current = setTimeout(() => setMood("idle"), ms);
  };

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  return [mood, react];
}
