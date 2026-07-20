"use client";

// ============================================================
//  PracticeGame — modo práctica (pestaña Aprender).
//  Juego mundial infinito, SIN premios ni pot: retos aleatorios uno
//  tras otro. Ayuda a aprender: contornos de TODOS los países visibles
//  y pistas GRATIS y progresivas (silueta → inicial → nombre). No hay
//  cronómetro competitivo ni ranking; es puro entrenamiento.
// ============================================================

import { useEffect, useMemo, useRef, useState } from "react";
import {
  randomChallenge,
  tryGuess,
  nextHintCountry,
  type PlayState,
  type Status,
  type Difficulty,
} from "../lib/game";
import { getCountry } from "../lib/countries";
import { countryName, resolveLocalized, suggestLocalized, t, type Locale } from "../lib/i18n";
import { formatTime } from "../lib/ranking";
import WorldMap from "./WorldMap";
import ScoreCard from "./ScoreCard";
import PrecisionStars from "./PrecisionStars";
import { sfxGood, sfxLateral, sfxFar, sfxInvalid, sfxWin } from "../lib/sfx";
import { awardPracticeSolve } from "../lib/xp";
import { spendCoins } from "../lib/coins";
import CoinShop from "./CoinShop";

// Bandera de país (SVG de flagcdn), igual que el juego principal.
function CFlag({ name, size = 28 }: { name: string; size?: number }) {
  const c = getCountry(name);
  if (!c) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`https://flagcdn.com/${c.code.toLowerCase()}.svg`} alt="" style={{ width: size, height: "auto", borderRadius: 3 }} />;
}

const CHIP: Record<Status, string> = {
  start: "border-cyan-400/50 text-cyan-100",
  end: "border-fuchsia-400/50 text-fuchsia-100",
  green: "border-emerald-400/50 text-emerald-100",
  yellow: "border-yellow-400/50 text-yellow-100",
  red: "border-rose-400/50 text-rose-100",
};

