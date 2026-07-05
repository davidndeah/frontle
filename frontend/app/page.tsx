"use client";

import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { getCountry } from "./lib/countries";
import {
  dailyChallenge,
  dateSeed,
  tryGuess,
  nextHintCountry,
  msUntilNextDailyUTC,
  type PlayState,
  type Status,
  type Difficulty,
} from "./lib/game";
import {
  detectLocale,
  countryName,
  resolveLocalized,
  suggestLocalized,
  t,
  type Locale,
} from "./lib/i18n";
import { getRanking, submitScore, getIpCountry, shortId, formatTime, getMyWinDays, type ScoreEntry } from "./lib/ranking";
import { formatMoney, getUsdToCopmRate, type DisplayCurrency } from "./lib/currency";
import WorldMap from "./components/WorldMap";
// Pago real on-chain (viem → contrato FrontleGame en Celo). Devuelve true solo si se confirmó.
import {
  requestPayment,
  getDailyPot,
  getWalletAddress,
  connectWallet,
  getClaimablePrizes,
  claimPrize,
  type ClaimablePrize,
} from "./lib/payments";
import { PRIVY_ENABLED } from "./providers";
import { PrivyIdentityBridge, EmailLoginButton } from "./components/PrivyLogin";

const PRICES = { hintInitial: 0.05, hintNext: 0.05, hintAll: 0.1, retry: 0.1 };

// Reparto base del pot por nivel (los 3 con ganador), igual que _computeShares
// del contrato. Si algún nivel queda vacío, su parte sube al inmediato superior
// (hasta 100% para un único ganador), así que este % es el mínimo del nivel.
const BASE_SHARE: Record<Difficulty, number> = { easy: 15, medium: 35, hard: 50 };

