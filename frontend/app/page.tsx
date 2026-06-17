"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { getCountry } from "./lib/countries";
import {
  dailyChallenge,
  tryGuess,
  suggest,
  type PlayState,
} from "./lib/game";

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

  function submitCountry(value: string) {
    if (state.solved) return;
    const result = tryGuess(state, value);
    setMessage({ text: result.message, ok: result.ok });
    if (result.ok && result.country) {
      setState((prev) => ({
        ...prev,
        chain: [...prev.chain, result.country!],
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
    <main className="min-h-dvh bg-slate-950 text-slate-100 flex flex-col items-center px-4 py-6">
      <div className="w-full max-w-md flex flex-col gap-5">
        {/* Header */}
        <header className="text-center">
          <h1 className="text-4xl font-black tracking-tight">🌍 FRONTLE</h1>
          <p className="text-sm text-slate-400 mt-1">
            Connect countries through borders
          </p>
        </header>

        {/* Reto del día */}
        <section className="rounded-2xl bg-slate-900 border border-slate-800 p-4">
          <p className="text-xs uppercase tracking-widest text-slate-500 text-center mb-3">
            Reto del día
          </p>
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1 text-center">
              <div className="text-4xl">{startC.flag}</div>
              <div className="text-sm font-semibold mt-1">{startC.name}</div>
            </div>
            <div className="text-2xl text-slate-600">→</div>
            <div className="flex-1 text-center">
              <div className="text-4xl">{endC.flag}</div>
              <div className="text-sm font-semibold mt-1">{endC.name}</div>
            </div>
          </div>
          <p className="text-center text-xs text-slate-500 mt-3">
            Ruta óptima: {challenge.optimal} países intermedios
          </p>
        </section>

        {/* Cadena de países */}
        <section className="flex flex-col gap-2">
          <ChainPill flag={startC.flag} name={startC.name} kind="start" />
          {state.chain.map((c) => {
            const country = getCountry(c)!;
            return (
              <ChainPill key={c} flag={country.flag} name={country.name} kind="step" />
            );
          })}
          {state.solved ? (
            <ChainPill flag={endC.flag} name={endC.name} kind="end-solved" />
          ) : (
            <ChainPill flag="🏁" name={`??? (${endC.name})`} kind="end" />
          )}
        </section>

        {/* Resultado o input */}
        {state.solved ? (
          <WinCard
            guesses={guessCount}
            optimal={challenge.optimal}
            chain={[challenge.start, ...state.chain, challenge.end]}
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
                className="flex-1 rounded-xl bg-slate-900 border border-slate-700 px-4 py-3 text-base outline-none focus:border-emerald-500"
              />
              <button
                type="submit"
                className="rounded-xl bg-emerald-500 px-5 py-3 font-bold text-slate-950 active:scale-95 transition"
              >
                OK
              </button>
            </form>

            {/* Autocomplete */}
            {suggestions.length > 0 && (
              <ul className="absolute z-10 mt-1 w-full rounded-xl bg-slate-900 border border-slate-700 overflow-hidden shadow-xl">
                {suggestions.map((s) => {
                  const c = getCountry(s)!;
                  return (
                    <li key={s}>
                      <button
                        type="button"
                        onClick={() => submitCountry(s)}
                        className="w-full text-left px-4 py-2.5 hover:bg-slate-800 flex items-center gap-2"
                      >
                        <span className="text-xl">{c.flag}</span>
                        <span>{c.name}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            {/* Mensaje de feedback */}
            {message && (
              <p
                className={`text-center text-sm mt-3 ${
                  message.ok ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {message.text}
              </p>
            )}

            <p className="text-center text-xs text-slate-600 mt-3">
              Intentos: {guessCount} · 1ª partida gratis
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

type PillKind = "start" | "step" | "end" | "end-solved";

function ChainPill({
  flag,
  name,
  kind,
}: {
  flag: string;
  name: string;
  kind: PillKind;
}) {
  const styles: Record<PillKind, string> = {
    start: "bg-sky-500/15 border-sky-500/40 text-sky-200",
    step: "bg-emerald-500/15 border-emerald-500/40 text-emerald-100",
    end: "bg-slate-800/60 border-slate-700 text-slate-400 border-dashed",
    "end-solved": "bg-amber-500/20 border-amber-500/50 text-amber-100",
  };
  return (
    <div className={`rounded-xl border px-4 py-2.5 flex items-center gap-3 ${styles[kind]}`}>
      <span className="text-2xl">{flag}</span>
      <span className="font-medium">{name}</span>
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
    }\nResuelto en ${guesses} países (óptimo ${optimal})\n${flags}\nfrontle.vercel.app`;
    if (navigator.share) {
      navigator.share({ text }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <section className="rounded-2xl bg-emerald-500/10 border border-emerald-500/40 p-5 text-center">
      <div className="text-3xl font-black text-emerald-300">
        {perfect ? "¡Ruta perfecta! 🏆" : "¡Lo lograste! 🎉"}
      </div>
      <p className="text-slate-300 mt-2">
        Llegaste usando <span className="font-bold">{guesses}</span> países
        {perfect ? " — la ruta óptima." : ` (la óptima era ${optimal}).`}
      </p>
      <button
        onClick={share}
        className="mt-4 rounded-xl bg-emerald-500 px-6 py-3 font-bold text-slate-950 active:scale-95 transition"
      >
        {copied ? "¡Copiado!" : "Compartir resultado"}
      </button>
      <p className="text-xs text-slate-500 mt-3">
        Vuelve mañana para el siguiente reto 🗓️
      </p>
    </section>
  );
}
