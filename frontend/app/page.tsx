"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { getCountry } from "./lib/countries";
import {
  dailyChallenge,
  dateSeed,
  tryGuess,
  nextHintCountry,
  msUntilNextDailyUTC,
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
// Pago real on-chain (viem → contrato FrontleGame en Celo). Devuelve true solo si se confirmó.
import { requestPayment, getDailyPot, getCopmBalance } from "./lib/payments";

// Precios de las acciones pagas (USDm). Listos para conectar al contrato.
const PRICES = { hintInitial: 0.05, hintNext: 0.05, hintAll: 0.1, retry: 0.1 };

// Bandera como imagen (Windows no renderiza emojis de bandera en escritorio)
function Flag({ code, size = 32 }: { code: string; size?: number }) {
  return (
    <img
      src={`https://flagcdn.com/${code.toLowerCase()}.svg`}
      alt=""
      style={{ width: size, height: "auto", borderRadius: 3, display: "inline-block" }}
      loading="lazy"
    />
  );
}

export default function Frontle() {
  const [locale, setLocale] = useState<Locale>("es");
  const [state, setState] = useState<PlayState>(() => ({
    challenge: dailyChallenge(),
    chain: [],
    solved: false,
  }));
  const [input, setInput] = useState("");
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showNextSil, setShowNextSil] = useState(false);
  const [showAllSil, setShowAllSil] = useState(false);
  const [showInitial, setShowInitial] = useState(false);
  const [countdown, setCountdown] = useState("");
  const [best, setBest] = useState<number | null>(null);
  const [pot, setPot] = useState<number | null>(null);
  const [copm, setCopm] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const challenge = state.challenge;
  const tr = t(locale);
  const cn = (canonical: string) => countryName(canonical, locale);
  const bestKey = `frontle-best-${dateSeed()}`;

  useEffect(() => setLocale(detectLocale()), []);

  useEffect(() => {
    const stored = typeof localStorage !== "undefined" ? localStorage.getItem(bestKey) : null;
    if (stored) setBest(parseInt(stored, 10));
  }, [bestKey]);

  useEffect(() => {
    setSuggestions(input.length >= 2 ? suggestLocalized(input, locale) : []);
  }, [input, locale]);

  // Premio (pot) del día: cargar al inicio y refrescar cada 30s para reflejar pagos de otros.
  useEffect(() => {
    let alive = true;
    const refresh = () => getDailyPot().then((p) => { if (alive && p !== null) setPot(p); });
    refresh();
    const id = setInterval(refresh, 30_000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  // Saldo en COPm (peso colombiano) de la wallet conectada — localización MiniPay.
  // Reintenta unas veces porque la wallet puede inyectarse con un pequeño retraso.
  useEffect(() => {
    let alive = true;
    let tries = 0;
    const load = () => getCopmBalance().then((b) => {
      if (!alive) return;
      if (b !== null) { setCopm(b); return; }
      if (++tries < 4) setTimeout(load, 2000);
    });
    load();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    const tick = () => {
      const ms = msUntilNextDailyUTC();
      const p = (n: number) => String(n).padStart(2, "0");
      setCountdown(
        `${p(Math.floor(ms / 3_600_000))}:${p(Math.floor((ms % 3_600_000) / 60_000))}:${p(
          Math.floor((ms % 60_000) / 1000)
        )}`
      );
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const statusByCountry = useMemo(() => {
    const m: Record<string, Status> = { [challenge.start]: "start", [challenge.end]: "end" };
    for (const item of state.chain) m[item.country] = item.quality;
    return m;
  }, [challenge, state.chain]);

  const nextHint = useMemo(() => nextHintCountry(state), [state]);

  function submitCountry(value: string) {
    if (state.solved) return;
    const canonical = resolveLocalized(value);
    const result = tryGuess(state, value, canonical);
    setMessage({
      text: tr.feedback(result.reason, {
        country: result.country ? cn(result.country) : undefined,
        end: cn(challenge.end),
        quality: result.quality,
        input: result.input,
      }),
      ok: result.ok,
    });
    if (result.ok && result.country && result.quality) {
      const newChain = [...state.chain, { country: result.country, quality: result.quality }];
      const solved = result.solved;
      setState((prev) => ({ ...prev, chain: newChain, solved }));
      setShowNextSil(false);
      setShowInitial(false);
      if (solved) {
        const score = newChain.length;
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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (input.trim()) submitCountry(input);
  }

  // Reintento PAGO sobre el MISMO reto del día, para mejorar la marca.
  async function retry() {
    const paid = await requestPayment(PRICES.retry, "reintento del reto diario");
    if (!paid) return;
    getDailyPot().then((p) => p !== null && setPot(p)); // el pago subió el pot
    setState((prev) => ({ challenge: prev.challenge, chain: [], solved: false }));
    setMessage(null);
    setInput("");
    setSuggestions([]);
    setShowNextSil(false);
    setShowAllSil(false);
    setShowInitial(false);
  }

  // Pistas pagas (one-way: una vez compradas, quedan reveladas)
  async function buyHint(kind: "initial" | "next" | "all") {
    const price = kind === "all" ? PRICES.hintAll : kind === "initial" ? PRICES.hintInitial : PRICES.hintNext;
    const paid = await requestPayment(price, `pista: ${kind}`);
    if (!paid) return;
    getDailyPot().then((p) => p !== null && setPot(p)); // el pago subió el pot
    if (kind === "initial") setShowInitial(true);
    if (kind === "next") setShowNextSil(true);
    if (kind === "all") setShowAllSil(true);
  }

  const startC = getCountry(challenge.start)!;
  const endC = getCountry(challenge.end)!;
  const guessCount = state.chain.length;
  const silhouettes = showNextSil && nextHint ? [nextHint] : [];
  const panel = "rounded-2xl bg-black/45 backdrop-blur-md border border-white/15";

  return (
    <main className="relative min-h-dvh bg-black bg-grid text-white flex flex-col items-center px-4 py-6 overflow-hidden">
      <div className="prism-glow" />
      <div className="prism-core" />
      <div className="relative z-10 w-full max-w-md flex flex-col gap-5">
        {/* Header */}
        <header className="text-center">
          <h1 className="text-4xl font-black tracking-tight prism-text">FRONTLE</h1>
          <p className="text-sm text-white mt-1 drop-shadow">{tr.tagline}</p>
          {copm !== null && (
            <div className="mt-2 flex justify-center">
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/15 border border-emerald-300/40 px-3 py-1 text-xs font-semibold text-emerald-300">
                🇨🇴 {tr.copmBalance(copm.toLocaleString("es-CO", { maximumFractionDigits: 2 }))}
              </span>
            </div>
          )}
        </header>

        {/* Premio del día (pot on-chain) */}
        {pot !== null && (
          <div className="text-center -mb-1">
            <span className="inline-block rounded-full bg-amber-400/15 border border-amber-300/40 px-4 py-1.5 text-sm font-bold text-amber-300">
              {tr.prize(pot.toFixed(2))}
            </span>
          </div>
        )}

        {/* Reto del día */}
        <section className={`${panel} p-4`}>
          <p className="text-[10px] uppercase tracking-[0.2em] text-neutral-300 text-center mb-3">{tr.daily}</p>
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1 flex flex-col items-center text-center">
              <Flag code={startC.code} size={46} />
              <div className="text-sm font-semibold mt-1 text-cyan-300">{cn(challenge.start)}</div>
            </div>
            <div className="text-2xl text-neutral-400">→</div>
            <div className="flex-1 flex flex-col items-center text-center">
              <Flag code={endC.code} size={46} />
              <div className="text-sm font-semibold mt-1 text-fuchsia-300">{cn(challenge.end)}</div>
            </div>
          </div>
          <p className="text-center text-xs text-neutral-300 mt-3">{tr.optimal(challenge.optimal)}</p>
        </section>

        {/* Mapa */}
        <WorldMap
          statusByCountry={statusByCountry}
          loadingLabel={tr.loadingMap}
          silhouettes={silhouettes}
          showAllOutlines={showAllSil}
          resetKey={`${challenge.start}->${challenge.end}`}
        />

        {/* Leyenda (con fondo oscuro para contraste sobre el glow) */}
        <div className="flex items-center justify-center -mt-2">
          <div className="flex items-center gap-3 text-[11px] text-white bg-black/55 backdrop-blur-sm rounded-full px-3 py-1.5">
            <Legend color="#22d3ee" label={tr.legend.origin} />
            <Legend color="#e879f9" label={tr.legend.destination} />
            <Legend color="#22c55e" label={tr.legend.good} />
            <Legend color="#eab308" label={tr.legend.lateral} />
            <Legend color="#ef4444" label={tr.legend.far} />
          </div>
        </div>

        {/* Cadena */}
        <section className="flex flex-wrap justify-center gap-2">
          <CountryChip code={startC.code} name={cn(challenge.start)} kind="start" />
          {state.chain.map((item) => (
            <CountryChip key={item.country} code={getCountry(item.country)!.code} name={cn(item.country)} kind={item.quality} />
          ))}
          <CountryChip code={endC.code} name={cn(challenge.end)} kind="end" />
        </section>

        {/* Resultado o input + pistas */}
        {state.solved ? (
          <WinCard
            tr={tr}
            guesses={guessCount}
            optimal={challenge.optimal}
            chain={[challenge.start, ...state.chain.map((c) => c.country), challenge.end]}
            onRetry={retry}
            retryPrice={PRICES.retry}
            panel={panel}
          />
        ) : (
          <section className="relative flex flex-col gap-3">
            <form onSubmit={handleSubmit} className="flex gap-2">
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={tr.placeholder}
                autoComplete="off"
                autoCapitalize="off"
                className="flex-1 rounded-xl bg-neutral-950 border border-white/20 px-4 py-3 text-base text-white outline-none focus:border-white/60 transition"
              />
              <button type="submit" className="rounded-xl bg-white px-5 py-3 font-bold text-black active:scale-95 transition">
                OK
              </button>
            </form>

            {suggestions.length > 0 && (
              <ul className="absolute z-20 top-14 w-full rounded-xl bg-neutral-950 border border-white/20 overflow-hidden shadow-2xl">
                {suggestions.map((s) => (
                  <li key={s}>
                    <button
                      type="button"
                      onClick={() => submitCountry(s)}
                      className="w-full text-left px-4 py-2.5 hover:bg-white/10 flex items-center gap-2"
                    >
                      <Flag code={getCountry(s)!.code} size={22} />
                      <span>{cn(s)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {message && (
              <p className={`text-center text-sm ${message.ok ? "text-emerald-400" : "text-rose-400"}`}>{message.text}</p>
            )}

            {/* Pistas (pagas — listas para blockchain) */}
            <div className={`${panel} p-3`}>
              <p className="text-[10px] uppercase tracking-widest text-neutral-300 mb-2 text-center">{tr.hintsTitle}</p>
              <div className="flex flex-wrap justify-center gap-2">
                <HintButton active={showInitial} onClick={() => buyHint("initial")} label={tr.hintInitial} price={PRICES.hintInitial} />
                <HintButton active={showNextSil} onClick={() => buyHint("next")} label={tr.hintSilhouetteNext} price={PRICES.hintNext} />
                <HintButton active={showAllSil} onClick={() => buyHint("all")} label={tr.hintSilhouetteAll} price={PRICES.hintAll} />
              </div>
              {showInitial && nextHint && (
                <p className="text-center text-sm text-amber-300 mt-2">{tr.hintNextInitial(cn(nextHint).charAt(0).toUpperCase())}</p>
              )}
            </div>

            <p className="text-center text-xs text-neutral-300">{tr.used(guessCount)} · {tr.free}</p>
          </section>
        )}

        {/* Ranking diario */}
        <section className={`${panel} p-3 text-center`}>
          <p className="text-[10px] uppercase tracking-widest text-neutral-300 mb-1">🏆 {tr.rankingTitle}</p>
          <p className="text-sm text-white">{best !== null ? tr.bestToday(best) : tr.noScoreYet}</p>
          <p className="text-[11px] text-neutral-400 mt-1">{tr.rankingNote}</p>
        </section>

        {/* Contador */}
        <p className="text-center text-xs text-white bg-black/40 rounded-full px-3 py-1 self-center">🕒 {tr.nextChallenge(countdown)}</p>

        <footer className="text-center text-xs text-neutral-400">{tr.footer}</footer>
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

function HintButton({ active, onClick, label, price }: { active: boolean; onClick: () => void; label: string; price: number }) {
  return (
    <button
      onClick={onClick}
      disabled={active}
      className={`rounded-lg border px-3 py-1.5 text-xs transition active:scale-95 ${
        active ? "border-amber-400/60 bg-amber-400/20 text-amber-200" : "border-white/25 text-white hover:bg-white/10"
      }`}
    >
      {label} {active ? "✓" : <span className="opacity-70">· {price} USDm</span>}
    </button>
  );
}

type ChipKind = Status;

function CountryChip({ code, name, kind }: { code: string; name: string; kind: ChipKind }) {
  const styles: Record<ChipKind, string> = {
    start: "border-cyan-400/50 text-cyan-100",
    end: "border-fuchsia-400/50 text-fuchsia-100",
    green: "border-emerald-400/50 text-emerald-100",
    yellow: "border-yellow-400/50 text-yellow-100",
    red: "border-rose-400/50 text-rose-100",
  };
  return (
    <div className={`flex flex-col items-center justify-center rounded-xl border bg-black/50 backdrop-blur-sm px-3 py-2 min-w-[84px] ${styles[kind]}`}>
      <Flag code={code} size={30} />
      <span className="text-[11px] font-medium mt-1 text-center leading-tight">{name}</span>
    </div>
  );
}

function WinCard({
  tr,
  guesses,
  optimal,
  chain,
  onRetry,
  retryPrice,
  panel,
}: {
  tr: ReturnType<typeof t>;
  guesses: number;
  optimal: number;
  chain: string[];
  onRetry: () => void;
  retryPrice: number;
  panel: string;
}) {
  const [copied, setCopied] = useState(false);
  const perfect = guesses <= optimal;

  function share() {
    const flags = chain.map((c) => getCountry(c)?.flag ?? "").join(" ");
    const text = `🌍 Frontle\n${getCountry(chain[0])?.flag} → ${
      getCountry(chain[chain.length - 1])?.flag
    }\n${tr.winText(guesses, optimal, perfect)}\n${flags}\nfrontle.vercel.app`;
    if (navigator.share) navigator.share({ text }).catch(() => {});
    else {
      navigator.clipboard?.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <section className={`${panel} p-5 text-center`}>
      <div className="text-3xl font-black prism-text">{perfect ? tr.winPerfect : tr.winNormal}</div>
      <p className="text-neutral-200 mt-2">{tr.winText(guesses, optimal, perfect)}</p>
      <div className="flex flex-col gap-2 mt-4">
        <button onClick={share} className="rounded-xl bg-white px-6 py-3 font-bold text-black active:scale-95 transition">
          {copied ? tr.copied : tr.share}
        </button>
        {!perfect && (
          <button onClick={onRetry} className="rounded-xl border border-white/30 px-6 py-3 font-bold text-white active:scale-95 transition hover:bg-white/10">
            {tr.retry} <span className="opacity-70 text-sm">· {retryPrice} USDm</span>
          </button>
        )}
      </div>
      <p className="text-xs text-neutral-300 mt-3">{tr.comeback}</p>
    </section>
  );
}
