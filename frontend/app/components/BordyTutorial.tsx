"use client";

// ============================================================
//  BordyTutorial — tutorial visual al pulsar Jugar (1ª vez).
//  Mini-tablero demo animado (Portugal → Alemania, error amarillo
//  de Suiza — igual que el video) + Bordy hablando con typewriter
//  y robot-chatter (Web Audio). Incluye checkbox "no volver a
//  mostrar" y QuickStart (3·2·1) para veteranos.
// ============================================================

import { useEffect, useRef, useState } from "react";
import { TUTORIAL_MAP } from "../lib/tutorialMap";

const COLORS: Record<string, string> = {
  start: "#22d3ee", end: "#e879f9", green: "#22c55e", yellow: "#eab308", red: "#ef4444", off: "transparent",
};

type DemoStatus = Record<string, keyof typeof COLORS | "off">;

// Guion sincronizado: texto de Bordy + animaciones del tablero por paso
const STEPS: {
  icon: string;
  text: string;
  timeline: { t: number; input?: string; set?: [string, keyof typeof COLORS][] }[];
}[] = [
  {
    icon: "🌍",
    text: "¡Hola! Soy Bordy 👋 Tu misión: conectar el ORIGEN con el DESTINO escribiendo países vecinos. Hoy de ejemplo: Portugal → Alemania.",
    timeline: [
      { t: 200, set: [["Portugal", "start"], ["Germany", "end"]] },
    ],
  },
  {
    icon: "🟢",
    text: "Verde = ¡vas perfecto! España comparte frontera con Portugal y está en la ruta óptima hacia Alemania.",
    timeline: [
      { t: 300, input: "España" },
      { t: 1800, input: "", set: [["Spain", "green"]] },
    ],
  },
  {
    icon: "🟡",
    text: "Amarillo = desvío. Suiza te saca un poco del camino… no es grave, pero gastas países de más.",
    timeline: [
      { t: 300, input: "Suiza" },
      { t: 1800, input: "", set: [["Switzerland", "yellow"]] },
    ],
  },
  {
    icon: "🔴",
    text: "Rojo = ¡te alejas! Marruecos va en dirección contraria a Alemania. Ojo con el semáforo.",
    timeline: [
      { t: 300, input: "Marruecos" },
      { t: 1800, input: "", set: [["Morocco", "red"]] },
    ],
  },
  {
    icon: "🏆",
    text: "Francia completa la ruta ✅ Menos países y menos tiempo = mejor puesto. ¡El mejor del día se lleva el pot!",
    timeline: [
      { t: 300, input: "Francia" },
      { t: 1800, input: "", set: [["France", "green"]] },
    ],
  },
];

const TYPE_MS = 24;

// --- Robot chatter (Web Audio, sin assets) ---
let audioCtx: AudioContext | null = null;
function blip(muted: boolean) {
  if (muted || typeof window === "undefined") return;
  try {
    audioCtx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const t = audioCtx.currentTime;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = "triangle";
    o.frequency.setValueAtTime(240 + Math.random() * 260, t);
    g.gain.setValueAtTime(0.035, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + 0.07);
    o.connect(g).connect(audioCtx.destination);
    o.start(t); o.stop(t + 0.08);
  } catch {}
}
function chime(muted: boolean, freqs: number[] = [523, 784]) {
  if (muted) return;
  try {
    audioCtx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const t = audioCtx.currentTime;
    freqs.forEach((f, i) => {
      const o = audioCtx!.createOscillator();
      const g = audioCtx!.createGain();
      o.type = "sine"; o.frequency.value = f;
      g.gain.setValueAtTime(0.05, t + i * 0.09);
      g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.09 + 0.22);
      o.connect(g).connect(audioCtx!.destination);
      o.start(t + i * 0.09); o.stop(t + i * 0.09 + 0.25);
    });
  } catch {}
}

function useMuted() {
  const [muted, setMuted] = useState(() => {
    try { return localStorage.getItem("frontle-muted") === "1"; } catch { return false; }
  });
  const ref = useRef(muted);
  ref.current = muted;
  const toggle = () => setMuted((m) => {
    try { localStorage.setItem("frontle-muted", m ? "0" : "1"); } catch {}
    return !m;
  });
  return { muted, ref, toggle };
}

