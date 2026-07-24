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
  // Naranja, no ámbar: con el ámbar del idle el desvío no se percibía como
  // un cambio de estado (era literalmente el mismo color del reposo).
  desvio: "#fb923c",
  fallo: "#f87171",
  racha: "#fcff52",
  pensando: "#38bdf8",
};

// Cuánto dura el one-shot de cada estado antes de volver a idle. null = la
// pose se sostiene hasta que el estado cambie desde fuera.
const DURACION: Partial<Record<BordyMood, number>> = {
  acierto: 850, // salto con anticipación (0.8s) + margen
  desvio: 550,
  fallo: 1600, // sacudida (550) + un rato ladeado, para que se lea
  racha: 1700, // festejo de 3 brincos (1.5s) + margen
};

// Coordenadas medidas sobre el arte fuente (1280x1520): los ojos son los
// óvalos que se recortaron del visor, la boca donde estaba la sonrisa.
const OJO_I = { cx: 416, cy: 536, r: 44 };
const OJO_D = { cx: 723, cy: 534, r: 44 };
const BOCA = { cx: 582, cy: 764 };
const TINTA = "#0b0a14";
const MORADO = "#a855f7";

/** Ojos vectoriales. Cambiar de forma es lo que el raster no permitía. */
function Ojos({ forma }: { forma: string }) {
  if (forma === "llama") {
    // En racha los ojos ARDEN. Anchas a propósito (~196px, 2.2x la cuenca):
    // más angostas se leían como "un ojo raro" en vez de fuego.
    const llama = (o: typeof OJO_I, delay: string) => {
      const { cx: x, cy: y } = o;
      return (
        <g key={delay} className="br-llama-ojo" style={{ animationDelay: delay }}>
          <path
            d={`M ${x} ${y - 140} C ${x + 87} ${y - 62}, ${x + 136} ${y + 12}, ${x} ${y + 70} C ${x - 136} ${y + 12}, ${x - 87} ${y - 62}, ${x} ${y - 140} Z`}
            fill="url(#br-gLlama)"
          />
          <path
            d={`M ${x} ${y - 76} C ${x + 49} ${y - 26}, ${x + 76} ${y + 24}, ${x} ${y + 54} C ${x - 76} ${y + 24}, ${x - 49} ${y - 26}, ${x} ${y - 76} Z`}
            fill="#ffe74a"
            opacity={0.92}
          />
        </g>
      );
    };
    return (
      <>
        <defs>
          <linearGradient id="br-gLlama" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#ff3d00" />
            <stop offset="50%" stopColor="#ff8a00" />
            <stop offset="100%" stopColor="#ffe74a" />
          </linearGradient>
        </defs>
        {/* desfasadas: si ondearan igual se notaría que son la misma forma */}
        {llama(OJO_I, "0s")}
        {llama(OJO_D, "0.18s")}
      </>
    );
  }
  if (forma === "piensa") {
    // Entrecerrado y BARRIENDO de lado a lado. El barrido es lo que más
    // vende el "está procesando", y solo se puede con ojos vectoriales.
    // El barrido se anima por CSS (clase br-ojos-piensan en el <svg>) y no
    // con <animate> de SMIL: SMIL ignora prefers-reduced-motion.
    return (
      <>
        <ellipse cx={OJO_I.cx} cy={OJO_I.cy - 6} rx={OJO_I.r} ry={OJO_I.r * 0.5} fill={TINTA} />
        <ellipse cx={OJO_D.cx} cy={OJO_D.cy - 6} rx={OJO_D.r} ry={OJO_D.r * 0.5} fill={TINTA} />
      </>
    );
  }
  if (forma === "x") {
    // Aspas de mareo. Negro sobre el visor de colores: contrasta igual que
    // los óvalos originales, así que se lee sin ambigüedad.
    const aspa = (o: typeof OJO_I) =>
      `M ${o.cx - o.r} ${o.cy - o.r} L ${o.cx + o.r} ${o.cy + o.r} M ${o.cx + o.r} ${o.cy - o.r} L ${o.cx - o.r} ${o.cy + o.r}`;
    return (
      <>
        <path d={aspa(OJO_I)} stroke={TINTA} strokeWidth={22} strokeLinecap="round" />
        <path d={aspa(OJO_D)} stroke={TINTA} strokeWidth={22} strokeLinecap="round" />
      </>
    );
  }
  if (forma === "feliz") {
    // Arcos "^ ^": el ojo cerrado de alegría.
    const arco = (o: typeof OJO_I) =>
      `M ${o.cx - o.r - 6} ${o.cy + 14} Q ${o.cx} ${o.cy - 42} ${o.cx + o.r + 6} ${o.cy + 14}`;
    return (
      <>
        <path d={arco(OJO_I)} stroke={TINTA} strokeWidth={24} fill="none" strokeLinecap="round" />
        <path d={arco(OJO_D)} stroke={TINTA} strokeWidth={24} fill="none" strokeLinecap="round" />
      </>
    );
  }
  return (
    <>
      <ellipse cx={OJO_I.cx} cy={OJO_I.cy} rx={OJO_I.r} ry={OJO_I.r} fill={TINTA} />
      <ellipse cx={OJO_D.cx} cy={OJO_D.cy} rx={OJO_D.r} ry={OJO_D.r} fill={TINTA} />
    </>
  );
}

