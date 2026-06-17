"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { getCountry } from "./lib/countries";
import {
  dailyChallenge,
  tryGuess,
  suggest,
  type PlayState,
  type Status,
  type Quality,
} from "./lib/game";
import WorldMap from "./components/WorldMap";

export default function Frontle() {
  const challenge = useMemo(() => dailyChallenge(), []);
  const [state, setState] = useState<PlayState>(() => ({
    challenge,
    chain: [],
    solved: false,
  }));
  const [input, setInput] = useState("");
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const startC = getCountry(challenge.start)!;
  const endC = getCountry(challenge.end)!;

  useEffect(() => {
    setSuggestions(input.length >= 2 ? suggest(input) : []);
  }, [input]);

  // Mapa de estados para el mapa y la lista
  const statusByCountry = useMemo(() => {
    const m: Record<string, Status> = {
      [challenge.start]: "start",
      [challenge.end]: "end",
    };
    for (const item of state.chain) m[item.country] = item.quality;
    return m;
  }, [challenge, state.chain]);

  function submitCountry(value: string) {
    if (state.solved) return;
    const result = tryGuess(state, value);
    setMessage({ text: result.message, ok: result.ok });
    if (result.ok && result.country && result.quality) {
      setState((prev) => ({
        ...prev,
        chain: [...prev.chain, { country: result.country!, quality: result.quality! }],
        solved: result.solved,
      }));
    }
    setInput("");
    setSuggestions([]);
    inputRef.current?.focus();
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    submitCountry(input);
  }

  const guessCount = state.chain.length;

  return (
    <main className="relative min-h-dvh bg-grid flex flex-col items-center px-4 py-6 overflow-hidden">
      <div className="prism-glow" />
      <div className="relative w-full max-w-md flex flex-col gap-5">
        {/* Header */}
        <header className="text-center">
          <h1 className="text-4xl font-black tracking-tight prism-text">FRONTLE</h1>
          <p className="text-sm text-slate-400 mt-1">Connect countries through borders</p>
        </header>

        {/* Reto del día */}
        <section className="glass rounded-2xl p-4">
          <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500 text-center mb-3">
            Reto del día
          </p>
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1 text-center">
              <div className="text-4xl">{startC.flag}</div>
              <div className="text-sm font-semibold mt-1 text-cyan-300">{startC.name}</div>
            </div>
            <div className="text-2xl text-slate-600">→</div>
            <div className="flex-1 text-center">
              <div className="text-4xl">{endC.flag}</div>
              <div className="text-sm font-semibold mt-1 text-fuchsia-300">{endC.name}</div>
            </div>
          </div>
          <p className="text-center text-xs text-slate-500 mt-3">
            Ruta óptima: {challenge.optimal} países
          </p>
        </section>

        {/* Mapa */}
        <WorldMap statusByCountry={statusByCountry} />

        {/* Leyenda semáforo */}
        <div className="flex items-center justify-center gap-3 text-[11px] text-slate-400 -mt-2">
          <Legend color="#22d3ee" label="Origen" />
          <Legend color="#e879f9" label="Destino" />
          <Legend color="#22c55e" label="Bien" />
          <Legend color="#eab308" label="Lateral" />
          <Legend color="#ef4444" label="Lejos" />
        </div>

        {/* Cadena de países */}
        <section className="flex flex-wrap justify-center gap-2">
          <CountryChip flag={startC.flag} name={startC.name} kind="start" />
          {state.chain.map((item) => {
            const c = getCountry(item.country)!;
            return <CountryChip key={item.country} flag={c.flag} name={c.name} kind={item.quality} />;
          })}
          <CountryChip
            flag={state.solved ? endC.flag : "🏁"}
            name={state.solved ? endC.name : "???"}
            kind={state.solved ? "end" : "hidden"}
          />
        </section>

        {/* Resultado o input */}
        {state.solved ? (
          <WinCard
            guesses={guessCount}
            optimal={challenge.optimal}
            chain={[challenge.start, ...state.chain.map((c) => c.country), challenge.end]}
          />
        ) : (
          <section className="relative">
            <form onSubmit={handleSubmit} className="flex gap-2">
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Escribe un país…"
                autoComplete="off"
                autoCapitalize="off"
                className="flex-1 rounded-xl bg-[#0a0e1d] border border-white/10 px-4 py-3 text-base outline-none focus:border-cyan-400 transition"
              />
              <button
                type="submit"
                className="rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-400 px-5 py-3 font-bold text-slate-950 active:scale-95 transition"
              >
                OK
              </button>
            </form>

            {suggestions.length > 0 && (
              <ul className="absolute z-10 mt-1 w-full rounded-xl bg-[#0a0e1d] border border-white/10 overflow-hidden shadow-2xl">
                {suggestions.map((s) => {
                  const c = getCountry(s)!;
                  return (
                    <li key={s}>
                      <button
                        type="button"
                        onClick={() => submitCountry(s)}
                        className="w-full text-left px-4 py-2.5 hover:bg-white/5 flex items-center gap-2"
                      >
                        <span className="text-xl">{c.flag}</span>
                        <span>{c.name}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            {message && (
              <p className={`text-center text-sm mt-3 ${message.ok ? "text-emerald-400" : "text-rose-400"}`}>
                {message.text}
              </p>
            )}

            <p className="text-center text-xs text-slate-600 mt-3">
              Países usados: {guessCount} · 1ª partida gratis
            </p>
          </section>
        )}

        <footer className="text-center text-xs text-slate-700 mt-4">
          Frontle · Hackathon de Agentes Onchain · Celo Colombia
        </footer>
      </div>
    </main>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

type ChipKind = Status | "hidden";

function CountryChip({ flag, name, kind }: { flag: string; name: string; kind: ChipKind }) {
  const styles: Record<ChipKind, string> = {
    start: "border-cyan-400/50 bg-cyan-400/10 text-cyan-200",
    end: "border-fuchsia-400/50 bg-fuchsia-400/10 text-fuchsia-200",
    green: "border-emerald-400/50 bg-emerald-400/10 text-emerald-200",
    yellow: "border-yellow-400/50 bg-yellow-400/10 text-yellow-200",
    red: "border-rose-400/50 bg-rose-400/10 text-rose-200",
    hidden: "border-white/10 bg-white/5 text-slate-500 border-dashed",
  };
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-xl border px-3 py-2 min-w-[84px] ${styles[kind]}`}
    >
      <span className="text-2xl leading-none">{flag}</span>
      <span className="text-[11px] font-medium mt-1 text-center leading-tight">{name}</span>
    </div>
  );
}

function WinCard({
  guesses,
  optimal,
  chain,
}: {
  guesses: number;
  optimal: number;
  chain: string[];
}) {
  const [copied, setCopied] = useState(false);
  const perfect = guesses <= optimal;

  function share() {
    const flags = chain.map((c) => getCountry(c)?.flag ?? "").join(" ");
    const text = `🌍 Frontle\n${getCountry(chain[0])?.flag} → ${
      getCountry(chain[chain.length - 1])?.flag
    }\nResuelto con ${guesses} países (óptimo ${optimal})\n${flags}\nfrontle.vercel.app`;
    if (navigator.share) {
      navigator.share({ text }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <section className="glass rounded-2xl p-5 text-center border-emerald-400/30">
      <div className="text-3xl font-black prism-text">
        {perfect ? "¡Ruta perfecta! 🏆" : "¡Lo lograste! 🎉"}
      </div>
      <p className="text-slate-300 mt-2">
        Conectaste con <span className="font-bold">{guesses}</span> países
        {perfect ? " — la ruta óptima." : ` (la óptima era ${optimal}).`}
      </p>
      <button
        onClick={share}
        className="mt-4 rounded-xl bg-gradient-to-r from-cyan-400 to-fuchsia-400 px-6 py-3 font-bold text-slate-950 active:scale-95 transition"
      >
        {copied ? "¡Copiado!" : "Compartir resultado"}
      </button>
      <p className="text-xs text-slate-500 mt-3">Vuelve mañana para el siguiente reto 🗓️</p>
    </section>
  );
}