// --- Mini-tablero demo ---
function DemoBoard({ status }: { status: DemoStatus }) {
  const revealed = TUTORIAL_MAP.play.filter((p) => status[p.name] && status[p.name] !== "off");
  return (
    <div className="panel w-full max-w-sm p-3 pop-in">
      {/* header del reto */}
      <div className="flex items-center justify-center gap-3 mb-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="https://flagcdn.com/pt.svg" alt="" className="w-7 rounded-[3px]" />
        <span className="text-[13px] font-bold text-cyan-300">Portugal</span>
        <span className="text-neutral-400">→</span>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="https://flagcdn.com/de.svg" alt="" className="w-7 rounded-[3px]" />
        <span className="text-[13px] font-bold text-fuchsia-300">Alemania</span>
      </div>
      {/* mapa */}
      <div className="rounded-xl overflow-hidden bg-[#0f0524] border border-[#b79ced]/20">
        <svg viewBox={TUTORIAL_MAP.viewBox} className="w-full h-auto">
          <path d={TUTORIAL_MAP.grat} fill="none" stroke="rgba(183,156,237,0.16)" strokeWidth={0.5} />
          {TUTORIAL_MAP.all.map((d, i) => (
            <path key={i} d={d} fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.10)" strokeWidth={0.7} />
          ))}
          {TUTORIAL_MAP.play.map((p) => {
            const st = status[p.name] ?? "off";
            const c = COLORS[st];
            const on = st !== "off";
            return (
              <path
                key={p.name}
                d={p.d}
                fill={on ? c : "transparent"}
                stroke={on ? c : "rgba(255,255,255,0.30)"}
                strokeWidth={1}
                style={{ filter: on ? `drop-shadow(0 0 5px ${c})` : "none", transition: "fill 0.4s ease" }}
              />
            );
          })}
        </svg>
      </div>
      {/* chips de la ruta */}
      <div className="flex items-center gap-1.5 mt-2 min-h-[30px] flex-wrap">
        {revealed.map((p) => {
          const c = COLORS[status[p.name] as keyof typeof COLORS];
          return (
            <span key={p.name} className="pop-in flex items-center gap-1 rounded-lg border bg-[#1c0b3e]/60 px-1.5 py-0.5" style={{ borderColor: c }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`https://flagcdn.com/${p.code}.svg`} alt="" className="w-4 rounded-[2px]" />
              <span className="text-[9px] text-white font-semibold">{{ Switzerland: "Suiza", Spain: "España", France: "Francia", Germany: "Alemania", Morocco: "Marruecos" }[p.name] ?? p.name}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

// Input del juego (demo): Bordy "escribe" y aparece la sugerencia con bandera
const SUGGEST: Record<string, string> = { España: "es", Suiza: "ch", Marruecos: "ma", Francia: "fr" };
function InputDemo({ text }: { text: string }) {
  const match = text.length >= 2
    ? Object.entries(SUGGEST).find(([n]) => n.toLowerCase().startsWith(text.toLowerCase()))
    : undefined;
  return (
    <div className="w-full max-w-sm">
      <div className="rounded-xl bg-[#160833] border border-[#b79ced]/30 px-3.5 py-2.5 text-[13.5px] text-white min-h-[40px]">
        {text ? (
          <>
            {text}
            <span className="inline-block w-[2px] h-3.5 bg-white ml-0.5 align-middle animate-pulse" />
          </>
        ) : (
          <span className="text-neutral-500">Escribe un país…</span>
        )}
      </div>
      {/* espacio RESERVADO para la sugerencia: aparece sin tapar a Bordy ni la burbuja */}
      <div className="h-[46px] mt-1.5">
        {match && (
          <div className="pop-in rounded-xl bg-[#1c0b3e] border border-[#b79ced]/30 px-3.5 py-2.5 flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`https://flagcdn.com/${match[1]}.svg`} alt="" className="w-5 rounded-[2px]" />
            <span className="text-[13px] text-white">{match[0]}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// --- Tutorial completo ---
export default function BordyTutorial({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  const [chars, setChars] = useState(0);
  const [status, setStatus] = useState<DemoStatus>({});
  const [demoInput, setDemoInput] = useState("");
  const [hideNext, setHideNext] = useState(false);
  const { muted, ref: mutedRef, toggle } = useMuted();

  const full = STEPS[step].text;
  const typing = chars < full.length;

  // Typewriter + blips
  useEffect(() => {
    setChars(0);
    const id = setInterval(() => {
      setChars((c) => {
        if (c >= STEPS[step].text.length) { clearInterval(id); return c; }
        if (c % 3 === 0) blip(mutedRef.current);
        return c + 1;
      });
    }, TYPE_MS);
    return () => clearInterval(id);
  }, [step, mutedRef]);

  // Timeline del tablero por paso (el typing se expande letra a letra)
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (const ev of STEPS[step].timeline) {
      if (ev.input !== undefined) {
        if (ev.input === "") {
          timers.push(setTimeout(() => setDemoInput(""), ev.t));
        } else {
          const s = ev.input;
          for (let i = 1; i <= s.length; i++) {
            timers.push(setTimeout(() => {
              setDemoInput(s.slice(0, i));
              blip(mutedRef.current);
            }, ev.t + i * 75));
          }
        }
      }
      if (ev.set) {
        timers.push(setTimeout(() => {
          setStatus((prev) => {
            const n = { ...prev };
            for (const [name, st] of ev.set!) n[name] = st;
            return n;
          });
          const st = ev.set[0][1];
          chime(mutedRef.current, st === "yellow" ? [330, 262] : st === "red" ? [262, 175] : [659, 880]);
        }, ev.t));
      }
    }
    return () => timers.forEach(clearTimeout);
  }, [step, mutedRef]);

  function finish() {
    try { if (hideNext) localStorage.setItem("frontle-tutorial-hide", "1"); } catch {}
    onDone();
  }

  function next() {
    chime(mutedRef.current);
    if (typing) { setChars(full.length); return; }
    if (step < STEPS.length - 1) setStep(step + 1);
    else finish();
  }

  return (
    <div className="fixed inset-0 z-[60] bg-grid flex flex-col items-center justify-center px-5 gap-3 overflow-y-auto py-6"
      style={{ background: "radial-gradient(120% 90% at 50% 0%, #2a1257 0%, #1c0b3e 50%, #130729 100%)" }}>
      {/* progreso */}
      <div className="absolute top-0 inset-x-0 h-1 bg-white/10">
        <div className="h-full bg-gradient-to-r from-[#22d3ee] via-[#22c55e] to-[#fcff52] transition-all duration-500"
          style={{ width: `${((step + (typing ? 0.4 : 1)) / STEPS.length) * 100}%` }} />
      </div>
      <button onClick={toggle} aria-label="sonido"
        className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white/5 border border-[#b79ced]/25 text-base active:scale-90 transition">
        {muted ? "🔇" : "🔊"}
      </button>

      {/* tablero demo */}
      <DemoBoard status={status} />

      {/* input del juego: Bordy "escribe" aquí */}
      <InputDemo text={demoInput} />

      {/* Bordy + burbuja */}
      <div className="flex items-center gap-2 w-full max-w-sm">
        <div className="relative w-[76px] h-[90px] flex-none">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/bordy-m2.png" alt="Bordy"
            className={`w-full h-full object-contain drop-shadow-xl ${typing ? "bordy-talk" : "bordy-float-sm"}`} />
        </div>
        <div className="panel relative flex-1 px-4 py-3 min-h-[86px]">
          <p className="text-white text-[13.5px] leading-relaxed">
            <span className="mr-1.5">{STEPS[step].icon}</span>
            {full.slice(0, chars)}
            {typing && <span className="inline-block w-[2px] h-3.5 bg-white ml-0.5 align-middle animate-pulse" />}
          </p>
        </div>
      </div>

      {/* dots */}
      <div className="flex gap-2">
        {STEPS.map((_, i) => (
          <span key={i} className={`w-2 h-2 rounded-full transition ${i === step ? "bg-[#fcff52] scale-125" : i < step ? "bg-[#b79ced]" : "bg-white/20"}`} />
        ))}
      </div>

      {/* acciones */}
      <button onClick={next} className="btn-3d font-display font-bold text-lg px-11 py-3">
        {typing ? "..." : step < STEPS.length - 1 ? "Siguiente →" : "¡A jugar!"}
      </button>

      <label className="flex items-center gap-2 text-[11.5px] text-neutral-300 cursor-pointer select-none">
        <input type="checkbox" checked={hideNext} onChange={(e) => setHideNext(e.target.checked)}
          className="w-3.5 h-3.5 accent-[#fcff52]" />
        No volver a mostrar
      </label>
      <button onClick={finish} className="text-[11px] text-neutral-400 underline active:scale-95 transition -mt-1">
        Saltar tutorial
      </button>
    </div>
  );
}

// --- Pantalla rápida (veteranos): ¿Listo? 3 · 2 · 1 ---
export function QuickStart({ onDone, onFull }: { onDone: () => void; onFull: () => void }) {
  const [n, setN] = useState(3);
  const { ref: mutedRef } = useMuted();
  useEffect(() => {
    chime(mutedRef.current, [440 + (3 - n) * 110]);
    if (n === 0) { onDone(); return; }
    const id = setTimeout(() => setN(n - 1), 750);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n]);
  return (
    <div className="fixed inset-0 z-[60] bg-grid flex flex-col items-center justify-center gap-4"
      style={{ background: "radial-gradient(120% 90% at 50% 0%, #2a1257 0%, #1c0b3e 50%, #130729 100%)" }}>
      <div className="w-[96px] h-[112px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/bordy-m2.png" alt="Bordy" className="bordy-talk w-full h-full object-contain drop-shadow-xl" />
      </div>
      <p className="font-display font-bold text-white text-xl">¿Listo?</p>
      <div key={n} className="pop-in font-display font-bold text-7xl text-[#fcff52] tabular-nums drop-shadow-[0_0_24px_rgba(252,255,82,0.45)]">
        {n > 0 ? n : "¡YA!"}
      </div>
      <button onClick={onFull} className="text-[11px] text-neutral-400 underline mt-2">Ver tutorial completo</button>
    </div>
  );
}
