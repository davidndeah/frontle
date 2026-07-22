"use client";

// ============================================================
//  BordyTutorial — tutorial visual al pulsar Jugar (1ª vez).
//  Mini-tablero demo animado (Portugal → Alemania, error amarillo
//  de Suiza — igual que el video) + Bordy hablando con typewriter
//  y robot-chatter (Web Audio). Incluye checkbox "no volver a
//  mostrar" y QuickStart (3·2·1) para veteranos.
// ============================================================

import { useEffect, useMemo, useRef, useState } from "react";
import { TUTORIAL_MAP } from "../lib/tutorialMap";
import { countryName, t, type Locale } from "../lib/i18n";
import { STATUS_COLORS } from "../lib/theme";

type Dict = ReturnType<typeof t>;

// El tablero de ejemplo tiene que enseñar los MISMOS colores que el juego
// real, o el tutorial estaría entrenando con un semáforo que no existe.
const COLORS: Record<string, string> = { ...STATUS_COLORS, off: "transparent" };

type DemoStatus = Record<string, keyof typeof COLORS | "off">;

type Step = {
  icon: string;
  text: string;
  timeline: { t: number; input?: string; set?: [string, keyof typeof COLORS][] }[];
};

// Guion sincronizado: texto de Bordy (del diccionario) + animaciones del
// tablero por paso. Los nombres que Bordy "escribe" salen de countryName
// (Intl por código ISO) para que el demo hable el idioma del jugador.
function buildSteps(tr: Dict, locale: Locale): Step[] {
  const n = (canonical: string) => countryName(canonical, locale);
  return [
    {
      icon: "🌍",
      text: tr.tutorialSteps[0],
      timeline: [
        { t: 200, set: [["Portugal", "start"], ["Germany", "end"]] },
      ],
    },
    {
      icon: "🟢",
      text: tr.tutorialSteps[1],
      timeline: [
        { t: 300, input: n("Spain") },
        { t: 1800, input: "", set: [["Spain", "green"]] },
      ],
    },
    {
      icon: "🟡",
      text: tr.tutorialSteps[2],
      timeline: [
        { t: 300, input: n("Switzerland") },
        { t: 1800, input: "", set: [["Switzerland", "yellow"]] },
      ],
    },
    {
      icon: "🔴",
      text: tr.tutorialSteps[3],
      timeline: [
        { t: 300, input: n("Morocco") },
        { t: 1800, input: "", set: [["Morocco", "red"]] },
      ],
    },
    {
      icon: "🏆",
      text: tr.tutorialSteps[4],
      timeline: [
        { t: 300, input: n("France") },
        { t: 1800, input: "", set: [["France", "green"]] },
      ],
    },
  ];
}

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
function DemoBoard({ status, locale }: { status: DemoStatus; locale: Locale }) {
  const revealed = TUTORIAL_MAP.play.filter((p) => status[p.name] && status[p.name] !== "off");
  return (
    <div className="panel w-full max-w-sm p-3 pop-in">
      {/* header del reto */}
      <div className="flex items-center justify-center gap-3 mb-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="https://flagcdn.com/pt.svg" alt="" className="w-7 rounded-[3px]" />
        <span className="text-[13px] font-bold text-cyan-300">{countryName("Portugal", locale)}</span>
        <span className="text-neutral-400">→</span>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="https://flagcdn.com/de.svg" alt="" className="w-7 rounded-[3px]" />
        <span className="text-[13px] font-bold text-fuchsia-300">{countryName("Germany", locale)}</span>
      </div>
      {/* mapa */}
      <div className="rounded-xl overflow-hidden bg-panel border border-lavender/20">
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
            <span key={p.name} className="pop-in flex items-center gap-1 rounded-lg border bg-surface/60 px-1.5 py-0.5" style={{ borderColor: c }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`https://flagcdn.com/${p.code}.svg`} alt="" className="w-4 rounded-[2px]" />
              <span className="text-[9px] text-white font-semibold">{countryName(p.name, locale)}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

// Input del juego (demo): Bordy "escribe" y aparece la sugerencia con bandera.
// Los países del demo, con su nombre localizado (Intl) para el autocompletado.
const SUGGEST_COUNTRIES: { canonical: string; code: string }[] = [
  { canonical: "Spain", code: "es" },
  { canonical: "Switzerland", code: "ch" },
  { canonical: "Morocco", code: "ma" },
  { canonical: "France", code: "fr" },
];
function InputDemo({ text, locale, placeholder }: { text: string; locale: Locale; placeholder: string }) {
  const match = text.length >= 2
    ? SUGGEST_COUNTRIES
        .map((c) => ({ name: countryName(c.canonical, locale), code: c.code }))
        .find((c) => c.name.toLowerCase().startsWith(text.toLowerCase()))
    : undefined;
  return (
    <div className="w-full max-w-sm">
      <div className="rounded-xl bg-base border border-lavender/30 px-3.5 py-2.5 text-[13.5px] text-white min-h-[40px]">
        {text ? (
          <>
            {text}
            <span className="inline-block w-[2px] h-3.5 bg-white ml-0.5 align-middle animate-pulse" />
          </>
        ) : (
          <span className="text-neutral-400">{placeholder}</span>
        )}
      </div>
      {/* espacio RESERVADO para la sugerencia: aparece sin tapar a Bordy ni la burbuja */}
      <div className="h-[46px] mt-1.5">
        {match && (
          <div className="pop-in rounded-xl bg-surface border border-lavender/30 px-3.5 py-2.5 flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`https://flagcdn.com/${match.code}.svg`} alt="" className="w-5 rounded-[2px]" />
            <span className="text-[13px] text-white">{match.name}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// --- Tutorial completo ---
export default function BordyTutorial({ tr, locale, onDone }: { tr: Dict; locale: Locale; onDone: () => void }) {
  const [step, setStep] = useState(0);
  const [chars, setChars] = useState(0);
  const [status, setStatus] = useState<DemoStatus>({});
  const [demoInput, setDemoInput] = useState("");
  const [hideNext, setHideNext] = useState(false);
  const { muted, ref: mutedRef, toggle } = useMuted();
  const STEPS = useMemo(() => buildSteps(tr, locale), [tr, locale]);

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
  }, [step, mutedRef, STEPS]);

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
          const st = ev.set![0][1];
          chime(mutedRef.current, st === "yellow" ? [330, 262] : st === "red" ? [262, 175] : [659, 880]);
        }, ev.t));
      }
    }
    return () => timers.forEach(clearTimeout);
  }, [step, mutedRef, STEPS]);

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
      style={{ background: "var(--body-grad)" }}>
      {/* progreso */}
      <div className="absolute top-0 inset-x-0 h-1 bg-white/10">
        <div className="h-full bg-gradient-to-r from-[#22d3ee] via-[#22c55e] to-gold transition-all duration-500"
          style={{ width: `${((step + (typing ? 0.4 : 1)) / STEPS.length) * 100}%` }} />
      </div>
      <button onClick={toggle} aria-label={tr.a11y.sound}
        className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white/5 border border-lavender/25 text-base active:scale-90 transition">
        {muted ? "🔇" : "🔊"}
      </button>

      {/* tablero demo */}
      <DemoBoard status={status} locale={locale} />

      {/* input del juego: Bordy "escribe" aquí */}
      <InputDemo text={demoInput} locale={locale} placeholder={tr.placeholder} />

      {/* Bordy + burbuja */}
      <div className="flex items-center gap-2 w-full max-w-sm">
        <div className="relative w-[76px] h-[90px] flex-none">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/bordy-m2.webp" alt="Bordy"
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
          <span key={i} className={`w-2 h-2 rounded-full transition ${i === step ? "bg-gold scale-125" : i < step ? "bg-lavender" : "bg-white/20"}`} />
        ))}
      </div>

      {/* acciones */}
      <button onClick={next} className="btn-3d font-display font-bold text-lg px-11 py-3">
        {typing ? "..." : step < STEPS.length - 1 ? tr.tutNext : tr.tutPlay}
      </button>

      <label className="flex items-center gap-2 text-[11.5px] text-neutral-300 cursor-pointer select-none">
        <input type="checkbox" checked={hideNext} onChange={(e) => setHideNext(e.target.checked)}
          className="w-3.5 h-3.5 accent-gold" />
        {tr.dontShowAgain}
      </label>
      <button onClick={finish} className="text-[11px] text-neutral-400 underline active:scale-95 transition -mt-1">
        {tr.skipTutorial}
      </button>
    </div>
  );
}

// --- Pantalla rápida (veteranos): ¿Listo? 3 · 2 · 1 ---
export function QuickStart({ tr, onDone, onFull }: { tr: Dict; onDone: () => void; onFull: () => void }) {
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
      style={{ background: "var(--body-grad)" }}>
      <div className="w-[96px] h-[112px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/bordy-m2.webp" alt="Bordy" className="bordy-talk w-full h-full object-contain drop-shadow-xl" />
      </div>
      <p className="font-display font-bold text-white text-xl">{tr.ready}</p>
      <div key={n} className="pop-in font-display font-bold text-7xl text-gold tabular-nums drop-shadow-[0_0_24px_rgba(252,255,82,0.45)]">
        {n > 0 ? n : tr.go}
      </div>
      <button onClick={onFull} className="text-[11px] text-neutral-400 underline mt-2">{tr.fullTutorial}</button>
    </div>
  );
}