/** Bocas alternativas. "real" = se usa el recorte del arte original. */
function Boca({ forma }: { forma: string }) {
  const { cx: x, cy: y } = BOCA;
  if (forma === "grande") {
    return (
      <path
        d={`M ${x - 78} ${y - 18} Q ${x} ${y + 72} ${x + 78} ${y - 18} Q ${x} ${y + 16} ${x - 78} ${y - 18} Z`}
        fill={MORADO}
      />
    );
  }
  if (forma === "chica") {
    // Boca pequeña y ladeada: concentración, no emoción.
    return <ellipse cx={x + 6} cy={y + 8} rx={26} ry={17} fill={MORADO} />;
  }
  if (forma === "plana") {
    // Boca neutra: ni premia ni castiga un casi-acierto.
    return <rect x={x - 46} y={y + 2} width={92} height={20} rx={10} fill={MORADO} />;
  }
  if (forma === "mueca") {
    // La sonrisa invertida: mismo trazo, curvatura al revés.
    return (
      <path
        d={`M ${x - 62} ${y + 30} Q ${x} ${y - 34} ${x + 62} ${y + 30}`}
        stroke={MORADO}
        strokeWidth={24}
        fill="none"
        strokeLinecap="round"
      />
    );
  }
  return null;
}

// Animación POR PIEZA según el estado. El rig permite que cada parte tenga
// su propia vida; este mapa se va llenando estado por estado.
const RIG: Partial<Record<BordyMood, {
  brazoI?: string;
  brazoD?: string;
  antena?: string;
  orejas?: boolean;
  ojos?: string;
  /** forma de los ojos (Ojos) */
  cara?: string;
  /** forma de la boca; "real" usa el recorte del arte */
  boca?: string;
}>> = {
  idle: {
    brazoI: "br-brazoI-idle",
    brazoD: "br-brazoD-idle",
    antena: "br-antena-idle",
    ojos: "br-ojos-parpadean",
  },
  acierto: {
    brazoI: "br-brazoI-arriba",
    brazoD: "br-brazoD-arriba",
    antena: "br-antena-latigazo",
    orejas: true,
    cara: "feliz",
    boca: "grande",
  },
  racha: {
    brazoI: "br-brazoI-bombea",
    brazoD: "br-brazoD-bombea",
    antena: "br-antena-vibra",
    orejas: true,
    cara: "llama",
    boca: "grande",
  },
  fallo: {
    brazoI: "br-brazoI-cae",
    brazoD: "br-brazoD-cae",
    antena: "br-antena-triste",
    cara: "x",
    boca: "mueca",
  },
  desvio: {
    brazoI: "br-brazoI-idle",
    brazoD: "br-brazoD-saluda",
    antena: "br-antena-latigazo",
    orejas: true,
    boca: "plana",
  },
  pensando: {
    brazoI: "br-brazoI-quieto",
    brazoD: "br-brazoD-piensa",
    antena: "br-antena-piensa",
    ojos: "br-ojos-piensan",
    cara: "piensa",
    boca: "chica",
  },
};