export default function PracticeGame({ locale, onExit }: { locale: Locale; onExit: () => void }) {
  const tr = t(locale);
  const [state, setState] = useState<PlayState | null>(null);
  const [input, setInput] = useState("");
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [elapsedMs, setElapsedMs] = useState(0);
  // Dificultad elegible (UX-5) + las 3 pistas del reto diario, gratis:
  const [level, setLevel] = useState<Difficulty>("easy");
  const [showInitial, setShowInitial] = useState(false);
  const [showNextSil, setShowNextSil] = useState(false);
  const [round, setRound] = useState(0);
  const startRef = useRef(0);
  // Tienda de monedas: se abre cuando una pista no alcanza el saldo.
  const [shopOpen, setShopOpen] = useState(false);
  async function paidHint(already: boolean, apply: () => void) {
    if (already) return;
    const r = await spendCoins("spend_hint", "practice");
    if (r === "ok") apply();
    else setShopOpen(true);
  }
  const inputRef = useRef<HTMLInputElement>(null);

  // Reto aleatorio nuevo (arranca en cliente para no romper la hidratación).
  function newRound(lv: Difficulty = level) {
    setState({ challenge: randomChallenge(lv), chain: [], solved: false });
    setInput("");
    setMessage(null);
    setSuggestions([]);
    setShowInitial(false);
    setShowNextSil(false);
    startRef.current = Date.now();
    setElapsedMs(0);
    setRound((r) => r + 1);
    setTimeout(() => inputRef.current?.focus(), 50);
  }
  useEffect(() => {
    newRound();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setSuggestions(input.length >= 2 ? suggestLocalized(input, locale) : []);
  }, [input, locale]);

  useEffect(() => {
    if (!state || state.solved) return;
    const id = setInterval(() => setElapsedMs(Date.now() - startRef.current), 250);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.solved, round]);

  const statusByCountry = useMemo(() => {
    if (!state) return {} as Record<string, Status>;
    const m: Record<string, Status> = { [state.challenge.start]: "start", [state.challenge.end]: "end" };
    for (const c of state.chain) m[c.country] = c.quality;
    return m;
  }, [state]);

  const hintCountry = useMemo(() => (state && (showInitial || showNextSil) ? nextHintCountry(state) : null), [state, showInitial, showNextSil]);

  function submit(value: string) {
    if (!state || state.solved) return;
    const canonical = resolveLocalized(value);
    const res = tryGuess(state, value, canonical);
    const localized = res.country ? countryName(res.country, locale) : "";
    setMessage({
      text: tr.feedback(res.reason, {
        country: localized,
        end: countryName(state.challenge.end, locale),
        quality: res.quality,
        input: res.input,
      }),
      ok: res.ok,
    });
    if (!res.ok) sfxInvalid();
    else if (res.solved) sfxWin();
    else if (res.quality === "green") sfxGood();
    else if (res.quality === "yellow") sfxLateral();
    else if (res.quality === "red") sfxFar();

    if (res.ok && res.country && res.quality) {
      const chain = [...state.chain, { country: res.country, quality: res.quality }];
      const solved = res.solved;
      setState({ ...state, chain, solved });
      setShowInitial(false);
      setShowNextSil(false);
      if (solved) {
        setElapsedMs(Date.now() - startRef.current);
        // Liga v2: reto de práctica resuelto da XP (tope diario en el servidor).
        awardPracticeSolve();
      }
    }
    setInput("");
    setSuggestions([]);
    inputRef.current?.focus();
  }

  if (!state) {
    return <div className="py-10 text-center text-neutral-300 text-sm">{tr.loadingMap}</div>;
  }

  const { challenge } = state;
  const guessCount = state.chain.length;
  const optimal = challenge.optimal;
  const stars: 1 | 2 | 3 = guessCount <= optimal ? 3 : guessCount <= optimal + 1 ? 2 : 1;


  return (
    <div className="flex flex-col gap-4">
      {/* volver */}
      <CoinShop tr={tr} open={shopOpen} onClose={() => setShopOpen(false)} />
      <button onClick={onExit} className="flex items-center gap-2 text-sm text-neutral-300 active:scale-95 transition w-fit">
        <span className="w-7 h-7 rounded-full bg-white/5 border border-[#b79ced]/25 flex items-center justify-center">←</span>
        <span className="font-display font-semibold">🎓 {tr.practiceMode}</span>
      </button>

      {/* reto */}
      <section className="panel p-4">
        <p className="text-[10px] uppercase tracking-[0.2em] text-neutral-300 text-center mb-3">
          {tr.practiceFree}
        </p>
        <div className="flex items-center justify-between gap-2">
          <div className="flex-1 flex flex-col items-center text-center">
            <CFlag name={challenge.start} size={40} />
            <div className="text-sm font-semibold mt-1 text-cyan-300">{countryName(challenge.start, locale)}</div>
          </div>
          <div className="text-2xl text-neutral-400">→</div>
          <div className="flex-1 flex flex-col items-center text-center">
            <CFlag name={challenge.end} size={40} />
            <div className="text-sm font-semibold mt-1 text-fuchsia-300">{countryName(challenge.end, locale)}</div>
          </div>
        </div>
        <p className="text-center text-xs text-neutral-300 mt-3">{tr.optimal(optimal)}</p>
        {/* Dificultad: cambiarla arranca una ronda nueva de ese nivel */}
        <div className="flex justify-center gap-2 mt-3">
          {(["easy", "medium", "hard"] as Difficulty[]).map((lv) => (
            <button
              key={lv}
              onClick={() => { setLevel(lv); newRound(lv); }}
              className={`brutal-sm brutal-press rounded-lg px-3 py-1.5 text-xs font-semibold ${level === lv ? "bg-[#fcff52] text-[#1c0b3e]" : "bg-[#1c0b3e] text-white"}`}
            >
              {tr.levels[lv]}
            </button>
          ))}
        </div>
      </section>

      {!state.solved && (
        <p className="text-center -my-1">
          <span className="inline-block text-lg font-mono font-bold bg-[#1c0b3e]/60 border border-[#b79ced]/20 rounded-full px-4 py-1 tabular-nums">
            🕒 {formatTime(elapsedMs)}
          </span>
        </p>
      )}

      {/* mapa con TODOS los contornos visibles (para aprender) */}
      <WorldMap
        statusByCountry={statusByCountry}
        loadingLabel={tr.loadingMap}
        silhouettes={showNextSil && hintCountry ? [hintCountry] : []}
        showAllOutlines
        resetKey={`${challenge.start}->${challenge.end}`}
        controls={tr.a11y}
      />

      {/* chips de la ruta */}
      <section className="flex flex-wrap justify-center gap-2">
        <PChip name={countryName(challenge.start, locale)} raw={challenge.start} kind="start" />
        {state.chain.map((c) => (
          <PChip key={c.country} name={countryName(c.country, locale)} raw={c.country} kind={c.quality} />
        ))}
        <PChip name={countryName(challenge.end, locale)} raw={challenge.end} kind="end" />
      </section>

      {state.solved ? (
        <section className="panel p-5 text-center">
          <div className="text-2xl font-black prism-text">{stars === 3 ? tr.winPerfect : tr.winNormal}</div>
          <PrecisionStars count={stars} label={tr.starsLabel(stars)} />
          <p className="text-neutral-200 mt-2">{tr.winText(guessCount, optimal, stars === 3)}</p>
          <div className="mt-4">
            <ScoreCard
              data={{
                modeLabel: tr.practiceMode,
                dateLabel: new Date().toLocaleDateString(locale),
                stars,
                squares: ["start", ...state.chain.map((c) => c.quality), "end"],
                stats: [tr.winText(guessCount, optimal, stars === 3), formatTime(elapsedMs)],
              }}
              shareText={`🌍 Frontle · ${tr.practiceMode}
${"⭐".repeat(stars)}
frontle.vercel.app`}
              label={tr.share}
              copiedLabel={tr.copied}
            />
          </div>
          <div className="flex flex-col gap-2 mt-4">
            <button onClick={() => newRound()} className="brutal-sm brutal-press rounded-xl bg-[#fcff52] px-6 py-3 font-bold text-[#1c0b3e]">
              🔄 {tr.practiceNextRound}
            </button>
            <button onClick={onExit} className="brutal-sm brutal-press rounded-xl bg-[#1c0b3e] px-6 py-3 font-bold text-white">
              {tr.practiceExit}
            </button>
          </div>
        </section>
      ) : (
        <section className="relative flex flex-col gap-3">
          <form onSubmit={(e) => { e.preventDefault(); if (input.trim()) submit(input); }} className="flex gap-2">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={tr.placeholder}
              autoComplete="off"
              className="flex-1 rounded-xl bg-[#160833] border border-[#b79ced]/30 px-4 py-3 text-base text-white outline-none focus:border-[#fcff52]/70 transition"
            />
            <button type="submit" className="brutal-sm brutal-press rounded-xl bg-[#fcff52] px-5 py-3 font-bold text-[#1c0b3e]">OK</button>
          </form>

          {suggestions.length > 0 && (
            <ul className="absolute z-20 top-14 w-full rounded-xl bg-[#1c0b3e] border border-[#b79ced]/30 overflow-hidden shadow-2xl">
              {suggestions.map((s) => (
                <li key={s}>
                  <button type="button" onClick={() => submit(s)} className="w-full text-left px-4 py-2.5 hover:bg-white/10 flex items-center gap-2">
                    <CFlag name={s} size={22} />
                    <span>{countryName(s, locale)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {message && (
            <p className={`text-center text-sm ${message.ok ? "text-emerald-400" : "text-rose-400"}`}>{message.text}</p>
          )}

          {showInitial && hintCountry && (
            <p className="text-center text-sm text-[#fcff52]">💡 {tr.hintNextInitial(countryName(hintCountry, locale).charAt(0))}</p>
          )}

          {/* Pistas de la liga: se pagan con monedas (v2 §5.2). */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            <PHintBtn onClick={() => void paidHint(showInitial, () => setShowInitial(true))} active={showInitial} label={`🔤 ${tr.hintInitial} · ${tr.coins.cost(3)}`} />
            <PHintBtn onClick={() => void paidHint(showNextSil, () => setShowNextSil(true))} active={showNextSil} label={`👤 ${tr.hintSilhouetteNext} · ${tr.coins.cost(3)}`} />
          </div>
          <p className="text-center text-xs text-neutral-400">{tr.practiceHint} · {tr.used(guessCount)}</p>
        </section>
      )}
    </div>
  );
}

function PChip({ name, raw, kind }: { name: string; raw: string; kind: Status }) {
  return (
    <div className={`flex flex-col items-center justify-center rounded-xl border bg-[#1c0b3e]/55 backdrop-blur-sm px-3 py-2 min-w-[84px] ${CHIP[kind]}`}>
      <CFlag name={raw} size={26} />
      <span className="text-[11px] font-medium mt-1 text-center leading-tight">{name}</span>
    </div>
  );
}

// Botón de pista (gratis) — mismo trío que el reto diario.
function PHintBtn({ onClick, active, label }: { onClick: () => void; active: boolean; label: string }) {
  return (
    <button
      onClick={onClick}
      disabled={active}
      className="brutal-sm brutal-press rounded-lg bg-[#1c0b3e] px-3 py-1.5 text-xs text-white disabled:opacity-50"
    >
      {label} {active ? "✓" : ""}
    </button>
  );
}
