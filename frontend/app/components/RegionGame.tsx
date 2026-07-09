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
import { REGIONS, regionGraph, resolveRegionEntity, suggestRegionEntities } from "../lib/regions";
import RegionMap from "./RegionMap";
import { sfxGood, sfxLateral, sfxFar, sfxInvalid, sfxWin } from "../lib/sfx";

// Bandera de una subdivisión (PNG local; cae a marcador si falta)
function EntityFlag({ regionId, code, size = 28 }: { regionId: string; code: string; size?: number }) {
  const [ok, setOk] = useState(true);
  if (!ok || !code) {
    return (
      <span
        className="inline-flex items-center justify-center rounded bg-[#160833] border border-[#b79ced]/40 text-[10px] font-bold text-[#c4b5fd]"
        style={{ width: size, height: size * 0.7 }}
      >
        {code?.slice(0, 2).toUpperCase()}
      </span>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={`/flags/${regionId}/${code}.png`}
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

export default function RegionGame({ regionId, onExit }: { regionId: string; onExit: () => void }) {
  const def = REGIONS[regionId];
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
  const [showHint, setShowHint] = useState(false);
  const [best, setBest] = useState<number | null>(null);
  const startRef = useRef(0);
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

  const hintEntity = useMemo(() => (showHint ? nextRegionHint(state) : null), [showHint, state]);

  function submit(value: string) {
    if (state.solved || !started) return;
    const canonical = resolveRegionEntity(regionId, value);
    const res = tryRegionGuess(state, value, canonical);
    const noun = def.entityNoun;
    setMessage({
      text:
        res.reason === "unknown" ? `No reconozco "${res.input}".`
        : res.reason === "revealed" ? `${res.entity} ya está en el mapa.`
        : res.reason === "duplicate" ? `${res.entity} ya está en tu ruta.`
        : res.reason === "not_adjacent" ? `${res.entity} no limita con ningún ${noun.replace(/s$/, "")} revelado.`
        : res.quality === "green" ? `${res.entity} ✓`
        : res.quality === "yellow" ? `${res.entity} — vas de lado`
        : `${res.entity} — te alejaste`,
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
      setShowHint(false);
      const finalMs = solved ? Date.now() - startRef.current : undefined;
      save({ started: true, solved, chain, finalMs });
      if (solved) {
        setElapsedMs(finalMs!);
        const score = chain.length;
        if (best === null || score < best) {
          setBest(score);
          try { localStorage.setItem(bestKey, String(score)); } catch {}
        }
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
      <button onClick={onExit} className="flex items-center gap-2 text-sm text-neutral-300 active:scale-95 transition w-fit">
        <span className="w-7 h-7 rounded-full bg-white/5 border border-[#b79ced]/25 flex items-center justify-center">←</span>
        <span className="font-display font-semibold">{def.flag} {def.title}</span>
      </button>

      {/* reto */}
      <section className="panel p-4">
        <p className="text-[10px] uppercase tracking-[0.2em] text-neutral-300 text-center mb-3">
          Reto del día · {def.entityNoun}
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
          {started ? `Ruta óptima: ${challenge.optimal} ${def.entityNoun}` : "El cronómetro arranca al pulsar Jugar"}
        </p>
      </section>

      {started ? (
        <>
          <p className="text-center -my-1">
            <span className="inline-block text-lg font-mono font-bold bg-[#1c0b3e]/60 border border-[#b79ced]/20 rounded-full px-4 py-1 tabular-nums">
              🕒 {formatTime(elapsedMs)}
            </span>
          </p>

          <RegionMap
            regionId={regionId}
            statusByEntity={statusByEntity}
            loadingLabel="Cargando mapa…"
            silhouettes={hintEntity ? [hintEntity] : []}
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
            <RegionWin regionId={regionId} guesses={guessCount} optimal={challenge.optimal} timeMs={elapsedMs} onExit={onExit} def={def} chain={[challenge.start, ...state.chain.map((c) => c.entity), challenge.end]} />
          ) : (
            <section className="relative flex flex-col gap-3">
              <form onSubmit={(e) => { e.preventDefault(); if (input.trim()) submit(input); }} className="flex gap-2">
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={`Escribe un ${def.entityNoun.replace(/s$/, "")}…`}
                  autoComplete="off"
                  className="flex-1 rounded-xl bg-[#160833] border border-[#b79ced]/30 px-4 py-3 text-base text-white outline-none focus:border-[#fcff52]/70 transition"
                />
                <button type="submit" className="rounded-xl bg-[#fcff52] px-5 py-3 font-bold text-[#1c0b3e] active:scale-95 transition">OK</button>
              </form>

              {suggestions.length > 0 && (
                <ul className="absolute z-20 top-14 w-full rounded-xl bg-[#1c0b3e] border border-[#b79ced]/30 overflow-hidden shadow-2xl">
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

              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => setShowHint(true)}
                  disabled={showHint}
                  className="rounded-lg border border-[#b79ced]/30 px-4 py-1.5 text-xs text-white hover:bg-white/10 active:scale-95 transition disabled:opacity-50"
                >
                  💡 Pista (gratis)
                </button>
                <span className="text-xs text-neutral-400">Usados: {guessCount}</span>
              </div>
            </section>
          )}
        </>
      ) : (
        <div className="w-full flex flex-col items-center gap-2 py-2">
          <button onClick={start} className="btn-3d font-display font-bold text-2xl px-12 py-4">▶ Jugar</button>
          {best !== null && <p className="text-xs text-neutral-400">Tu mejor hoy: {best} {def.entityNoun}</p>}
        </div>
      )}
    </div>
  );
}

function RChip({ regionId, name, code, kind }: { regionId: string; name: string; code: string; kind: Status }) {
  return (
    <div className={`flex flex-col items-center justify-center rounded-xl border bg-[#1c0b3e]/55 backdrop-blur-sm px-3 py-2 min-w-[84px] ${CHIP[kind]}`}>
      <EntityFlag regionId={regionId} code={code} size={26} />
      <span className="text-[11px] font-medium mt-1 text-center leading-tight">{name}</span>
    </div>
  );
}

function RegionWin({
  regionId, guesses, optimal, timeMs, onExit, def, chain,
}: {
  regionId: string; guesses: number; optimal: number; timeMs: number; onExit: () => void;
  def: { flag: string; title: string; entityNoun: string }; chain: string[];
}) {
  const [copied, setCopied] = useState(false);
  const perfect = guesses <= optimal;
  const stars = perfect ? 3 : guesses <= optimal + 1 ? 2 : 1;

  function share() {
    const text = `🌍 Frontle ${def.flag} ${def.title}\n${chain[0]} → ${chain[chain.length - 1]}\n${"⭐".repeat(stars)} · ${guesses} ${def.entityNoun} · ⏱️ ${formatTime(timeMs)}\nfrontle.vercel.app`;
    if (navigator.share) navigator.share({ text }).catch(() => {});
    else { navigator.clipboard?.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }
  }

  return (
    <section className="panel p-5 text-center">
      <div className="text-3xl font-black prism-text">{perfect ? "¡Ruta perfecta! 🏆" : "¡Lo lograste! 🎉"}</div>
      <div className="text-3xl mt-2">{"⭐".repeat(stars)}<span className="opacity-25">{"⭐".repeat(3 - stars)}</span></div>
      <p className="text-neutral-200 mt-2">
        {perfect ? `Conectaste con ${guesses} ${def.entityNoun} — la ruta óptima.` : `Conectaste con ${guesses} ${def.entityNoun} (la óptima era ${optimal}).`}
      </p>
      <p className="text-neutral-300 mt-1 font-mono">⏱️ Tiempo: {formatTime(timeMs)}</p>
      <div className="flex flex-col gap-2 mt-4">
        <button onClick={share} className="rounded-xl bg-[#fcff52] px-6 py-3 font-bold text-[#1c0b3e] active:scale-95 transition shadow-lg shadow-[#fcff52]/25">
          {copied ? "¡Copiado!" : "Compartir resultado"}
        </button>
        <button onClick={onExit} className="rounded-xl border border-white/30 px-6 py-3 font-bold text-white active:scale-95 transition hover:bg-white/10">
          Elegir otro modo
        </button>
      </div>
      <p className="text-[11px] text-neutral-500 mt-3">Modo {def.title} · gratis · vuelve mañana para un nuevo reto</p>
    </section>
  );
}
