"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { getCountry } from "./lib/countries";
import {
  dailyChallenge,
  tryGuess,
  type PlayState,
  type Status,
} from "./lib/game";
import {
  detectLocale,
  countryName,
  resolveLocalized,
  suggestLocalized,
  t,
  type Locale,
} from "./lib/i18n";
import WorldMap from "./components/WorldMap";

export default function Frontle() {
  const challenge = useMemo(() => dailyChallenge(), []);
  const [locale, setLocale] = useState<Locale>("es");
  const [state, setState] = useState<PlayState>(() => ({ challenge, chain: [], solved: false }));
  const [input, setInput] = useState("");
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => setLocale(detectLocale()), []);

  const tr = t(locale);
  const cn = (canonical: string) => countryName(canonical, locale);

  useEffect(() => {
    setSuggestions(input.length >= 2 ? suggestLocalized(input, locale) : []);
  }, [input, locale]);

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
    const canonical = resolveLocalized(value);
    const result = tryGuess(state, value, canonical);
    setMessage({
      text: tr.feedback(result.reason, {
        country: result.country ? cn(result.country) : undefined,
        last: result.last ? cn(result.last) : undefined,
        end: cn(challenge.end),
        quality: result.quality,
        input: result.input,
      }),
      ok: result.ok,
    });
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
    if (input.trim()) submitCountry(input);
  }

  const startC = getCountry(challenge.start)!;
  const endC = getCountry(challenge.end)!;
  const guessCount = state.chain.length;

  return (
    <main className="relative min-h-dvh bg-black bg-grid text-neutral-100 flex flex-col items-center px-4 py-6">
      <div className="relative w-full max-w-md flex flex-col gap-5">
        {/* Header */}
        <header className="text-center">
          <h1 className="text-4xl font-black tracking-tight text-white">FRONTLE</h1>
          <p className="text-sm text-neutral-500 mt-1">{tr.tagline}</p>
        </header>

        {/* Reto del día */}
        <section className="rounded-2xl bg-neutral-950 border border-white/10 p-4">
          <p className="text-[10px] uppercase tracking-[0.2em] text-neutral-600 text-center mb-3">
            {tr.daily}
          </p>
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1 text-center">
              <div className="text-4xl">{startC.flag}</div>
              <div className="text-sm font-semibold mt-1 text-cyan-300">{cn(challenge.start)}</div>
            </div>
            <div className="text-2xl text-neutral-700">→</div>
            <div className="flex-1 text-center">
              <div className="text-4xl">{endC.flag}</div>
              <div className="text-sm font-semibold mt-1 text-fuchsia-300">{cn(challenge.end)}</div>
            </div>
          </div>
          <p className="text-center text-xs text-neutral-600 mt-3">{tr.optimal(challenge.optimal)}</p>
        </section>

        {/* Mapa */}
        <WorldMap statusByCountry={statusByCountry} loadingLabel={tr.loadingMap} />

        {/* Leyenda */}
        <div className="flex items-center justify-center gap-3 text-[11px] text-neutral-500 -mt-2">
          <Legend color="#22d3ee" label={tr.legend.origin} />
          <Legend color="#e879f9" label={tr.legend.destination} />
          <Legend color="#22c55e" label={tr.legend.good} />
          <Legend color="#eab308" label={tr.legend.lateral} />
          <Legend color="#ef4444" label={tr.legend.far} />
        </div>

        {/* Cadena */}
        <section className="flex flex-wrap justify-center gap-2">
          <CountryChip flag={startC.flag} name={cn(challenge.start)} kind="start" />
          {state.chain.map((item) => (
            <CountryChip
              key={item.country}
              flag={getCountry(item.country)!.flag}
              name={cn(item.country)}
              kind={item.quality}
            />
          ))}
          <CountryChip
            flag={state.solved ? endC.flag : "🏁"}
            name={state.solved ? cn(challenge.end) : "???"}
            kind={state.solved ? "end" : "hidden"}
          />
        </section>

        {/* Resultado o input */}
        {state.solved ? (
          <WinCard
            tr={tr}
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
                placeholder={tr.placeholder}
                autoComplete="off"
                autoCapitalize="off"
                className="flex-1 rounded-xl bg-neutral-950 border border-white/10 px-4 py-3 text-base outline-none focus:border-white/40 transition"
              />
              <button
                type="submit"
                className="rounded-xl bg-white px-5 py-3 font-bold text-black active:scale-95 transition"
              >
                OK
              </button>
            </form>

            {suggestions.length > 0 && (
              <ul className="absolute z-10 mt-1 w-full rounded-xl bg-neutral-950 border border-white/10 overflow-hidden shadow-2xl">
                {suggestions.map((s) => (
                  <li key={s}>
                    <button
                      type="button"
                      onClick={() => submitCountry(s)}
                      className="w-full text-left px-4 py-2.5 hover:bg-white/5 flex items-center gap-2"
                    >
                      <span className="text-xl">{getCountry(s)!.flag}</span>
                      <span>{cn(s)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {message && (
              <p className={`text-center text-sm mt-3 ${message.ok ? "text-emerald-400" : "text-rose-400"}`}>
                {message.text}
              </p>
            )}

            <p className="text-center text-xs text-neutral-600 mt-3">
              {tr.used(guessCount)} · {tr.free}
            </p>
          </section>
        )}

        <footer className="text-center text-xs text-neutral-700 mt-4">{tr.footer}</footer>
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
    start: "border-cyan-400/40 text-cyan-200",
    end: "border-fuchsia-400/40 text-fuchsia-200",
    green: "border-emerald-400/40 text-emerald-200",
    yellow: "border-yellow-400/40 text-yellow-200",
    red: "border-rose-400/40 text-rose-200",
    hidden: "border-white/10 text-neutral-500 border-dashed",
  };
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-xl border bg-neutral-950 px-3 py-2 min-w-[84px] ${styles[kind]}`}
    >
      <span className="text-2xl leading-none">{flag}</span>
      <span className="text-[11px] font-medium mt-1 text-center leading-tight">{name}</span>
    </div>
  );
}

function WinCard({
  tr,
  guesses,
  optimal,
  chain,
}: {
  tr: ReturnType<typeof t>;
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
    }\n${tr.winText(guesses, optimal, perfect)}\n${flags}\nfrontle.vercel.app`;
    if (navigator.share) {
      navigator.share({ text }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <section className="rounded-2xl bg-neutral-950 border border-white/10 p-5 text-center">
      <div className="text-3xl font-black text-white">{perfect ? tr.winPerfect : tr.winNormal}</div>
      <p className="text-neutral-400 mt-2">{tr.winText(guesses, optimal, perfect)}</p>
      <button
        onClick={share}
        className="mt-4 rounded-xl bg-white px-6 py-3 font-bold text-black active:scale-95 transition"
      >
        {copied ? tr.copied : tr.share}
      </button>
      <p className="text-xs text-neutral-600 mt-3">{tr.comeback}</p>
    </section>
  );
}