// Bandera como imagen (Windows no renderiza emojis de bandera en escritorio)
function Flag({ code, size = 32 }: { code: string; size?: number }) {
  if (!code) return <span style={{ fontSize: size * 0.8 }}>🏳️</span>;
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
  // Nivel activo (fácil/medio/difícil). Cada nivel es un reto y ranking aparte.
  const [level, setLevel] = useState<Difficulty>("easy");
  const [state, setState] = useState<PlayState>(() => ({
    challenge: dailyChallenge(dateSeed(), "easy"),
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
  // Moneda de VISUALIZACIÓN (el token real siempre es USDT; esto solo convierte
  // los montos mostrados, para los usuarios de Colombia).
  const [currency, setCurrency] = useState<DisplayCurrency>("USDT");
  const [copmRate, setCopmRate] = useState(4000);
  const [hasWallet, setHasWallet] = useState(true); // optimista hasta confirmar que no hay wallet

  // Cronómetro / fases
  const [started, setStarted] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const startRef = useRef(0);

  // Ranking
  const [ipCountry, setIpCountry] = useState("");
  const [ranking, setRanking] = useState<ScoreEntry[]>([]);
  const [myId, setMyId] = useState("");

  // Premios reclamables (días ganados aún no cobrados)
  const [prizes, setPrizes] = useState<ClaimablePrize[]>([]);
  const [claimingKey, setClaimingKey] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const challenge = state.challenge;
  const tr = t(locale);
  const fmt = (usdt: number) => formatMoney(usdt, currency, copmRate);
  const cn = (canonical: string) => countryName(canonical, locale);
  const day = dateSeed();
  const bestKey = `frontle-best-${day}-${level}`;
  const gameKey = `frontle-game-${day}-${level}`;

  // Persiste la partida del día para que al refrescar NO se pueda volver a
  // jugar gratis (el estado se restaura: en curso o resuelta).
  function saveGame(g: { started: boolean; solved: boolean; chain: PlayState["chain"]; finalMs?: number }) {
    try {
      localStorage.setItem(
        gameKey,
        JSON.stringify({ started: g.started, startMs: startRef.current, chain: g.chain, solved: g.solved, finalMs: g.finalMs ?? null })
      );
    } catch {}
  }

  useEffect(() => setLocale(detectLocale()), []);
  useEffect(() => { getUsdToCopmRate().then(setCopmRate); }, []);
  useEffect(() => { getIpCountry().then(setIpCountry); }, []);

  // Cargar el nivel (y reaccionar al cambio de nivel/día): reto de ese nivel,
  // su partida guardada, su mejor marca y su ranking. Cada nivel es un juego
  // independiente con persistencia propia (clave por día+nivel).
  useEffect(() => {
    const challengeForLevel = dailyChallenge(day, level);
    let started = false;
    let chain: PlayState["chain"] = [];
    let solved = false;
    let elapsed = 0;
    try {
      const raw = localStorage.getItem(`frontle-game-${day}-${level}`);
      if (raw) {
        const g = JSON.parse(raw);
        if (g?.started) {
          started = true;
          chain = g.chain ?? [];
          solved = !!g.solved;
          startRef.current = g.startMs || Date.now();
          elapsed = solved ? g.finalMs ?? 0 : Date.now() - (g.startMs || Date.now());
        }
      }
    } catch {}
    if (!started) startRef.current = 0;
    setState({ challenge: challengeForLevel, chain, solved });
    setStarted(started);
    setElapsedMs(elapsed);
    // limpiar UI transitoria del nivel anterior
    setInput("");
    setSuggestions([]);
    setMessage(null);
    setShowNextSil(false);
    setShowAllSil(false);
    setShowInitial(false);
    // mejor marca del nivel
    let b: number | null = null;
    try {
      const s = localStorage.getItem(`frontle-best-${day}-${level}`);
      if (s) b = parseInt(s, 10);
    } catch {}
    setBest(b);
    // ranking del nivel
    getRanking(day, level).then(setRanking);
  }, [day, level]);

  useEffect(() => {
    setSuggestions(input.length >= 2 ? suggestLocalized(input, locale) : []);
  }, [input, locale]);

  // Cronómetro en vivo mientras se juega
  useEffect(() => {
    if (!started || state.solved) return;
    const id = setInterval(() => setElapsedMs(Date.now() - startRef.current), 250);
    return () => clearInterval(id);
  }, [started, state.solved]);

  // Premio (pot) del día: cargar al inicio y refrescar cada 30s para reflejar pagos de otros.
  useEffect(() => {
    let alive = true;
    const refresh = () => getDailyPot().then((p) => { if (alive && p !== null) setPot(p); });
    refresh();
    const id = setInterval(refresh, 30_000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  // Saldo COPm oculto temporalmente (a pedido): no se carga ni se muestra.

  // ¿Hay wallet inyectada (MiniPay / extensión)? Reintenta porque puede
  // inyectarse con un pequeño retraso. Si la hay, captura la dirección SIN
  // prompt (en MiniPay ya está conectada) → es la IDENTIDAD del jugador en el
  // ranking y lo que el contrato necesita para pagarle el premio.
  // Si tras unos intentos no aparece, marcamos que no hay wallet.
  useEffect(() => {
    let tries = 0;
    const check = async () => {
      if (typeof window !== "undefined" && (window as unknown as { ethereum?: unknown }).ethereum) {
        setHasWallet(true);
        const addr = await getWalletAddress();
        if (addr) setMyId(addr);
        return;
      }
      if (++tries < 4) setTimeout(check, 1000);
      else setHasWallet(false);
    };
    check();
  }, []);

  // Cuenta regresiva al próximo reto diario
  useEffect(() => {
    const tick = () => {
      const ms = msUntilNextDailyUTC();
      const p = (n: number) => String(n).padStart(2, "0");
      setCountdown(
        `${p(Math.floor(ms / 3_600_000))}:${p(Math.floor((ms % 3_600_000) / 60_000))}:${p(Math.floor((ms % 60_000) / 1000))}`
      );
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // Premios reclamables: días que la wallet ganó (tabla `winners`) y que el
  // contrato confirma como cobrables (rolled && winner==yo && !claimed).
  const loadPrizes = useCallback(async (addr: string) => {
    if (!addr) return setPrizes([]);
    const entries = await getMyWinDays(addr);
    setPrizes(await getClaimablePrizes(entries, addr));
  }, []);

  useEffect(() => {
    if (myId) loadPrizes(myId);
  }, [myId, loadPrizes]);

  async function handleClaim(day: number, lv: Difficulty) {
    setClaimingKey(`${day}-${lv}`);
    const ok = await claimPrize(day, lv);
    setClaimingKey(null);
    if (ok) {
      setMessage({ text: tr.prizeClaimedMsg, ok: true });
      await loadPrizes(myId); // refresca: el (día,nivel) reclamado desaparece
    } else {
      setMessage({ text: tr.prizeClaimError, ok: false });
    }
  }

  const statusByCountry = useMemo(() => {
    const m: Record<string, Status> = { [challenge.start]: "start", [challenge.end]: "end" };
    for (const item of state.chain) m[item.country] = item.quality;
    return m;
  }, [challenge, state.chain]);

  const nextHint = useMemo(() => nextHintCountry(state), [state]);

  function startGame() {
    startRef.current = Date.now();
    setElapsedMs(0);
    setStarted(true);
    saveGame({ started: true, solved: false, chain: state.chain });
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function submitCountry(value: string) {
    if (state.solved || !started) return;
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
      const finalMs = solved ? Date.now() - startRef.current : undefined;
      saveGame({ started: true, solved, chain: newChain, finalMs });
      if (solved) {
        setElapsedMs(finalMs!);
        const score = newChain.length;
        if (best === null || score < best) {
          setBest(score);
          try { localStorage.setItem(bestKey, String(score)); } catch {}
        }
        void enterRanking(score, finalMs!);
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

  // Envía la marca al ranking usando la DIRECCIÓN como identidad.
  function pushScore(addr: string, score: number, timeMs: number) {
    return submitScore({ day, countries: score, timeMs, countryCode: ipCountry, playerId: addr, level })
      .then(() => getRanking(day, level).then(setRanking));
  }

  // Al resolver: si hay wallet (MiniPay), entra al ranking sin fricción.
  // Si no hay dirección aún, NO envía — el navegador verá el botón "Conectar".
  async function enterRanking(score: number, timeMs: number) {
    const addr = myId || (await getWalletAddress());
    if (!addr) return;
    setMyId(addr);
    await pushScore(addr, score, timeMs);
  }

  // Navegador: el jugador conecta su wallet (abre prompt) para entrar al ranking.
  async function connectForRanking() {
    const addr = await connectWallet();
    if (!addr) return;
    setHasWallet(true);
    setMyId(addr);
    if (state.solved) await pushScore(addr, state.chain.length, elapsedMs);
  }

  // Correo (Privy): PrivyIdentityBridge nos entrega la dirección de la wallet
  // embebida cuando Privy la crea. La tratamos igual que una wallet conectada.
  async function handlePrivyIdentity(addr: string) {
    if (!addr) return;
    setHasWallet(true);
    setMyId(addr);
    if (state.solved) await pushScore(addr, state.chain.length, elapsedMs);
  }

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
    setStarted(false); // vuelve a la pantalla de Play (cronómetro se reinicia al jugar)
    setElapsedMs(0);
    saveGame({ started: false, solved: false, chain: [] });
  }

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
      {/* Puente de la wallet embebida (login por correo). Sin UI. */}
      {PRIVY_ENABLED && <PrivyIdentityBridge onIdentity={handlePrivyIdentity} />}
      <div className="prism-glow" />
      <div className="prism-core" />
      <div className="relative z-10 w-full max-w-md flex flex-col gap-5">
        {/* Header */}
        <header className="text-center">
          <h1 className="text-4xl font-black tracking-tight prism-text">FRONTLE</h1>
          <p className="text-sm text-white mt-1 drop-shadow">{tr.tagline}</p>
          {/* Chip de saldo COPm oculto temporalmente (a pedido). El selector USDT/COPm sigue activo. */}
        </header>

        {/* Premio del día (pot on-chain) + parte que gana el ganador del nivel activo */}
        {pot !== null && (
          <div className="text-center -mb-1 flex flex-col items-center gap-1">
            <span className="inline-block rounded-full bg-amber-400/15 border border-amber-300/40 px-4 py-1.5 text-sm font-bold text-amber-300">
              {tr.prize(fmt(pot))}
            </span>
            <span className="text-[11px] text-amber-300/70">
              {tr.levelShare(BASE_SHARE[level], fmt((pot * BASE_SHARE[level]) / 100))}
            </span>
          </div>
        )}

        {/* Selector de moneda de visualización (solo display; el token es USDT) */}
        <div className="flex justify-center -mt-2">
          <CurrencySelect tr={tr} currency={currency} onChange={setCurrency} />
        </div>

        {/* Selector de nivel de dificultad (fácil/medio/difícil) */}
        <LevelSelect tr={tr} level={level} onChange={setLevel} />

        {/* Reto del día (oculto hasta pulsar Play) */}
        <section className={`${panel} p-4`}>
          <p className="text-[10px] uppercase tracking-[0.2em] text-neutral-300 text-center mb-3">{tr.daily}</p>
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1 flex flex-col items-center text-center">
              {started ? <Flag code={startC.code} size={46} /> : <Hidden />}
              <div className="text-sm font-semibold mt-1 text-cyan-300">{started ? cn(challenge.start) : "•••"}</div>
            </div>
            <div className="text-2xl text-neutral-400">→</div>
            <div className="flex-1 flex flex-col items-center text-center">
              {started ? <Flag code={endC.code} size={46} /> : <Hidden />}
              <div className="text-sm font-semibold mt-1 text-fuchsia-300">{started ? cn(challenge.end) : "•••"}</div>
            </div>
          </div>
          <p className="text-center text-xs text-neutral-300 mt-3">
            {started ? tr.optimal(challenge.optimal) : tr.timerHint}
          </p>
        </section>

        {/* Cronómetro (visible al jugar) */}
        {started && (
          <p className="text-center -my-2">
            <span className="inline-block text-lg font-mono font-bold bg-black/50 rounded-full px-4 py-1 tabular-nums">
              🕒 {formatTime(elapsedMs)}
            </span>
          </p>
        )}

        {/* Mapa o pantalla de Play */}
        {started ? (
          <WorldMap
            statusByCountry={statusByCountry}
            loadingLabel={tr.loadingMap}
            silhouettes={silhouettes}
            showAllOutlines={showAllSil}
            resetKey={`${challenge.start}->${challenge.end}`}
          />
        ) : (
          <div className="w-full rounded-2xl bg-black border border-white/15 min-h-[220px] flex flex-col items-center justify-center gap-3 py-5">
            {!myId && (hasWallet || PRIVY_ENABLED) && (
              <div className="flex flex-col items-center gap-2">
                {hasWallet && (
                  <button
                    onClick={connectForRanking}
                    className="rounded-2xl border border-emerald-300/50 bg-emerald-400/10 px-8 py-3 font-bold text-emerald-200 active:scale-95 transition hover:bg-emerald-400/20"
                  >
                    {tr.connectWallet}
                  </button>
                )}
                {PRIVY_ENABLED && (
                  <EmailLoginButton
                    label={tr.emailLogin}
                    className="rounded-2xl border border-sky-300/50 bg-sky-400/10 px-8 py-3 font-bold text-sky-200 active:scale-95 transition hover:bg-sky-400/20"
                  />
                )}
                <p className="text-[11px] text-emerald-300/80">{tr.connectBenefit}</p>
              </div>
            )}
            <button
              onClick={startGame}
              className="rounded-2xl bg-white text-black font-black text-xl px-10 py-4 active:scale-95 transition shadow-lg"
            >
              {tr.play}
            </button>
            <p className="text-xs text-neutral-300">{tr.timerHint}</p>
            {!hasWallet && !PRIVY_ENABLED && (
              <p className="text-[11px] text-amber-300/80">{tr.noWallet}</p>
            )}
          </div>
        )}

        {/* Juego (solo al jugar) */}
        {started && (
          <>
            <div className="flex items-center justify-center -mt-2">
              <div className="flex items-center gap-3 text-[11px] text-white bg-black/55 backdrop-blur-sm rounded-full px-3 py-1.5">
                <Legend color="#22d3ee" label={tr.legend.origin} />
                <Legend color="#e879f9" label={tr.legend.destination} />
                <Legend color="#22c55e" label={tr.legend.good} />
                <Legend color="#eab308" label={tr.legend.lateral} />
                <Legend color="#ef4444" label={tr.legend.far} />
              </div>
            </div>

            <section className="flex flex-wrap justify-center gap-2">
              <CountryChip code={startC.code} name={cn(challenge.start)} kind="start" />
              {state.chain.map((item) => (
                <CountryChip key={item.country} code={getCountry(item.country)!.code} name={cn(item.country)} kind={item.quality} />
              ))}
              <CountryChip code={endC.code} name={cn(challenge.end)} kind="end" />
            </section>

            {state.solved ? (
              <WinCard
                tr={tr}
                guesses={guessCount}
                optimal={challenge.optimal}
                timeMs={elapsedMs}
                chain={[challenge.start, ...state.chain.map((c) => c.country), challenge.end]}
                onRetry={retry}
                retryPrice={PRICES.retry}
                hasWallet={hasWallet}
                inRanking={!!myId}
                onConnect={connectForRanking}
                panel={panel}
                fmt={fmt}
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
                  <button type="submit" className="rounded-xl bg-white px-5 py-3 font-bold text-black active:scale-95 transition">OK</button>
                </form>

                {suggestions.length > 0 && (
                  <ul className="absolute z-20 top-14 w-full rounded-xl bg-neutral-950 border border-white/20 overflow-hidden shadow-2xl">
                    {suggestions.map((s) => (
                      <li key={s}>
                        <button type="button" onClick={() => submitCountry(s)} className="w-full text-left px-4 py-2.5 hover:bg-white/10 flex items-center gap-2">
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

                <div className={`${panel} p-3`}>
                  <p className="text-[10px] uppercase tracking-widest text-neutral-300 mb-2 text-center">{tr.hintsTitle}</p>
                  <div className="flex flex-wrap justify-center gap-2">
                    <HintButton active={showInitial} onClick={() => buyHint("initial")} label={tr.hintInitial} price={PRICES.hintInitial} fmt={fmt} />
                    <HintButton active={showNextSil} onClick={() => buyHint("next")} label={tr.hintSilhouetteNext} price={PRICES.hintNext} fmt={fmt} />
                    <HintButton active={showAllSil} onClick={() => buyHint("all")} label={tr.hintSilhouetteAll} price={PRICES.hintAll} fmt={fmt} />
                  </div>
                  {showInitial && nextHint && (
                    <p className="text-center text-sm text-amber-300 mt-2">{tr.hintNextInitial(cn(nextHint).charAt(0).toUpperCase())}</p>
                  )}
                  {!hasWallet && (
                    <p className="text-center text-xs text-amber-300/90 mt-2">{tr.noWallet}</p>
                  )}
                </div>

                <p className="text-center text-xs text-neutral-300">{tr.used(guessCount)} · {tr.free}</p>
              </section>
            )}
          </>
        )}

        {/* Premios reclamables (días ganados sin cobrar) */}
        {prizes.length > 0 && (
          <PrizesCard tr={tr} prizes={prizes} claimingKey={claimingKey} onClaim={handleClaim} panel={panel} fmt={fmt} />
        )}

        {/* Ranking diario (del nivel activo) */}
        <RankingCard tr={tr} ranking={ranking} best={best} panel={panel} myId={myId} levelLabel={tr.levels[level]} />

        {/* Contador */}
        <p className="text-center text-xs text-white bg-black/40 rounded-full px-3 py-1 self-center">🕒 {tr.nextChallenge(countdown)}</p>

        <footer className="text-center text-xs text-neutral-400">{tr.footer}</footer>
      </div>
    </main>
  );
}

function Hidden() {
  return <div className="w-[46px] h-[31px] rounded bg-white/10 border border-white/20 flex items-center justify-center text-lg">❓</div>;
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

function HintButton({ active, onClick, label, price, fmt }: { active: boolean; onClick: () => void; label: string; price: number; fmt: (usdt: number) => string }) {
  return (
    <button
      onClick={onClick}
      disabled={active}
      className={`rounded-lg border px-3 py-1.5 text-xs transition active:scale-95 ${
        active ? "border-amber-400/60 bg-amber-400/20 text-amber-200" : "border-white/25 text-white hover:bg-white/10"
      }`}
    >
      {label} {active ? "✓" : <span className="opacity-70">· {fmt(price)}</span>}
    </button>
  );
}

// Desplegable para elegir en qué moneda VER los montos (USDT real ↔ COP estimado).
function CurrencySelect({ tr, currency, onChange }: { tr: ReturnType<typeof t>; currency: DisplayCurrency; onChange: (c: DisplayCurrency) => void }) {
  return (
    <label className="inline-flex items-center gap-1.5 text-[11px] text-neutral-300">
      <span>{tr.amountIn}</span>
      <select
        value={currency}
        onChange={(e) => onChange(e.target.value as DisplayCurrency)}
        className="rounded-md border border-white/20 bg-black/60 px-2 py-1 text-xs font-semibold text-white outline-none focus:border-white/40"
      >
        <option value="USDT">USDT</option>
        <option value="COPM">COPm</option>
      </select>
    </label>
  );
}

// Selector de nivel: control segmentado Fácil / Medio / Difícil. Cambiar de
// nivel carga el reto y el ranking de ese nivel (cada uno es independiente).
function LevelSelect({
  tr,
  level,
  onChange,
}: {
  tr: ReturnType<typeof t>;
  level: Difficulty;
  onChange: (l: Difficulty) => void;
}) {
  const opts: Difficulty[] = ["easy", "medium", "hard"];
  return (
    <div className="flex flex-col items-center gap-1 -mt-2 -mb-1">
      <span className="text-[10px] uppercase tracking-[0.2em] text-neutral-400">{tr.chooseLevel}</span>
      <div className="inline-flex rounded-full border border-white/15 bg-black/50 p-0.5">
        {opts.map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => onChange(l)}
            aria-pressed={level === l}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition active:scale-95 ${
              level === l ? "bg-white text-black" : "text-neutral-300 hover:text-white"
            }`}
          >
            {tr.levels[l]}
          </button>
        ))}
      </div>
    </div>
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

function PrizesCard({
  tr,
  prizes,
  claimingKey,
  onClaim,
  panel,
  fmt,
}: {
  tr: ReturnType<typeof t>;
  prizes: ClaimablePrize[];
  claimingKey: string | null;
  onClaim: (day: number, level: Difficulty) => void;
  panel: string;
  fmt: (usdt: number) => string;
}) {
  return (
    <section className={`${panel} p-3`}>
      <p className="text-[10px] uppercase tracking-widest text-amber-300 mb-2 text-center">{tr.prizesTitle}</p>
      <ul className="flex flex-col gap-2">
        {prizes.map((p) => {
          const key = `${p.day}-${p.level}`;
          return (
            <li key={key} className="flex items-center justify-between gap-3 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2">
              <span className="text-sm text-amber-100">
                {tr.prizeRow(fmt(p.amount))} <span className="text-amber-300/80">· {tr.levels[p.level]}</span>
              </span>
              <button
                onClick={() => onClaim(p.day, p.level)}
                disabled={claimingKey !== null}
                className="rounded-lg border border-amber-400/60 bg-amber-400/20 px-3 py-1.5 text-xs font-medium text-amber-100 transition active:scale-95 hover:bg-amber-400/30 disabled:opacity-60"
              >
                {claimingKey === key ? tr.prizeClaiming : tr.prizeClaim}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function RankingCard({
  tr,
  ranking,
  best,
  panel,
  myId,
  levelLabel,
}: {
  tr: ReturnType<typeof t>;
  ranking: ScoreEntry[];
  best: number | null;
  panel: string;
  myId: string;
  levelLabel: string;
}) {
  return (
    <section className={`${panel} p-3`}>
      <p className="text-[10px] uppercase tracking-widest text-neutral-300 mb-2 text-center">🏆 {tr.rankingTitle} · {levelLabel}</p>
      {ranking.length === 0 ? (
        <p className="text-sm text-neutral-300 text-center py-2">{tr.rankingEmpty}</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[10px] uppercase text-neutral-400">
              <th className="text-left font-medium py-1 w-7">#</th>
              <th className="text-left font-medium py-1 w-6"></th>
              <th className="text-left font-medium py-1">ID</th>
              <th className="text-right font-medium py-1">{tr.colRoute}</th>
              <th className="text-right font-medium py-1">{tr.colTime}</th>
            </tr>
          </thead>
          <tbody>
            {ranking.map((r, i) => {
              const mine = !!myId && r.playerId === myId;
              return (
                <tr
                  key={i}
                  className={`border-t border-white/10 ${mine ? "bg-amber-400/20 text-amber-200" : ""}`}
                >
                  <td className="py-1.5">{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}</td>
                  <td className="py-1.5"><Flag code={r.countryCode} size={20} /></td>
                  <td className="py-1.5 font-mono text-xs">{shortId(r.playerId)}{mine ? " 👈" : ""}</td>
                  <td className="py-1.5 text-right tabular-nums">{r.countries}</td>
                  <td className="py-1.5 text-right tabular-nums font-mono">{formatTime(r.timeMs)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      <p className="text-[11px] text-neutral-400 mt-2 text-center">
        {myId ? `Tu ID: ${shortId(myId)} · ` : ""}{best !== null ? `${tr.bestToday(best)} · ` : ""}{tr.rankingNote}
      </p>
    </section>
  );
}

function WinCard({
  tr,
  guesses,
  optimal,
  timeMs,
  chain,
  onRetry,
  retryPrice,
  hasWallet,
  inRanking,
  onConnect,
  panel,
  fmt,
}: {
  tr: ReturnType<typeof t>;
  guesses: number;
  optimal: number;
  timeMs: number;
  chain: string[];
  onRetry: () => void;
  retryPrice: number;
  hasWallet: boolean;
  inRanking: boolean;
  onConnect: () => void;
  panel: string;
  fmt: (usdt: number) => string;
}) {
  const [copied, setCopied] = useState(false);
  const perfect = guesses <= optimal;

  function share() {
    const flags = chain.map((c) => getCountry(c)?.flag ?? "").join(" ");
    const text = `🌍 Frontle\n${getCountry(chain[0])?.flag} → ${
      getCountry(chain[chain.length - 1])?.flag
    }\n${tr.winText(guesses, optimal, perfect)} · ⏱️ ${formatTime(timeMs)}\n${flags}\nfrontle.vercel.app`;
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
      <p className="text-neutral-300 mt-1 font-mono">⏱️ {tr.timeLabel}: {formatTime(timeMs)}</p>
      <div className="flex flex-col gap-2 mt-4">
        <button onClick={share} className="rounded-xl bg-white px-6 py-3 font-bold text-black active:scale-95 transition">
          {copied ? tr.copied : tr.share}
        </button>
        {/* Siempre disponible: aun con marca perfecta se puede reintentar para mejorar el TIEMPO (desempate del ranking). */}
        <button onClick={onRetry} className="rounded-xl border border-white/30 px-6 py-3 font-bold text-white active:scale-95 transition hover:bg-white/10">
          {tr.retry} <span className="opacity-70 text-sm">· {fmt(retryPrice)}</span>
        </button>
        {!inRanking && hasWallet && (
          <button onClick={onConnect} className="rounded-xl border border-emerald-300/50 bg-emerald-400/10 px-6 py-3 font-bold text-emerald-200 active:scale-95 transition hover:bg-emerald-400/20">
            {tr.connectToRank}
          </button>
        )}
      </div>
      {!hasWallet && (
        <p className="text-xs text-amber-300/90 mt-3">{tr.noWallet}</p>
      )}
      <p className="text-xs text-neutral-300 mt-3">{tr.comeback}</p>
    </section>
  );
}