export default function Bordy({
  mood = "idle",
  className = "",
  imgClassName = "",
  float = true,
  talking = false,
  alt = "Bordy",
}: {
  mood?: BordyMood;
  /** Clases del contenedor: aquí van el tamaño y la posición. */
  className?: string;
  /** Clases extra de la imagen. */
  imgClassName?: string;
  /** Flote ambiental. Apagarlo si el contenedor ya se mueve por su cuenta. */
  float?: boolean;
  /** Squash & stretch de habla (BordyTutorial). Tiene prioridad sobre `float`. */
  talking?: boolean;
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
    : mood === "racha" ? "bordy-festeja"
    : mood === "fallo" ? "bordy-shake"
    : mood === "desvio" ? "bordy-nope"
    : "";

  const pose =
    mood === "fallo" ? "bordy-pose-sad"
    : mood === "pensando" ? "bordy-pose-think"
    : "";

  // Animaciones por pieza del estado actual (vacío = pieza en reposo).
  const rig = RIG[mood] ?? {};

  const ledPulse =
    mood === "racha" ? "bordy-led-fast"
    : mood === "pensando" ? "bordy-led-slow"
    : mood === "idle" ? "bordy-led-blink"
    : "";

  return (
    <div className={`relative ${className}`}>
      <div className={talking ? "bordy-talk" : float ? "bordy-float-sm" : ""}>
        <div className={`bordy-pose ${pose}`}>
          <div key={tick} className={shot}>
            <div className="relative">
              {/* Bordy ya no es UNA imagen: son capas reensambladas. El orden
                  importa — orejas y antena detrás de la cabeza, brazos, boca
                  y ojos delante. `drop-shadow` va en el contenedor para que
                  la sombra sea del conjunto y no una por pieza. */}
              <div className={`bordy-rig ${imgClassName}`} role="img" aria-label={alt}>
                {/* eslint-disable @next/next/no-img-element */}
                <img className={`br-orejaI ${rig.orejas ? "br-orejaI-tiembla" : ""}`} src="/bordy/oreja-izq.webp" alt="" />
                <img className={`br-orejaD ${rig.orejas ? "br-orejaD-tiembla" : ""}`} src="/bordy/oreja-der.webp" alt="" />
                <div className={`br-antena ${rig.antena ?? ""}`}>
                  <img src="/bordy/antena.webp" alt="" />
                  <span
                    className={`br-led ${ledPulse}`}
                    style={{ ["--led" as string]: LED[mood] }}
                  />
                </div>
                <img className="br-base" src="/bordy/base.webp" alt="" />
                <img className={`br-brazoI ${rig.brazoI ?? ""}`} src="/bordy/brazo-izq.webp" alt="" />
                <img className={`br-brazoD ${rig.brazoD ?? ""}`} src="/bordy/brazo-der.webp" alt="" />
                {(rig.boca ?? "real") === "real" && (
                  <img className="br-boca" src="/bordy/boca.webp" alt="" />
                )}
                {/* eslint-enable @next/next/no-img-element */}
                {/* Los ojos se recortaron del visor y se reconstruyó el
                    degradado debajo, así que ahora son vectoriales y pueden
                    cambiar de forma. Coordenadas del arte fuente. */}
                <svg className={`br-cara ${rig.ojos ?? ""}`} viewBox="0 0 1280 1520" aria-hidden="true">
                  <Ojos forma={rig.cara ?? "normal"} />
                  <Boca forma={rig.boca ?? "real"} />
                </svg>
              </div>
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
