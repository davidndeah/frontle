"use client";

// ============================================================
//  RegionGame — pantalla de juego del modo Regiones (autocontenida).
//  Reto diario GRATIS por región: mismo loop que el mundial (semáforo,
//  cronómetro, chips, pista, victoria, SFX) pero con regionGame.ts +
//  RegionMap. Persistencia local por (día, región). Ranking global de
//  regiones = PR futura (migración `mode` en Supabase).
// ============================================================

import { useEffect, useMemo, useRef, useState } from "react";
import { dateSeed, type Status } from "../lib/game";
import { formatTime } from "../lib/ranking";
import {
  dailyRegionChallenge,
  tryRegionGuess,
  nextRegionHint,
  type RegionPlayState,
} from "../lib/regionGame";
import { awardRegionWin } from "../lib/xp";
import { spendCoins } from "../lib/coins";
import CoinShop from "./CoinShop";
import { REGIONS, regionGraph, resolveRegionEntity, suggestRegionEntities } from "../lib/regions";
import { t, type Locale } from "../lib/i18n";
import RegionMap from "./RegionMap";
import ScoreCard from "./ScoreCard";
import type { Square } from "../lib/scoreCard";
import { sfxGood, sfxLateral, sfxFar, sfxInvalid, sfxWin } from "../lib/sfx";
import type { BordyMood } from "./Bordy";

