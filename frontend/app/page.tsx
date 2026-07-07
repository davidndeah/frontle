"use client";

import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { getCountry } from "./lib/countries";
import {
  dailyChallenge,
  dateSeed,
  tryGuess,
  nextHintCountry,
  msUntilNextDailyUTC,
  connectsThroughKnown,
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
import { getRanking, submitScore, getIpCountry, shortId, formatTime, getMyWinDays, getMyScore, getAlias, setAlias, type ScoreEntry } from "./lib/ranking";
import Coachmarks from "./components/Coachmarks";
import { formatMoney, getUsdToCopmRate, type DisplayCurrency } from "./lib/currency";
import WorldMap from "./components/WorldMap";
import BordyTutorial, { QuickStart } from "./components/BordyTutorial";
// Pago real on-chain (viem → contrato FrontleGame en Celo). Devuelve true solo si se confirmó.
import {
  requestPayment,
  getDailyPot,
  getWalletAddress,
  connectWallet,
  getClaimablePrizes,
  claimPrize,
  getWalletBalances,
  type ClaimablePrize,
  type PayResult,
} from "./lib/payments";
import { PRIVY_ENABLED } from "./providers";
import { PrivyIdentityBridge, EmailLoginButton } from "./components/PrivyLogin";

const PRICES = { hintInitial: 0.05, hintNext: 0.05, hintAll: 0.1, retry: 0.1 };

// Reparto base del pot por nivel (los 3 con ganador), igual que _computeShares
// del contrato. Si algún nivel queda vacío, su parte sube al inmediato superior
// (hasta 100% para un único ganador), así que este % es el mínimo del nivel.
const BASE_SHARE: Record<Difficulty, number> = { easy: 15, medium: 35, hard: 50 };

type Tab = "jugar" | "ranking" | "perfil" | "aprender";

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
  // Pago en curso (pista o reintento): deshabilita los botones de compra y
  // muestra "procesando" — con la wallet embebida la tx tarda varios segundos
  // y sin feedback el usuario re-clickeaba o creía que no funcionó.
  const [paying, setPaying] = useState<null | "retry" | "initial" | "next" | "all">(null);
  const [payError, setPayError] = useState<string | null>(null); // error visible en la WinCard
  // Saldo de la wallet activa (USDT + CELO de gas), para la tarjeta del Perfil.
  const [balances, setBalances] = useState<{ usdt: number; celo: number } | null>(null);

  // Ranking
  const [ipCountry, setIpCountry] = useState("");
  const [ranking, setRanking] = useState<ScoreEntry[]>([]);
  const [myId, setMyId] = useState("");

  // Premios reclamables (días ganados aún no cobrados)
  const [prizes, setPrizes] = useState<ClaimablePrize[]>([]);
  const [claimingKey, setClaimingKey] = useState<string | null>(null);
  // Bono de bienvenida recién otorgado (monto en USDT) → aviso de Bordy.
  const [bonus, setBonus] = useState<string | null>(null);

  // Navegación (app shell) + sheet de wallet
  const [tab, setTab] = useState<Tab>("jugar");
  const [walletOpen, setWalletOpen] = useState(false);
  // Flujo pre-juego del tab Jugar: elegir modo → dificultad → ver el reto
  const [jugarStep, setJugarStep] = useState<"modes" | "level" | "reto">("modes");
  // Nombre de perfil (alias): local + viaja con cada score al ranking
  const [alias, setAliasState] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  useEffect(() => setAliasState(getAlias()), []);
  // Coachmarks de las pistas (1ª vez): el juego se muestra en "modo previo"
  // (países ocultos, cronómetro congelado) mientras Bordy explica. El reloj
  // arranca SOLO al terminar el coach → nadie gana ventaja.
  const [coaching, setCoaching] = useState(false);
  function coachSeen(): boolean {
    try { return localStorage.getItem("frontle-coach-hints") === "1"; } catch { return true; }
  }
  function enterGame() {
    if (coachSeen()) startGame();
    else setCoaching(true);
  }
  // Overlay pre-juego: tutorial completo (1ª vez) o cuenta regresiva rápida
  const [overlay, setOverlay] = useState<null | "full" | "quick">(null);
  function openPregame() {
    // Reto de hoy ya resuelto (volvió del Home tras ganar): directo a la
    // pantalla de victoria, sin tutorial ni cuenta regresiva.
    if (state.solved) {
      setStarted(true);
      return;
    }
    let hide = false;
    try { hide = localStorage.getItem("frontle-tutorial-hide") === "1"; } catch {}
    setOverlay(hide ? "quick" : "full");
  }
  const [daysPlayed, setDaysPlayed] = useState(0);
  useEffect(() => {
    try {
      let n = 0;
      for (let i = 0; i < localStorage.length; i++) {
        if (localStorage.key(i)?.startsWith("frontle-best-")) n++;
      }
      setDaysPlayed(n);
    } catch {}
  }, [best, tab]);

  const inputRef = useRef<HTMLInputElement>(null);
  const challenge = state.challenge;
  const tr = t(locale);
  const fmt = (usdt: number) => formatMoney(usdt, currency, copmRate);
  const cn = (canonical: string) => countryName(canonical, locale);
  const day = dateSeed();
  const bestKey = `frontle-best-${day}-${level}`;
  const gameKey = `frontle-game-${day}-${level}`;
  // Monto que se lleva el ganador del nivel activo (parte base del pot del día).
  const levelPot = pot !== null ? (pot * BASE_SHARE[level]) / 100 : null;

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

  // Reset de desarrollo: /?reset=1 limpia la partida del día y el tutorial
  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      if (sp.has("reset")) {
        const d = dateSeed();
        for (const lv of ["easy", "medium", "hard"]) {
          localStorage.removeItem(`frontle-game-${d}-${lv}`);
          localStorage.removeItem(`frontle-best-${d}-${lv}`);
        }
        localStorage.removeItem("frontle-tutorial-hide");
        localStorage.removeItem("frontle-coach-hints");
        window.location.replace("/");
      }
    } catch {}
  }, []);

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
          // Auto-reparación: una versión previa pisaba solved:true al volver a
          // entrar tras ganar. La cadena manda: si ya conecta origen y destino,
          // la partida está resuelta; se corrige también en localStorage.
          if (!solved && chain.length > 0) {
            const known = new Set<string>([challengeForLevel.start, challengeForLevel.end, ...chain.map((c) => c.country)]);
            if (connectsThroughKnown(challengeForLevel.start, challengeForLevel.end, known)) {
              solved = true;
              try { localStorage.setItem(`frontle-game-${day}-${level}`, JSON.stringify({ ...g, solved: true })); } catch {}
            }
          }
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
    setPayError(null);
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

  // Partida auto-reparada: el finalMs local se perdió al corromperse, pero la
  // marca real quedó en el ranking al ganar. Recuperarla y re-persistirla.
  // (Un tiempo 0 real es imposible — resolver toma al menos segundos.)
  useEffect(() => {
    if (!started || !state.solved || elapsedMs !== 0 || !myId) return;
    let alive = true;
    getMyScore(day, level, myId).then((mine) => {
      if (!alive || !mine || !(mine.timeMs > 0)) return;
      setElapsedMs(mine.timeMs);
      try {
        const raw = localStorage.getItem(gameKey);
        if (raw) localStorage.setItem(gameKey, JSON.stringify({ ...JSON.parse(raw), finalMs: mine.timeMs }));
      } catch {}
    });
    return () => { alive = false; };
  }, [started, state.solved, elapsedMs, myId, day, level, gameKey]);

  // Saldo de la wallet: se carga al abrir el Perfil (y se refresca al volver).
  useEffect(() => {
    if (tab !== "perfil" || !myId) return;
    let alive = true;
    getWalletBalances().then((b) => { if (alive) setBalances(b); });
    return () => { alive = false; };
  }, [tab, myId]);

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
    // Gate de identidad: fuera de MiniPay no se juega sin wallet/correo. En
    // MiniPay `myId` se auto-setea al cargar, así que esto no añade fricción.
    if (!myId) return;
    // Partida ya resuelta hoy: volver a la pantalla de victoria SIN reiniciar
    // el reloj ni tocar la partida guardada — pisarla con solved:false aquí
    // dejaba el día como "en curso" con la cadena ya ganadora.
    if (state.solved) {
      setStarted(true);
      return;
    }
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
    // Un tiempo 0 es imposible (resolver toma segundos): venía de partidas
    // auto-reparadas sin finalMs y contaminaba el ranking. No enviar.
    if (!(timeMs > 0)) return Promise.resolve();
    return submitScore({ day, countries: score, timeMs, countryCode: ipCountry, playerId: addr, level, name: alias || undefined })
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

  // Mensaje según el motivo del fallo (cancelado / sin USDT / sin gas / otro).
  function payFailText(res: PayResult, price: number): string {
    if (res === "cancelled") return tr.payCancelled;
    if (res === "no_funds") return tr.payNoFunds(fmt(price));
    if (res === "no_gas") return tr.payNoGas;
    return tr.payFailed;
  }

  async function retry() {
    if (paying) return;
    setPaying("retry");
    setPayError(null);
    let res: PayResult = "error";
    try {
      res = await requestPayment(PRICES.retry, "reintento del reto diario");
    } finally {
      setPaying(null);
    }
    if (res !== "success") {
      setPayError(payFailText(res, PRICES.retry));
      return;
    }
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
    if (paying) return;
    const price = kind === "all" ? PRICES.hintAll : kind === "initial" ? PRICES.hintInitial : PRICES.hintNext;
    setPaying(kind);
    setMessage({ text: tr.paying, ok: true });
    let res: PayResult = "error";
    try {
      res = await requestPayment(price, `pista: ${kind}`);
    } finally {
      setPaying(null);
    }
    if (res !== "success") {
      setMessage({ text: payFailText(res, price), ok: false });
      return;
    }
    setMessage(null);
    getDailyPot().then((p) => p !== null && setPot(p)); // el pago subió el pot
    if (kind === "initial") setShowInitial(true);
    if (kind === "next") setShowNextSil(true);
    if (kind === "all") setShowAllSil(true);
  }

  const startC = getCountry(challenge.start)!;
  const endC = getCountry(challenge.end)!;
  const guessCount = state.chain.length;
  const silhouettes = showNextSil && nextHint ? [nextHint] : [];
  const panel = "panel";
  // Gamificación derivada de los días jugados (real, no inventado)
  const xpLevel = Math.floor(daysPlayed / 3) + 1;
  const xpPct = ((daysPlayed % 3) / 3) * 100;

  return (
    <main className="relative min-h-dvh bg-grid text-white flex flex-col items-center overflow-hidden">
      {/* Puente de la wallet embebida (login por correo). Sin UI. */}
      {PRIVY_ENABLED && (
        <PrivyIdentityBridge onIdentity={handlePrivyIdentity} onWelcomeBonus={(a) => setBonus(a)} />
      )}

      {/* Header fijo: logo + chip de pot + chip de wallet */}
      <header className="fixed top-0 inset-x-0 z-30 flex items-center gap-2 px-4 h-14 bg-[#160833]/85 backdrop-blur-md border-b border-[#b79ced]/15">
        <span className="font-display text-xl font-bold tracking-tight prism-text">FRONTLE</span>
        <div className="flex-1" />
        {pot !== null && (
          <span className="rounded-full bg-amber-400/15 border border-amber-300/40 px-3 py-1 text-xs font-bold text-amber-300 whitespace-nowrap">
            🏆 {fmt(pot)}
          </span>
        )}
        <button
          onClick={() => setWalletOpen(true)}
          className="rounded-full bg-white/5 border border-[#b79ced]/25 px-3 py-1 text-xs font-semibold text-white active:scale-95 transition"
        >
          {alias || (myId ? shortId(myId) : "👤 Entrar")}
        </button>
      </header>

      {/* Contenido del tab activo */}
      <div className="relative z-10 w-full max-w-md flex flex-col gap-4 px-4 pt-[70px] pb-24">
        {tab === "jugar" && (
          <>
        {/* Título + gamificación (sin hero gigante; Bordy vive en la esquina) */}
        {!started && (
          <div className="flex flex-col items-center gap-2 pt-2">
            <h2 className="font-display text-2xl font-bold text-white text-center leading-tight">
              Conecta el <span className="text-[#fcff52]">mundo</span>
            </h2>
            {/* Strip de gamificación: racha + nivel (XP) */}
            <div className="panel flex items-center w-full py-2.5 px-4 gap-3">
              <div className="flex items-center gap-1.5">
                <span className="text-xl">🔥</span>
                <span className="font-display font-bold text-white text-lg leading-none">{daysPlayed}</span>
                <span className="text-[11px] text-neutral-400">racha</span>
              </div>
              <div className="w-px h-7 bg-white/10" />
              <div className="flex flex-col flex-1">
                <div className="flex items-center justify-between text-[11px] mb-1">
                  <span className="font-semibold text-[#c4b5fd]">⚡ Nivel {xpLevel}</span>
                  <span className="text-neutral-400 tabular-nums">{daysPlayed % 3}/3</span>
                </div>
                <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-[#22d3ee] via-[#22c55e] to-[#fcff52]" style={{ width: `${xpPct}%` }} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ---- Flujo pre-juego: 1) modos ---- */}
        {!started && jugarStep === "modes" && (
          <div className="flex flex-col gap-3">
            <button
              onClick={() => setJugarStep("level")}
              className="panel p-4 flex items-center gap-3 text-left active:scale-[0.98] transition"
            >
              <span className="text-3xl">🌍</span>
              <span className="flex-1">
                <span className="font-display font-bold text-white text-lg block leading-tight">Reto diario</span>
                <span className="text-xs text-neutral-300">3 niveles · premio real del pot 🏆</span>
              </span>
              <span className="text-[#fcff52] text-2xl">→</span>
            </button>
            <div className="panel p-4 flex items-center gap-3 opacity-50">
              <span className="text-3xl">🎲</span>
              <span className="flex-1">
                <span className="font-display font-bold text-white text-lg block leading-tight">Nuevos modos</span>
                <span className="text-xs text-neutral-300">práctica, duelos y más…</span>
              </span>
              <span className="text-[9px] uppercase tracking-widest border border-[#b79ced]/40 rounded-full px-2 py-1 text-[#c4b5fd] whitespace-nowrap">coming soon</span>
            </div>
          </div>
        )}

        {/* ---- 2) dificultad ---- */}
        {!started && jugarStep === "level" && (
          <div className="flex flex-col gap-3">
            <BackRow onClick={() => setJugarStep("modes")} label="Modos" />
            <LevelSelect tr={tr} level={level} onChange={(l) => { setLevel(l); setJugarStep("reto"); }} />
          </div>
        )}

        {/* ---- 3) reto del nivel elegido ---- */}
        {!started && jugarStep === "reto" && (
          <div className="flex items-center justify-between">
            <BackRow onClick={() => setJugarStep("level")} label={tr.levels[level]} />
            <CurrencySelect tr={tr} currency={currency} onChange={setCurrency} />
          </div>
        )}
        {started && (
          <div className="flex justify-center">
            <CurrencySelect tr={tr} currency={currency} onChange={setCurrency} />
          </div>
        )}

        {/* Reto del día (oculto hasta pulsar Play) */}
        {(started || jugarStep === "reto") && (
        <section className={`${panel} p-4`}>
          <p className="text-[10px] uppercase tracking-[0.2em] text-neutral-300 text-center mb-1">{tr.daily}</p>
          {/* Monto que se lleva el ganador de este nivel (sin % dentro del reto) */}
          {levelPot !== null && (
            <p className="text-[11px] text-amber-300/70 text-center mb-3">
              {tr.levelPrize(fmt(levelPot))}
            </p>
          )}
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
        )}

        {/* Cronómetro (visible al jugar; congelado en 00:00 durante el coach) */}
        {(started || coaching) && (
          <p className="text-center -my-2">
            <span id="game-timer" className="inline-block text-lg font-mono font-bold bg-[#1c0b3e]/60 border border-[#b79ced]/20 rounded-full px-4 py-1 tabular-nums">
              🕒 {formatTime(coaching ? 0 : elapsedMs)}
            </span>
          </p>
        )}

        {/* Mapa o pantalla de Play (solo en el paso reto).
            Durante el coach: mapa vacío (sin países) para no dar ventaja. */}
        {started || coaching ? (
          <WorldMap
            statusByCountry={coaching ? {} : statusByCountry}
            loadingLabel={tr.loadingMap}
            silhouettes={coaching ? [] : silhouettes}
            showAllOutlines={!coaching && showAllSil}
            resetKey={`${challenge.start}->${challenge.end}`}
          />
        ) : jugarStep === "reto" ? (
          <div className="w-full flex flex-col items-center justify-center gap-3 py-2">
            {myId ? (
              // Con identidad (MiniPay auto-conecta, o wallet/correo conectados) → a jugar.
              <button
                onClick={openPregame}
                className="btn-3d font-display font-bold text-2xl px-12 py-4"
              >
                {tr.play}
              </button>
            ) : hasWallet || PRIVY_ENABLED ? (
              // Fuera de MiniPay hay que autenticarse (wallet o correo) para poder jugar.
              <div className="flex flex-col items-center gap-2">
                <p className="text-sm font-semibold text-white text-center">{tr.connectToPlay}</p>
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
            ) : (
              // Ni wallet inyectada ni correo → sugerir abrir en MiniPay.
              <p className="text-[12px] text-amber-300/90 text-center max-w-xs">{tr.openInMiniPay}</p>
            )}
          </div>
        ) : null}

        {/* Juego (solo al jugar) */}
        {(started || coaching) && (
          <>
            <div className="flex items-center justify-center -mt-2">
              <div className="flex items-center gap-3 text-[11px] text-white bg-[#1c0b3e]/70 backdrop-blur-sm rounded-full px-3 py-1.5 border border-[#b79ced]/20">
                <Legend color="#22d3ee" label={tr.legend.origin} />
                <Legend color="#e879f9" label={tr.legend.destination} />
                <Legend color="#22c55e" label={tr.legend.good} />
                <Legend color="#eab308" label={tr.legend.lateral} />
                <Legend color="#ef4444" label={tr.legend.far} />
              </div>
            </div>

            {/* Chips de la ruta: ocultos durante el coach (no revelar el reto) */}
            {!coaching && (
              <section className="flex flex-wrap justify-center gap-2">
                <CountryChip code={startC.code} name={cn(challenge.start)} kind="start" />
                {state.chain.map((item) => (
                  <CountryChip key={item.country} code={getCountry(item.country)!.code} name={cn(item.country)} kind={item.quality} />
                ))}
                <CountryChip code={endC.code} name={cn(challenge.end)} kind="end" />
              </section>
            )}

            {state.solved ? (
              <WinCard
                tr={tr}
                guesses={guessCount}
                optimal={challenge.optimal}
                timeMs={elapsedMs}
                chain={[challenge.start, ...state.chain.map((c) => c.country), challenge.end]}
                onRetry={retry}
                retryPrice={PRICES.retry}
                retryBusy={paying === "retry"}
                payError={payError}
                onHome={() => { setStarted(false); setJugarStep("level"); setPayError(null); }}
                hasWallet={hasWallet}
                inRanking={!!myId}
                onConnect={connectForRanking}
                panel={panel}
                fmt={fmt}
              />
            ) : (
              <section className="relative flex flex-col gap-3">
                <form id="game-input" onSubmit={handleSubmit} className="flex gap-2">
                  <input
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={tr.placeholder}
                    autoComplete="off"
                    autoCapitalize="off"
                    className="flex-1 rounded-xl bg-[#160833] border border-[#b79ced]/30 px-4 py-3 text-base text-white outline-none focus:border-[#fcff52]/70 transition"
                  />
                  <button type="submit" className="rounded-xl bg-[#fcff52] px-5 py-3 font-bold text-[#1c0b3e] active:scale-95 transition">OK</button>
                </form>

                {suggestions.length > 0 && (
                  <ul className="absolute z-20 top-14 w-full rounded-xl bg-[#1c0b3e] border border-[#b79ced]/30 overflow-hidden shadow-2xl">
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

                <div id="hints-panel" className={`${panel} p-3`}>
                  <p className="text-[10px] uppercase tracking-widest text-neutral-300 mb-2 text-center">{tr.hintsTitle}</p>
                  <div className="flex flex-wrap justify-center gap-2">
                    <HintButton active={showInitial} busy={paying === "initial"} locked={paying !== null && paying !== "initial"} onClick={() => buyHint("initial")} label={tr.hintInitial} price={PRICES.hintInitial} fmt={fmt} />
                    <HintButton active={showNextSil} busy={paying === "next"} locked={paying !== null && paying !== "next"} onClick={() => buyHint("next")} label={tr.hintSilhouetteNext} price={PRICES.hintNext} fmt={fmt} />
                    <HintButton active={showAllSil} busy={paying === "all"} locked={paying !== null && paying !== "all"} onClick={() => buyHint("all")} label={tr.hintSilhouetteAll} price={PRICES.hintAll} fmt={fmt} />
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

          </>
        )}

        {/* ---------- TAB RANKING ---------- */}
        {tab === "ranking" && (
          <>
            {levelPot !== null && (
              <div className="panel p-3 flex items-center justify-between">
                <span className="text-sm font-bold text-amber-300">{tr.levelPrize(fmt(levelPot))}</span>
                <span className="text-xs font-mono text-neutral-300">🕒 {countdown}</span>
              </div>
            )}
            {/* Selector de nivel: cada nivel tiene su ranking */}
            <LevelSelect tr={tr} level={level} onChange={setLevel} />
            <RankingCard tr={tr} ranking={ranking} best={best} panel={panel} myId={myId} levelLabel={tr.levels[level]} />
            <p className="text-center text-[11px] text-neutral-400">{tr.nextChallenge(countdown)}</p>
          </>
        )}

        {/* ---------- TAB PERFIL ---------- */}
        {tab === "perfil" && (
          <>
            <section className="panel p-4 flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-[#160833] border border-[#b79ced]/30 flex items-center justify-center overflow-hidden">
                {ipCountry ? <Flag code={ipCountry} size={30} /> : <span className="text-xl">👤</span>}
              </div>
              <div className="flex-1 min-w-0">
                {editingName ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      setAlias(nameDraft);
                      setAliasState(getAlias());
                      setEditingName(false);
                    }}
                    className="flex gap-1.5"
                  >
                    <input
                      value={nameDraft}
                      onChange={(e) => setNameDraft(e.target.value)}
                      maxLength={16}
                      autoFocus
                      placeholder={tr.namePlaceholder}
                      className="w-full min-w-0 rounded-lg bg-[#160833] border border-[#b79ced]/40 px-2 py-1 text-sm text-white outline-none focus:border-[#fcff52]/70"
                    />
                    <button type="submit" className="rounded-lg bg-[#fcff52] text-[#1c0b3e] font-bold text-xs px-2.5 active:scale-95 transition">OK</button>
                  </form>
                ) : (
                  <button
                    onClick={() => { setNameDraft(alias); setEditingName(true); }}
                    className="font-bold text-white truncate flex items-center gap-1.5 active:scale-95 transition"
                  >
                    <span className="truncate">{alias || (myId ? shortId(myId) : tr.profileGuest)}</span>
                    <span className="text-xs opacity-60 flex-none">✏️</span>
                  </button>
                )}
                <div className="text-[11px] text-neutral-400 truncate">
                  {myId ? shortId(myId) : tr.profileConnectHint}
                </div>
              </div>
              {!myId && hasWallet && (
                <button onClick={connectForRanking} className="rounded-lg border border-emerald-300/50 bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold text-emerald-200 active:scale-95 transition">
                  {tr.connectWallet}
                </button>
              )}
            </section>
            {myId && balances && <WalletCard tr={tr} address={myId} usdt={balances.usdt} celo={balances.celo} fmt={fmt} />}
            <div className="grid grid-cols-3 gap-2">
              <StatCard v={daysPlayed} k={tr.statDays} color="#fcff52" />
              <StatCard v={best ?? "—"} k={tr.statBestToday} color="#22d3ee" />
              <StatCard v={prizes.length} k={tr.statPrizes} color="#e879f9" />
            </div>
            {prizes.length > 0 && (
              <PrizesCard tr={tr} prizes={prizes} claimingKey={claimingKey} onClaim={handleClaim} panel={panel} fmt={fmt} />
            )}
            <div className="flex justify-center gap-4 text-[11px] text-neutral-400 mt-1">
              <span className="underline cursor-pointer">{tr.legalTerms}</span>
              <span className="underline cursor-pointer">{tr.legalPrivacy}</span>
              <span className="underline cursor-pointer">{tr.legalSupport}</span>
            </div>
            <footer className="text-center text-[11px] text-neutral-500">{tr.footer}</footer>
          </>
        )}

        {/* ---------- TAB APRENDER ---------- */}
        {tab === "aprender" && (
          <>
            <div className="flex flex-col gap-3">
              {[
                "¡Hola! Soy Bordy 👋 Cada día conectas el país de origen con el de destino nombrando países que compartan frontera.",
                "El semáforo te guía: verde vas por la mejor ruta, amarillo te desviaste un poco, rojo te alejaste.",
                "Menos países y menos tiempo = mejor puesto. El mejor del día se lleva el pot 🏆. El primer intento es gratis.",
              ].map((txt, i) => (
                <div key={i} className="flex items-start gap-2">
                  <div className="w-9 h-9 rounded-xl bg-[#160833] border border-[#b79ced]/40 flex items-center justify-center text-lg flex-none">🤖</div>
                  <div className="panel px-3 py-2 text-sm text-white">{txt}</div>
                </div>
              ))}
            </div>
            <button onClick={() => setTab("jugar")} className="rounded-2xl bg-[#fcff52] text-[#1c0b3e] font-black px-6 py-3 active:scale-95 transition shadow-lg shadow-[#fcff52]/25">
              ▶ {tr.play}
            </button>
            <button disabled className="rounded-2xl border border-[#b79ced]/30 text-neutral-300 px-6 py-3 opacity-60">
              🎲 Modo práctica (próximamente)
            </button>
          </>
        )}
      </div>

      {/* Bordy de esquina (mascota persistente; abre el tutorial completo).
          Oculto durante la partida activa para no tapar el input/OK. */}
      {!overlay && !(tab === "jugar" && started && !state.solved) && (
        <button
          onClick={() => setOverlay("full")}
          aria-label="Bordy"
          className="fixed bottom-20 right-2 z-30 w-[64px] h-[76px] bordy-float-sm active:scale-90 transition"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/bordy-m2.png" alt="Bordy" className="w-full h-full object-contain drop-shadow-xl" />
        </button>
      )}

      {/* Aviso de Bordy: bono de bienvenida recién otorgado */}
      {bonus && (
        <div className="fixed inset-x-0 bottom-24 z-40 flex justify-center px-4">
          <div className="panel flex items-start gap-3 max-w-sm w-full p-3 border-[#fcff52]/40 shadow-xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/bordy-m2.png" alt="Bordy" className="w-12 h-14 object-contain shrink-0 bordy-talk" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white leading-snug">{tr.welcomeBonus(fmt(Number(bonus)))}</p>
              <button
                onClick={() => setBonus(null)}
                className="mt-2 rounded-lg bg-[#fcff52] px-3 py-1.5 text-xs font-bold text-[#1c0b3e] active:scale-95 transition"
              >
                {tr.bonusDismiss}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom-nav */}
      <TabBar tr={tr} tab={tab} onTab={setTab} />

      {/* Overlays pre-juego */}
      {overlay === "full" && (
        <BordyTutorial
          onDone={() => {
            setOverlay(null);
            if (!started) enterGame();
          }}
        />
      )}
      {overlay === "quick" && (
        <QuickStart
          onDone={() => {
            setOverlay(null);
            if (!started) enterGame();
          }}
          onFull={() => setOverlay("full")}
        />
      )}

      {/* Wallet sheet */}
      {walletOpen && (
        <WalletSheet onClose={() => setWalletOpen(false)} myId={myId} hasWallet={hasWallet} onConnect={connectForRanking} tr={tr} />
      )}

      {/* Coachmarks de las pistas (1ª partida): el juego está en modo previo
          (reto oculto, reloj en 00:00); al terminar arranca la partida real */}
      {coaching && (
        <Coachmarks
          steps={[
            { target: "game-input", text: "Escribe aquí un país que comparta frontera con el origen (o con cualquiera revelado). Te autocompleto mientras escribes 😉" },
            { target: "hints-panel", text: "💡 ¿Atascado? Compra una pista: la INICIAL del siguiente país, su SILUETA en el mapa, o todas las siluetas. Cuestan centavos y el 80% alimenta el pot del día 🏆" },
            { target: "game-timer", text: "⏱️ El cronómetro desempata: a igual número de países, gana el más rápido. Arranca cuando toques ¡Entendido! — el reto sigue oculto, así que nadie gana ventaja 😄" },
          ]}
          onDone={() => {
            try { localStorage.setItem("frontle-coach-hints", "1"); } catch {}
            setCoaching(false);
            startGame();
          }}
        />
      )}
    </main>
  );
}

// Tarjeta de saldo (perfil): el usuario de CORREO no tiene otra vista de su
// wallet embebida. Muestra USDT (en la moneda elegida), el CELO de gas y la
// dirección completa con copiar — necesaria para recargar la wallet.
function WalletCard({ tr, address, usdt, celo, fmt }: { tr: ReturnType<typeof t>; address: string; usdt: number; celo: number; fmt: (u: number) => string }) {
  const [copied, setCopied] = useState(false);
  return (
    <section className="panel p-4">
      <p className="text-[10px] uppercase tracking-widest text-neutral-300 mb-2">{tr.walletBalanceTitle}</p>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-2xl font-black text-white">{fmt(usdt)}</span>
        <span className="text-[11px] text-neutral-400" title={tr.walletGasTitle}>⛽ {celo.toFixed(3)} CELO</span>
      </div>
      <button
        onClick={() => {
          navigator.clipboard?.writeText(address);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
        className="mt-2 w-full truncate rounded-lg border border-white/15 px-2 py-1.5 text-[11px] font-mono text-neutral-300 active:scale-95 transition hover:bg-white/10"
        title={address}
      >
        {copied ? tr.addressCopied : `${address} 📋`}
      </button>
    </section>
  );
}

// Tarjeta de estadística (perfil)
function StatCard({ v, k, color }: { v: number | string; k: string; color: string }) {
  return (
    <div className="panel p-3 text-center">
      <div className="text-2xl font-black tabular-nums" style={{ color }}>{v}</div>
      <div className="text-[10px] text-neutral-400 mt-0.5">{k}</div>
    </div>
  );
}

// Bottom-nav de 4 tabs
function TabBar({ tr, tab, onTab }: { tr: ReturnType<typeof t>; tab: Tab; onTab: (t: Tab) => void }) {
  const items: { id: Tab; icon: string; label: string }[] = [
    { id: "jugar", icon: "🌍", label: tr.tabs.jugar },
    { id: "ranking", icon: "🏆", label: tr.tabs.ranking },
    { id: "perfil", icon: "👤", label: tr.tabs.perfil },
    { id: "aprender", icon: "❓", label: tr.tabs.aprender },
  ];
  return (
    <nav className="fixed bottom-0 inset-x-0 z-30 h-16 flex bg-[#130729]/85 backdrop-blur-md border-t border-[#b79ced]/15">
      {items.map((it) => {
        const on = tab === it.id;
        return (
          <button
            key={it.id}
            onClick={() => onTab(it.id)}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] transition active:scale-95 ${
              on ? "text-white" : "text-neutral-400"
            }`}
          >
            <span className={`text-xl ${on ? "" : "opacity-60 grayscale"}`}>{it.icon}</span>
            {it.label}
            {on && <span className="absolute bottom-1.5 w-8 h-0.5 rounded-full bg-[#fcff52]" />}
          </button>
        );
      })}
    </nav>
  );
}

// Sheet de wallet (identidad / conexión)
function WalletSheet({
  onClose,
  myId,
  hasWallet,
  onConnect,
  tr,
}: {
  onClose: () => void;
  myId: string;
  hasWallet: boolean;
  onConnect: () => void;
  tr: ReturnType<typeof t>;
}) {
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/55" onClick={onClose} />
      <div className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl bg-[#1c0b3e] border-t border-[#b79ced]/25 px-5 pt-3 pb-8">
        <div className="w-10 h-1 rounded-full bg-white/25 mx-auto mb-4" />
        <h3 className="text-white font-bold text-base mb-3">💰 Tu wallet</h3>
        {myId ? (
          <div className="panel p-4">
            <div className="text-[11px] text-neutral-400">Conectado como</div>
            <div className="font-mono text-white text-sm mt-0.5 break-all">{myId}</div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {hasWallet && (
              <button onClick={() => { onConnect(); onClose(); }} className="rounded-2xl border border-emerald-300/50 bg-emerald-400/10 px-6 py-3 font-bold text-emerald-200 active:scale-95 transition">
                {tr.connectWallet}
              </button>
            )}
            {PRIVY_ENABLED && (
              <EmailLoginButton label={tr.emailLogin} className="rounded-2xl border border-sky-300/50 bg-sky-400/10 px-6 py-3 font-bold text-sky-200 active:scale-95 transition" />
            )}
            <p className="text-center text-[11px] text-neutral-400">{tr.connectBenefit}</p>
          </div>
        )}
      </div>
    </>
  );
}

// Botón de "volver" del flujo pre-juego
function BackRow({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} className="flex items-center gap-2 text-sm text-neutral-300 active:scale-95 transition w-fit">
      <span className="w-7 h-7 rounded-full bg-white/5 border border-[#b79ced]/25 flex items-center justify-center text-base leading-none">←</span>
      <span className="font-display font-semibold">{label}</span>
    </button>
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

function HintButton({ active, busy, locked, onClick, label, price, fmt }: { active: boolean; busy: boolean; locked: boolean; onClick: () => void; label: string; price: number; fmt: (usdt: number) => string }) {
  return (
    <button
      onClick={onClick}
      disabled={active || busy || locked}
      className={`rounded-lg border px-3 py-1.5 text-xs transition active:scale-95 ${
        active
          ? "border-amber-400/60 bg-amber-400/20 text-amber-200"
          : busy
            ? "border-white/25 text-white animate-pulse"
            : `border-white/25 text-white hover:bg-white/10 ${locked ? "opacity-50" : ""}`
      }`}
    >
      {label} {active ? "✓" : busy ? "⏳" : <span className="opacity-70">· {fmt(price)}</span>}
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
        className="rounded-md border border-[#b79ced]/25 bg-[#1c0b3e]/70 px-2 py-1 text-xs font-semibold text-white outline-none focus:border-[#fcff52]/50"
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
  // Cada nivel con su identidad: icono + color (estética Violeta Prisma)
  const META: Record<Difficulty, { icon: string; color: string }> = {
    easy: { icon: "🌱", color: "#22c55e" },
    medium: { icon: "⚡", color: "#fcff52" },
    hard: { icon: "💀", color: "#e879f9" },
  };
  const opts: Difficulty[] = ["easy", "medium", "hard"];
  return (
    <div className="flex flex-col items-center gap-1.5">
      <span className="text-[10px] uppercase tracking-[0.2em] text-neutral-400">{tr.chooseLevel}</span>
      <div className="grid grid-cols-3 gap-2 w-full">
        {opts.map((l) => {
          const on = level === l;
          const m = META[l];
          return (
            <button
              key={l}
              type="button"
              onClick={() => onChange(l)}
              aria-pressed={on}
              className={`flex flex-col items-center gap-0.5 rounded-2xl border-2 px-2 py-2.5 transition active:scale-95 backdrop-blur-sm ${
                on ? "bg-[#1c0b3e]/80" : "bg-[#1c0b3e]/35 opacity-60"
              }`}
              style={{ borderColor: on ? m.color : "rgba(183,156,237,0.2)" }}
            >
              <span className="text-xl leading-none">{m.icon}</span>
              <span className="font-display text-[12.5px] font-bold" style={{ color: on ? m.color : "#c3cbdd" }}>
                {tr.levels[l]}
              </span>
            </button>
          );
        })}
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
    <div className={`flex flex-col items-center justify-center rounded-xl border bg-[#1c0b3e]/55 backdrop-blur-sm px-3 py-2 min-w-[84px] ${styles[kind]}`}>
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
                  <td className="py-1.5 text-xs">
                    {r.name ? <span className="font-semibold">{r.name}</span> : <span className="font-mono">{shortId(r.playerId)}</span>}
                    {mine ? " 👈" : ""}
                  </td>
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
  retryBusy,
  payError,
  onHome,
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
  retryBusy: boolean;
  payError: string | null;
  onHome: () => void;
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
        <button onClick={share} className="rounded-xl bg-[#fcff52] px-6 py-3 font-bold text-[#1c0b3e] active:scale-95 transition shadow-lg shadow-[#fcff52]/25">
          {copied ? tr.copied : tr.share}
        </button>
        {/* Siempre disponible: aun con marca perfecta se puede reintentar para mejorar el TIEMPO (desempate del ranking). */}
        <button
          onClick={onRetry}
          disabled={retryBusy}
          className={`rounded-xl border border-white/30 px-6 py-3 font-bold text-white active:scale-95 transition hover:bg-white/10 ${retryBusy ? "animate-pulse" : ""}`}
        >
          {retryBusy ? <>⏳ {tr.paying}</> : <>{tr.retry} <span className="opacity-70 text-sm">· {fmt(retryPrice)}</span></>}
        </button>
        {payError && <p className="text-xs text-rose-400">{payError}</p>}
        {/* Volver a la selección de nivel: jugar otro nivel (o revisar este). */}
        <button onClick={onHome} className="rounded-xl border border-[#b79ced]/40 px-6 py-3 font-bold text-[#c4b5fd] active:scale-95 transition hover:bg-white/10">
          🎮 {tr.chooseLevel}
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