// Bandera de una subdivisión (PNG local; cae a marcador si falta).
// FLAGS-13: muchas subdivisiones (p.ej. Nigeria/Ghana) no tienen bandera
// oficial — el marcador debe verse INTENCIONAL: misma proporción 3:2 que
// una bandera, gradiente del tema y el código como monograma.
function EntityFlag({ regionId, code, size = 28 }: { regionId: string; code: string; size?: number }) {
  const [ok, setOk] = useState(true);
  if (!ok || !code) {
    return (
      <span
        className="inline-flex items-center justify-center rounded-[3px] border border-lavender/40 font-display font-bold text-[#e9d5ff] uppercase"
        style={{
          width: size,
          height: Math.round(size * (2 / 3)),
          fontSize: Math.max(9, size * 0.3),
          background: "linear-gradient(135deg, var(--surface) 0%, var(--bg) 100%)",
          letterSpacing: "0.05em",
        }}
      >
        {code?.slice(0, 3)}
      </span>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={`/flags/${regionId}/${code}.webp`}
      alt=""
      onError={() => setOk(false)}
      style={{ width: size, height: "auto", borderRadius: 3 }}
    />
  );
}

const CHIP: Record<Status, string> = {
  start: "border-cyan-400/50 text-cyan-100",
  end: "border-fuchsia-400/50 text-fuchsia-100",
  green: "border-emerald-400/50 text-emerald-100",
  yellow: "border-yellow-400/50 text-yellow-100",
  red: "border-rose-400/50 text-rose-100",
};

export default function RegionGame({
  regionId, locale, onExit, reactBordy,
}: {
  regionId: string; locale: Locale; onExit: () => void;
  /** Bordy vive en page.tsx (FAB fijo, global); este modo solo le avisa qué sintió. */
  reactBordy?: (m: BordyMood) => void;
}) {
  const def = REGIONS[regionId];
  const tr = t(locale);
  // Sustantivo localizado de las subdivisiones (departamento/state/província…)
  const nounForms = t(locale).subdivisionNoun[def.nounKey];
  const noun = nounForms.many;
  const graph = regionGraph(regionId);
  const day = dateSeed();
  const storeKey = `frontle-region-${day}-${regionId}`;
  const bestKey = `frontle-region-best-${day}-${regionId}`;

  const [state, setState] = useState<RegionPlayState>(() => ({
    challenge: dailyRegionChallenge(regionId, day),
    chain: [],
    solved: false,
  }));
  const [input, setInput] = useState("");
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [started, setStarted] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  // Las 3 pistas del reto diario, gratis en regiones (UX-6):
  const [showInitial, setShowInitial] = useState(false);
  const [showNextSil, setShowNextSil] = useState(false);
  const [showAllSil, setShowAllSil] = useState(false);
  const [best, setBest] = useState<number | null>(null);
  const startRef = useRef(0);
  // Tienda de monedas: se abre cuando una pista no alcanza el saldo.
  const [shopOpen, setShopOpen] = useState(false);
  async function paidHint(kind: "spend_hint" | "spend_hint_strong", already: boolean, apply: () => void) {
    if (already) return;
    const r = await spendCoins(kind, `region:${regionId}`);
    if (r === "ok") apply();
    else setShopOpen(true);
  }
  const inputRef = useRef<HTMLInputElement>(null);

  const { challenge } = state;

  // Restaurar partida del día (por región)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storeKey);
      if (raw) {
        const g = JSON.parse(raw);
        if (g?.started) {
          startRef.current = g.startMs || Date.now();
          setStarted(true);
          setState((p) => ({ ...p, chain: g.chain ?? [], solved: !!g.solved }));
          setElapsedMs(g.solved ? g.finalMs ?? 0 : Date.now() - (g.startMs || Date.now()));
        }
      }
      const b = localStorage.getItem(bestKey);
      if (b) setBest(parseInt(b, 10));
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regionId]);

  useEffect(() => {
    setSuggestions(input.length >= 2 ? suggestRegionEntities(regionId, input) : []);
  }, [input, regionId]);

  useEffect(() => {
    if (!started || state.solved) return;
    const id = setInterval(() => setElapsedMs(Date.now() - startRef.current), 250);
    return () => clearInterval(id);
  }, [started, state.solved]);

  function save(g: { started: boolean; solved: boolean; chain: RegionPlayState["chain"]; finalMs?: number }) {
    try {
      localStorage.setItem(storeKey, JSON.stringify({ ...g, startMs: startRef.current }));
    } catch {}
  }

  function start() {
    startRef.current = Date.now();
    setElapsedMs(0);
    setStarted(true);
    save({ started: true, solved: false, chain: [] });
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  const statusByEntity = useMemo(() => {
    const m: Record<string, Status> = { [challenge.start]: "start", [challenge.end]: "end" };
    for (const c of state.chain) m[c.entity] = c.quality;
    return m;
  }, [challenge, state.chain]);

  const hintEntity = useMemo(() => (showInitial || showNextSil ? nextRegionHint(state) : null), [showInitial, showNextSil, state]);

  function submit(value: string) {
    if (state.solved || !started) return;
    const canonical = resolveRegionEntity(regionId, value);
    const res = tryRegionGuess(state, value, canonical);
    setMessage({
      text: tr.feedback(res.reason, {
        country: res.entity,
        end: challenge.end,
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

    if (res.ok && res.entity && res.quality) {
      const chain = [...state.chain, { entity: res.entity, quality: res.quality }];
      const solved = res.solved;
      setState((p) => ({ ...p, chain, solved }));
      setShowInitial(false);
      setShowNextSil(false);
      const finalMs = solved ? Date.now() - startRef.current : undefined;
      save({ started: true, solved, chain, finalMs });
      if (solved) {
        setElapsedMs(finalMs!);
        const score = chain.length;
        if (best === null || score < best) {
          setBest(score);
          try { localStorage.setItem(bestKey, String(score)); } catch {}
        }
        // Liga v2: completar un país da XP (tope diario en el servidor).
        awardRegionWin();
      }
    }
    setInput("");
    setSuggestions([]);
    inputRef.current?.focus();
  }

  const startCode = graph.codeOf[challenge.start];
  const endCode = graph.codeOf[challenge.end];
  const guessCount = state.chain.length;

  return (
    <div className="flex flex-col gap-4">
      {/* volver */}
      <CoinShop tr={tr} open={shopOpen} onClose={() => setShopOpen(false)} />
      <button onClick={onExit} className="flex items-center gap-2 text-sm text-neutral-300 active:scale-95 transition w-fit">
        <span className="w-7 h-7 rounded-full bg-white/5 border border-lavender/25 flex items-center justify-center">←</span>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/flags/national/${regionId}.webp`} alt="" className="w-5 h-3.5 object-cover rounded-sm border border-white/20" />
        <span className="font-display font-semibold">{def.title}</span>
      </button>

      {/* reto */}
      <section className="panel p-4">
        <p className="text-[10px] uppercase tracking-[0.2em] text-neutral-300 text-center mb-3">
          {tr.region.challengeOfDay} · {noun}
        </p>
        <div className="flex items-center justify-between gap-2">
          <div className="flex-1 flex flex-col items-center text-center">
            <EntityFlag regionId={regionId} code={startCode} size={40} />
            <div className="text-sm font-semibold mt-1 text-cyan-300">{challenge.start}</div>
          </div>
          <div className="text-2xl text-neutral-400">→</div>
          <div className="flex-1 flex flex-col items-center text-center">
            <EntityFlag regionId={regionId} code={endCode} size={40} />
            <div className="text-sm font-semibold mt-1 text-fuchsia-300">{challenge.end}</div>
          </div>
        </div>
        <p className="text-center text-xs text-neutral-300 mt-3">
          {started ? tr.region.optimalRoute(challenge.optimal, noun) : tr.region.timerStarts}
        </p>
      </section>

      {started ? (
        <>
          <p className="text-center -my-1">
            <span className="inline-block text-lg font-mono font-bold bg-surface/60 border border-lavender/20 rounded-full px-4 py-1 tabular-nums">
              🕒 {formatTime(elapsedMs)}
            </span>
          </p>

          <RegionMap
            regionId={regionId}
            statusByEntity={statusByEntity}
            loadingLabel={tr.loadingMap}
            controls={tr.a11y}
            silhouettes={showNextSil && hintEntity ? [hintEntity] : []}
            showAllOutlines={showAllSil}
            resetKey={`${challenge.start}->${challenge.end}`}
          />

          {/* chips de la ruta */}
          <section className="flex flex-wrap justify-center gap-2">
            <RChip regionId={regionId} name={challenge.start} code={startCode} kind="start" />
            {state.chain.map((c) => (
              <RChip key={c.entity} regionId={regionId} name={c.entity} code={graph.codeOf[c.entity]} kind={c.quality} />
            ))}
            <RChip regionId={regionId} name={challenge.end} code={endCode} kind="end" />
          </section>

          {state.solved ? (
            <RegionWin tr={tr} noun={noun} guesses={guessCount} optimal={challenge.optimal} timeMs={elapsedMs} onExit={onExit} def={def} squares={["start", ...state.chain.map((c) => c.quality), "end"]} />
          ) : (
            <section className="relative flex flex-col gap-3">
              <form onSubmit={(e) => { e.preventDefault(); if (input.trim()) submit(input); }} className="flex gap-2">
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={tr.region.placeholder(nounForms.one)}
                  autoComplete="off"
                  className="flex-1 rounded-xl bg-base border border-lavender/30 px-4 py-3 text-base text-white outline-none focus:border-gold/70 transition"
                />
                <button type="submit" className="brutal-sm brutal-press rounded-xl bg-gold px-5 py-3 font-bold text-surface">OK</button>
              </form>

              {suggestions.length > 0 && (
                <ul className="absolute z-20 top-14 w-full rounded-xl bg-surface border border-lavender/30 overflow-hidden shadow-2xl">
                  {suggestions.map((s) => (
                    <li key={s}>
                      <button type="button" onClick={() => submit(s)} className="w-full text-left px-4 py-2.5 hover:bg-white/10 flex items-center gap-2">
                        <EntityFlag regionId={regionId} code={graph.codeOf[s]} size={22} />
                        <span>{s}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {message && (
                <p className={`text-center text-sm ${message.ok ? "text-emerald-400" : "text-rose-400"}`}>{message.text}</p>
              )}

              {showInitial && hintEntity && (
                <p className="text-center text-sm text-gold">💡 {tr.region.hintNextInitial(hintEntity.charAt(0), nounForms.one)}</p>
              )}
              {/* Pistas de la liga: se pagan con monedas (v2 §5.2). El precio
                  lo valida el servidor; sin saldo, se abre la tienda. */}
              <div className="flex flex-wrap items-center justify-center gap-2">
                <HintBtn onClick={() => void paidHint("spend_hint", showInitial, () => setShowInitial(true))} active={showInitial} label={`🔤 ${tr.region.hintInitial(nounForms.one)} · ${tr.coins.cost(3)}`} />
                <HintBtn onClick={() => void paidHint("spend_hint", showNextSil, () => setShowNextSil(true))} active={showNextSil} label={`👤 ${tr.region.hintSilNext(nounForms.one)} · ${tr.coins.cost(3)}`} />
                <HintBtn onClick={() => void paidHint("spend_hint_strong", showAllSil, () => setShowAllSil(true))} active={showAllSil} label={`🗺️ ${tr.region.hintSilAll(nounForms.many)} · ${tr.coins.cost(5)}`} />
              </div>
              <p className="text-center text-xs text-neutral-400">{tr.practiceHint} · {tr.region.used(guessCount)}</p>
            </section>
          )}
        </>
      ) : (
        <div className="w-full flex flex-col items-center gap-2 py-2">
          <button onClick={start} className="btn-3d font-display font-bold text-2xl px-12 py-4">{tr.play}</button>
          {best !== null && <p className="text-xs text-neutral-400">{tr.region.bestToday(best, noun)}</p>}
        </div>
      )}
    </div>
  );
}

function RChip({ regionId, name, code, kind }: { regionId: string; name: string; code: string; kind: Status }) {
  return (
    <div className={`flex flex-col items-center justify-center rounded-xl border bg-surface/55 backdrop-blur-sm px-3 py-2 min-w-[84px] ${CHIP[kind]}`}>
      <EntityFlag regionId={regionId} code={code} size={26} />
      <span className="text-[11px] font-medium mt-1 text-center leading-tight">{name}</span>
    </div>
  );
}

function RegionWin({
  tr, noun, guesses, optimal, timeMs, onExit, def, squares,
}: {
  tr: ReturnType<typeof t>; noun: string; guesses: number; optimal: number; timeMs: number; onExit: () => void;
  def: { flag: string; title: string }; squares: Square[];
}) {
  const perfect = guesses <= optimal;
  const stars = perfect ? 3 : guesses <= optimal + 1 ? 2 : 1;
  const shareText = `🌍 Frontle ${def.flag} ${def.title}\n${"⭐".repeat(stars)} · ${guesses} ${noun} · ${formatTime(timeMs)}\nfrontle.vercel.app`;

  return (
    <section className="panel p-5 text-center">
      <div className="text-3xl font-black prism-text">{perfect ? tr.winPerfect : tr.winNormal}</div>
      <p className="text-neutral-200 mt-2">
        {tr.region.winText(guesses, optimal, perfect, noun)}
      </p>
      <div className="mt-4">
        <ScoreCard
          data={{
            modeLabel: `${tr.modes.regionsTitle} · ${def.title}`,
            dateLabel: new Date().toLocaleDateString(),
            stars,
            squares,
            stats: [`${guesses} ${noun}`, formatTime(timeMs)],
          }}
          shareText={shareText}
          label={tr.share}
          copiedLabel={tr.copied}
        />
      </div>
      <button onClick={onExit} className="brutal-sm brutal-press mt-3 w-full rounded-xl bg-surface px-6 py-3 font-bold text-white">
        {tr.region.chooseOtherMode}
      </button>
      <p className="text-[11px] text-neutral-400 mt-3">{tr.region.modeFooter(def.title)}</p>
    </section>
  );
}

// Botón de pista (gratis) — mismo trío que el reto diario.
function HintBtn({ onClick, active, label }: { onClick: () => void; active: boolean; label: string }) {
  return (
    <button
      onClick={onClick}
      disabled={active}
      className="brutal-sm brutal-press rounded-lg bg-surface px-3 py-1.5 text-xs text-white disabled:opacity-50"
    >
      {label} {active ? "✓" : ""}
    </button>
  );
}
