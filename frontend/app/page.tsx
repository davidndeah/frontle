"use client";

import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
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
  saveLocale,
  savedLocale,
  localeForCountry,
  countryName,
  resolveLocalized,
  suggestLocalized,
  t,
  LOCALES,
  LOCALE_LABELS,
  DEFAULT_LOCALE,
  type Locale,
} from "./lib/i18n";
import { getRanking, submitScore, getIpCountry, shortId, formatTime, getMyWinDays, getMyScore, getAlias, setAlias, getNamesFor, type ScoreEntry } from "./lib/ranking";
import { isMiniPay, ADD_CASH_URL } from "./lib/minipay";
import { SUPPORT_MAILTO, SUPPORT_X_URL } from "./lib/support";
import Coachmarks from "./components/Coachmarks";
import ScoreCard from "./components/ScoreCard";
import NavIcon from "./components/NavIcons";
import Achievements from "./components/Achievements";
import PrecisionStars from "./components/PrecisionStars";
import { POINTS_PER_SOLVE } from "./lib/progress";
import type { Square } from "./lib/scoreCard";
import RegionGame from "./components/RegionGame";
import RegionMapPreview from "./components/RegionMapPreview";
import PracticeGame from "./components/PracticeGame";
import CountryQuizGame from "./components/CountryQuizGame";
import type { QuizMode } from "./lib/quiz";
import { REGIONS, REGION_IDS } from "./lib/regions";
import { sfxGood, sfxLateral, sfxFar, sfxInvalid, sfxWin, sfxHint, isSfxMuted, toggleSfx } from "./lib/sfx";
import { startMusic, stopMusic, isMusicMuted, toggleMusic } from "./lib/music";
import { formatMoney, getUsdToCopmRate, type DisplayCurrency } from "./lib/currency";
import WorldMap from "./components/WorldMap";
import WeeklyLeague from "./components/WeeklyLeague";
// Liga v2 (Fase 1): XP por resolver + identidad de la liga (wallet o anónimo).
import { awardDailySolve, bindXpIdentity } from "./lib/xp";
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
  getLastCycleWinners,
  type ClaimablePrize,
  type LastCycle,
  type PayResult,
} from "./lib/payments";
import { PRIVY_ENABLED } from "./lib/privy";
import { EmailLoginButton } from "./components/PrivyLogin";

const PRICES = { hintInitial: 0.05, hintNext: 0.05, hintAll: 0.1, retry: 0.1 };

// El SDK de Privy (~1.27 MB) sale del bundle inicial. `ssr: false` porque solo
// existe en cliente. Ojo: se monta únicamente DESPUÉS de comprobar si estamos
// en MiniPay — montarlo antes descargaría el chunk igual, aunque luego se
// desmontara, que es justo lo que queremos evitar allí.
const PrivyGate = dynamic(() => import("./components/PrivyGate"), { ssr: false });

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
  // Arranca en el default global (inglés) para que el primer render (SSR +
  // hidratación) sea consistente; el idioma real se resuelve en un efecto.
  const [locale, setLocale] = useState<Locale>(DEFAULT_LOCALE);
  // Estado de audio (música de fondo + efectos), reflejo de localStorage.
  const [musicMuted, setMusicMuted] = useState(false);
  const [sfxMuted, setSfxMuted] = useState(false);
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
  // Tiempo acumulado en pausa (pagos de pistas): la confirmación on-chain
  // tarda segundos y no es tiempo de juego. Se descuenta del cronómetro y se
  // persiste junto a startMs para que un refresh no lo pierda.
  const pausedMsRef = useRef(0);
  // Pago en curso (pista o reintento): deshabilita los botones de compra y
  // muestra "procesando" — con la wallet embebida la tx tarda varios segundos
  // y sin feedback el usuario re-clickeaba o creía que no funcionó.
  const [paying, setPaying] = useState<null | "retry" | "initial" | "next" | "all">(null);
  const [payError, setPayError] = useState<string | null>(null); // error visible en la WinCard
  // El fallo fue por saldo insuficiente. MiniPay exige mandar a recargar en vez
  // de dejar al usuario contra un error sin salida.
  const [payLow, setPayLow] = useState(false);
  // Saldo de la wallet activa. `celo` NUNCA se muestra: MiniPay prohíbe exhibir
  // el token, y la app solo lo usa internamente para el pre-chequeo de la
  // wallet embebida (ver payments.ts). Se guarda por eso, no para pintarlo.
  const [balances, setBalances] = useState<{ usdt: number; celo: number } | null>(null);
  // ¿Estamos dentro de MiniPay? Se resuelve en un efecto y no en el render
  // porque `window` no existe en el servidor y provocaría hidratación distinta.
  // `mpChecked` distingue "todavía no lo sé" de "no lo estamos": sin esa
  // distinción, PrivyGate se montaría en el primer render y bajaría su chunk
  // dentro de MiniPay antes de que pudiéramos desmontarlo.
  const [inMiniPay, setInMiniPay] = useState(false);
  const [mpChecked, setMpChecked] = useState(false);

  // Ranking
  const [ipCountry, setIpCountry] = useState("");
  const [ranking, setRanking] = useState<ScoreEntry[]>([]);
  const [myId, setMyId] = useState("");

  // Premios reclamables (días ganados aún no cobrados)
  const [prizes, setPrizes] = useState<ClaimablePrize[]>([]);
  // Ganadores del último día cerrado + sus nombres de perfil, para el Ranking.
  const [cycle, setCycle] = useState<LastCycle | null>(null);
  const [winnerNames, setWinnerNames] = useState<Record<string, string>>({});
  // `${día}-${nivel}` recién reclamado: dispara la animación de celebración.
  const [justClaimed, setJustClaimed] = useState<string | null>(null);
  const [claimingKey, setClaimingKey] = useState<string | null>(null);
  // Bono de bienvenida recién otorgado (monto en USDT) → aviso de Bordy.
  const [bonus, setBonus] = useState<string | null>(null);

  // Navegación (app shell) + sheet de wallet
  const [tab, setTab] = useState<Tab>("jugar");
  const [walletOpen, setWalletOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  // Flujo pre-juego del tab Jugar: elegir modo → dificultad → ver el reto
  const [jugarStep, setJugarStep] = useState<"modes" | "level" | "reto">("modes");
  // Modo Regiones activo (id de región: "co", "us"…) — null = modo mundial
  const [regionMode, setRegionMode] = useState<string | null>(null);
  // País elegido en el desplegable del selector de Regiones (antes de jugar).
  const [regionPick, setRegionPick] = useState<string>(REGION_IDS[0]);
  // UX-4: tarjetas de modo colapsadas; al tocar una se despliega su selector
  // (nivel para el reto diario, país+mapa para regiones) y se cierra la otra.
  const [modeOpen, setModeOpen] = useState<"daily" | "regions" | null>(null);
  // Modos quiz: adivina la bandera / el contorno (null = ninguno activo).
  const [quizMode, setQuizMode] = useState<QuizMode | null>(null);
  // Modo práctica activo (dentro de la pestaña Aprender).
  const [practiceOn, setPracticeOn] = useState(false);
  // Nombre de perfil (alias): local + viaja con cada score al ranking
  const [alias, setAliasState] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  useEffect(() => setAliasState(getAlias()), []);
  // Prompt de nombre al registrarse: si hay identidad y aún no eligió nombre,
  // se le pide una vez (así el ranking muestra nombres, no wallets).
  const [nameModal, setNameModal] = useState(false);
  useEffect(() => {
    let asked = "1";
    try { asked = localStorage.getItem("frontle-name-asked") ?? "0"; } catch {}
    if (myId && !getAlias() && asked !== "1") {
      setNameDraft("");
      setNameModal(true);
    }
  }, [myId]);
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
  // Hito de racha (GAM-2): celebra SOLO al llegar a 3 y 7 días, y solo cuando
  // la racha sube dentro de la sesión (no en la carga inicial, que va de 0 al
  // valor guardado; los cambios de tab tampoco disparan porque n no cambia).
  const [milestone, setMilestone] = useState<number | null>(null);
  const [streakBump, setStreakBump] = useState(false);
  const prevDaysRef = useRef(0);
  const daysReadyRef = useRef(false);
  useEffect(() => {
    try {
      let n = 0;
      for (let i = 0; i < localStorage.length; i++) {
        if (localStorage.key(i)?.startsWith("frontle-best-")) n++;
      }
      if (daysReadyRef.current && n > prevDaysRef.current) {
        setStreakBump(true);
        if (n === 3 || n === 7) setMilestone(n);
      }
      prevDaysRef.current = n;
      daysReadyRef.current = true;
      setDaysPlayed(n);
    } catch {}
  }, [best, tab]);
  useEffect(() => {
    if (milestone === null) return;
    const id = setTimeout(() => setMilestone(null), 4500);
    return () => clearTimeout(id);
  }, [milestone]);

  // Victoria recién ganada (GAM-4): habilita el confeti prisma de la win card
  // solo en el momento de resolver, no al restaurar una partida resuelta.
  const [justWon, setJustWon] = useState(false);
  useEffect(() => {
    if (!justWon) return;
    const id = setTimeout(() => setJustWon(false), 2000);
    return () => clearTimeout(id);
  }, [justWon]);

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
        JSON.stringify({ started: g.started, startMs: startRef.current, pausedMs: pausedMsRef.current, chain: g.chain, solved: g.solved, finalMs: g.finalMs ?? null })
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
        localStorage.removeItem("frontle-name-asked");
        window.location.replace("/");
      }
    } catch {}
  }, []);

  useEffect(() => setLocale(detectLocale()), []);
  // Refleja el idioma real en <html lang> (SEO, lectores de pantalla, y evita
  // que el navegador ofrezca "traducir del español" a quien ya lo ve en inglés).
  useEffect(() => { document.documentElement.lang = locale; }, [locale]);
  // Cambio manual de idioma: aplica y persiste la preferencia del usuario.
  const changeLocale = useCallback((l: Locale) => {
    setLocale(l);
    saveLocale(l);
  }, []);

  // Audio: reflejar el mute persistido y arrancar la música al primer gesto
  // del usuario (los navegadores bloquean el autoplay hasta que hay interacción).
  useEffect(() => {
    setMusicMuted(isMusicMuted());
    setSfxMuted(isSfxMuted());
    const kick = () => {
      startMusic();
      window.removeEventListener("pointerdown", kick);
      window.removeEventListener("keydown", kick);
    };
    window.addEventListener("pointerdown", kick);
    window.addEventListener("keydown", kick);
    return () => {
      window.removeEventListener("pointerdown", kick);
      window.removeEventListener("keydown", kick);
      stopMusic();
    };
  }, []);

  // Toggles de audio para los botones de mute.
  const onToggleMusic = useCallback(() => setMusicMuted(toggleMusic()), []);
  const onToggleSfx = useCallback(() => setSfxMuted(toggleSfx()), []);
  useEffect(() => {
    setInMiniPay(isMiniPay());
    setMpChecked(true);
  }, []);

  // Al conectar, la wallet pasa a ser la identidad de la liga semanal — el
  // XP anterior del id anónimo queda en ese id (la fusión llega en Fase 2).
  useEffect(() => {
    if (myId) bindXpIdentity(myId);
  }, [myId]);

  // Privy solo tiene sentido fuera de MiniPay: allí el wallet ya viene
  // inyectado y el SDK sería más de un megabyte de código muerto.
  const privyActive = PRIVY_ENABLED && mpChecked && !inMiniPay;
  useEffect(() => { getUsdToCopmRate().then(setCopmRate); }, []);
  useEffect(() => {
    getIpCountry().then((cc) => {
      setIpCountry(cc);
      // Idioma por REGIÓN: el país de conexión decide el idioma cuando el
      // usuario no eligió uno a mano (orden: manual → geo → navegador → en).
      if (!savedLocale()) {
        const geo = localeForCountry(cc);
        if (geo) setLocale(geo);
      }
    });
  }, []);

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
          pausedMsRef.current = g.pausedMs || 0;
          elapsed = solved ? g.finalMs ?? 0 : Math.max(0, Date.now() - (g.startMs || Date.now()) - pausedMsRef.current);
        }
      }
    } catch {}
    if (!started) { startRef.current = 0; pausedMsRef.current = 0; }
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

  // Cronómetro en vivo mientras se juega. Durante un pago (`paying`) el
  // intervalo se detiene: el reloj queda congelado en pantalla y al terminar
  // el pago retoma descontando la pausa acumulada (sin salto hacia atrás).
  useEffect(() => {
    if (!started || state.solved || paying) return;
    const id = setInterval(() => setElapsedMs(Math.max(0, Date.now() - startRef.current - pausedMsRef.current)), 250);
    return () => clearInterval(id);
  }, [started, state.solved, paying]);

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

  // Ganadores del último día CERRADO (tab Ranking). El contrato es la fuente de
  // verdad, así que también dice si cada premio ya se reclamó.
  const loadCycle = useCallback(async () => {
    const c = await getLastCycleWinners();
    setCycle(c);
    if (c) setWinnerNames(await getNamesFor(c.winners.map((w) => w.winner)));
  }, []);

  useEffect(() => { loadCycle(); }, [loadCycle]);

  async function handleClaim(day: number, lv: Difficulty) {
    setClaimingKey(`${day}-${lv}`);
    const ok = await claimPrize(day, lv);
    setClaimingKey(null);
    if (ok) {
      const key = `${day}-${lv}`;
      setMessage({ text: tr.prizeClaimedMsg, ok: true });
      sfxWin();
      setJustClaimed(key);

      // La tarjeta de ganadores del Ranking puede refrescarse ya: pasa a
      // "Reclamado" sin quitar ninguna fila.
      loadCycle();

      // El Perfil NO: `loadPrizes` borra la fila reclamada, y con ella se
      // llevaría la animación antes de que se vea. Se refresca al terminar.
      setTimeout(() => {
        setJustClaimed(null);
        loadPrizes(myId);
      }, 1200);
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
    pausedMsRef.current = 0;
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
    // SFX según el resultado del intento
    if (!result.ok) sfxInvalid();
    else if (result.solved) sfxWin();
    else if (result.quality === "green") sfxGood();
    else if (result.quality === "yellow") sfxLateral();
    else if (result.quality === "red") sfxFar();
    if (result.ok && result.country && result.quality) {
      const newChain = [...state.chain, { country: result.country, quality: result.quality }];
      const solved = result.solved;
      setState((prev) => ({ ...prev, chain: newChain, solved }));
      setShowNextSil(false);
      setShowInitial(false);
      const finalMs = solved ? Math.max(0, Date.now() - startRef.current - pausedMsRef.current) : undefined;
      saveGame({ started: true, solved, chain: newChain, finalMs });
      if (solved) {
        setElapsedMs(finalMs!);
        // El confeti solo acompaña la victoria recién ganada, no la pantalla
        // resuelta al volver (restaurada o por cambio de tab).
        setJustWon(true);
        const score = newChain.length;
        if (best === null || score < best) {
          setBest(score);
          try { localStorage.setItem(bestKey, String(score)); } catch {}
        }
        void enterRanking(score, finalMs!);
        // Liga v2: XP por nivel + calidad (estrellas de la win card) + sin
        // pistas + racha del día. Idempotente por (día, nivel) en el servidor.
        const stars = score <= challenge.optimal ? 3 : score === challenge.optimal + 1 ? 2 : 1;
        awardDailySolve(day, level, stars, showInitial || showNextSil || showAllSil);
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

  // ¿El pago falló porque no alcanzaba el saldo? (ni para el precio, ni para
  // la comisión de red). Es el caso que dispara el deeplink de recarga.
  const isLowBalance = (res: PayResult) => res === "no_funds" || res === "no_gas";

  // Mensaje según el motivo del fallo (cancelado / sin saldo / otro).
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
    setPayLow(false);
    let res: PayResult = "error";
    try {
      res = await requestPayment(PRICES.retry, "reintento del reto diario");
    } finally {
      setPaying(null);
    }
    if (res !== "success") {
      setPayError(payFailText(res, PRICES.retry));
      setPayLow(isLowBalance(res));
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
    pausedMsRef.current = 0;
    saveGame({ started: false, solved: false, chain: [] });
  }

  async function buyHint(kind: "initial" | "next" | "all") {
    if (paying) return;
    const price = kind === "all" ? PRICES.hintAll : kind === "initial" ? PRICES.hintInitial : PRICES.hintNext;
    setPaying(kind);
    setMessage({ text: tr.paying, ok: true });
    // La compra pausa el cronómetro. El overlay tapa el tablero mientras
    // tanto: sin él, iniciar un pago sería tiempo de análisis gratis.
    const pauseStart = Date.now();
    let res: PayResult = "error";
    try {
      res = await requestPayment(price, `pista: ${kind}`);
    } finally {
      pausedMsRef.current += Date.now() - pauseStart;
      // Persistir la pausa: un refresh a mitad de partida no debe perderla.
      saveGame({ started: true, solved: false, chain: state.chain });
      setPaying(null);
    }
    if (res !== "success") {
      setMessage({ text: payFailText(res, price), ok: false });
      setPayLow(isLowBalance(res));
      return;
    }
    setMessage(null);
    getDailyPot().then((p) => p !== null && setPot(p)); // el pago subió el pot
    if (kind === "initial") setShowInitial(true);
    if (kind === "next") setShowNextSil(true);
    if (kind === "all") setShowAllSil(true);
    sfxHint();
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
      {/* Privy: provider + puente de la wallet embebida + oyente del login.
          Sin UI, cargado aparte, y nunca dentro de MiniPay. */}
      {privyActive && (
        <PrivyGate onIdentity={handlePrivyIdentity} onWelcomeBonus={(a) => setBonus(a)} />
      )}

      {/* Header fijo: logo + chip de pot + chip de wallet */}
      <header className="app-header fixed top-0 inset-x-0 z-30 flex items-center gap-1 px-2.5 bg-[#160833]/85 backdrop-blur-md border-b border-[#b79ced]/15">
        <span className="font-display text-lg font-bold tracking-tight prism-text shrink-0">FRONTLE</span>
        <div className="flex-1" />
        {pot !== null && (
          <span className="shrink-0 rounded-full bg-amber-400/15 border border-amber-300/40 px-2 py-1 text-[11px] font-bold text-amber-300 whitespace-nowrap">
            🏆 {fmt(pot)}
          </span>
        )}
        {/* Un solo botón de ajustes agrupa idioma + audio (música y efectos):
            a 360px no caben 3 controles sueltos de 44px, y así los efectos
            (que solo vivían en Perfil) quedan también a un tap del header. */}
        <button
          onClick={() => setSettingsOpen(true)}
          aria-label={tr.a11y.settings}
          className="shrink-0 w-11 h-11 flex items-center justify-center rounded-full bg-white/5 border border-[#b79ced]/25 text-base active:scale-90 transition"
        >
          ⚙️
        </button>
        {/* A 360px (el mínimo de MiniPay) la cabecera va justa: el resto de piezas
            son shrink-0 y es este chip el que cede, truncando el alias. Sin esto
            el chip se salía del viewport y aplastaba el botón de ajustes. */}
        <button
          onClick={() => setWalletOpen(true)}
          className="min-w-0 min-h-11 truncate rounded-full bg-white/5 border border-[#b79ced]/25 px-2.5 text-xs font-semibold text-white active:scale-95 transition"
        >
          {alias || (myId ? shortId(myId) : tr.walletSheet.signIn)}
        </button>
      </header>

      {/* Contenido del tab activo. El key={tab} remonta el contenedor al
          cambiar de tab para que el contenido entre con fade + slide corto
          (los hijos ya se desmontan por el render condicional por tab). */}
      <div key={tab} className="app-content tab-fade relative z-10 w-full max-w-md flex flex-col gap-4 px-4">
        {/* Modo Regiones activo: pantalla autocontenida (gratis, sin pot) */}
        {tab === "jugar" && regionMode && (
          <RegionGame regionId={regionMode} locale={locale} onExit={() => setRegionMode(null)} />
        )}

        {/* Modo quiz activo (bandera/contorno): pantalla autocontenida */}
        {tab === "jugar" && !regionMode && quizMode && (
          <CountryQuizGame mode={quizMode} locale={locale} onExit={() => setQuizMode(null)} />
        )}

        {tab === "jugar" && !regionMode && !quizMode && (
          <>
        {/* Título + gamificación (sin hero gigante; Bordy vive en la esquina) */}
        {!started && (
          <div className="flex flex-col items-center gap-2 pt-2">
            <h2 className="font-display text-2xl font-bold text-white text-center leading-tight">
              {tr.home.titlePre} <span className="text-[#fcff52]">{tr.home.titleWord}</span>
            </h2>
            {/* Strip de gamificación: racha + nivel (XP) */}
            <div className="panel flex items-center w-full py-2.5 px-4 gap-3">
              <div className="flex items-center gap-1.5">
                <span className="text-xl">🔥</span>
                <span key={daysPlayed} className={`font-display font-bold text-white text-lg leading-none${streakBump ? " streak-bump" : ""}`}>{daysPlayed}</span>
                <span className="text-[11px] text-neutral-400">{tr.home.streak}</span>
              </div>
              <div className="w-px h-7 bg-white/10" />
              <div className="flex flex-col flex-1">
                <div className="flex items-center justify-between text-[11px] mb-1">
                  <span className="font-semibold text-[#c4b5fd]">{tr.home.level(xpLevel)}</span>
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
            {/* Card héroe (el único modo con premio): violeta de marca sólido,
                lenguaje neo-brutalista — borde grueso + sombra dura. */}
            <div className="brutal rounded-2xl bg-[#6c2bd9] p-4 flex flex-col gap-3">
              <button
                onClick={() => setModeOpen(modeOpen === "daily" ? null : "daily")}
                className="flex items-center gap-3 text-left active:scale-[0.98] transition w-full"
              >
                <span className="text-3xl">🌍</span>
                <span className="flex-1">
                  <span className="font-display font-bold text-white text-lg block leading-tight">{tr.modes.dailyTitle}</span>
                  <span className="text-xs text-white/80">{tr.modes.dailySub}</span>
                </span>
                <span className="text-[#fcff52] text-2xl">{modeOpen === "daily" ? "▾" : "→"}</span>
              </button>
              {modeOpen === "daily" && (
                <LevelSelect tr={tr} level={level} onChange={(l) => { setLevel(l); setJugarStep("reto"); }} />
              )}
            </div>
            {/* Modo Regiones: colapsado por defecto (UX-4); al abrir, país+mapa */}
            <div className="brutal rounded-2xl bg-[#1c0b3e] p-4 flex flex-col gap-3">
              <button
                onClick={() => setModeOpen(modeOpen === "regions" ? null : "regions")}
                className="flex items-center gap-3 text-left active:scale-[0.98] transition w-full"
              >
                <span className="text-3xl">🗺️</span>
                <span className="flex-1">
                  <span className="font-display font-bold text-white text-lg block leading-tight">{tr.modes.regionsTitle}</span>
                  <span className="text-xs text-neutral-300">{tr.modes.regionsSub}</span>
                </span>
                <span className="text-[9px] uppercase tracking-widest border border-[#22c55e]/50 rounded-full px-2 py-1 text-[#86efac] whitespace-nowrap">{tr.modes.new}</span>
              </button>
              {modeOpen === "regions" && (<>
              {/* Desplegable de país */}
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/flags/national/${regionPick}.webp`}
                  alt=""
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-6 h-4 object-cover rounded-sm border border-white/20"
                />
                <select
                  value={regionPick}
                  onChange={(e) => setRegionPick(e.target.value)}
                  aria-label={tr.a11y.country}
                  className="w-full appearance-none rounded-xl border border-[#b79ced]/25 bg-[#160833]/70 pl-11 pr-8 py-2.5 text-sm font-display font-semibold text-white outline-none focus:border-[#fcff52]/50"
                >
                  {REGION_IDS.map((rid) => (
                    <option key={rid} value={rid} style={{ background: "#1c0b3e", color: "#fff" }}>{REGIONS[rid].flag} {REGIONS[rid].title}</option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-neutral-300 text-xs">▾</span>
              </div>
              {/* Mapa del país elegido */}
              <RegionMapPreview regionId={regionPick} loadingLabel={tr.loadingMap} />
              <button
                onClick={() => setRegionMode(regionPick)}
                className="brutal-sm brutal-press flex items-center justify-center gap-2 rounded-xl bg-[#fcff52] text-[#1c0b3e] font-display font-black py-2.5"
              >
                ▶ {tr.modes.play(REGIONS[regionPick].title)}
              </button>
              <p className="text-[10px] text-neutral-400 text-center">{tr.modes.moreCountries}</p>
              </>)}
            </div>
            {/* Modos quiz: adivina la bandera / el contorno (gratis) */}
            <button
              onClick={() => setQuizMode("flag")}
              className="brutal brutal-press rounded-2xl bg-[#1c0b3e] p-4 flex items-center gap-3 text-left"
            >
              <span className="text-3xl">🏳️</span>
              <span className="flex-1">
                <span className="font-display font-bold text-white text-lg block leading-tight">{tr.quiz.flagTitle}</span>
                <span className="text-xs text-neutral-300">{tr.quiz.flagSub}</span>
              </span>
              <span className="text-[9px] uppercase tracking-widest border border-[#22c55e]/50 rounded-full px-2 py-1 text-[#86efac] whitespace-nowrap">{tr.modes.new}</span>
            </button>
            <button
              onClick={() => setQuizMode("outline")}
              className="brutal brutal-press rounded-2xl bg-[#1c0b3e] p-4 flex items-center gap-3 text-left"
            >
              <span className="text-3xl">🗺️</span>
              <span className="flex-1">
                <span className="font-display font-bold text-white text-lg block leading-tight">{tr.quiz.outlineTitle}</span>
                <span className="text-xs text-neutral-300">{tr.quiz.outlineSub}</span>
              </span>
              <span className="text-[9px] uppercase tracking-widest border border-[#22c55e]/50 rounded-full px-2 py-1 text-[#86efac] whitespace-nowrap">{tr.modes.new}</span>
            </button>
            {/* Modo práctica también accesible desde Jugar (vive en Aprender) */}
            <button
              onClick={() => { setTab("aprender"); setPracticeOn(true); }}
              className="brutal brutal-press rounded-2xl bg-[#1c0b3e] p-4 flex items-center gap-3 text-left"
            >
              <span className="text-3xl">🎓</span>
              <span className="flex-1">
                <span className="font-display font-bold text-white text-lg block leading-tight">{tr.practiceMode}</span>
                <span className="text-xs text-neutral-300">{tr.practiceFree}</span>
              </span>
              <span className="text-[#fcff52] text-2xl">→</span>
            </button>
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

        {/* Pago de pista en curso: cronómetro en pausa + tablero tapado.
            Devuelve exactamente el tiempo que la red se llevó — y nada más
            (con el mapa visible, la espera sería análisis gratis). */}
        {paying !== null && started && !state.solved && (
          <div className="fixed inset-0 z-[60] bg-[#160833]/95 backdrop-blur-sm flex flex-col items-center justify-center gap-3 px-8">
            <span className="text-4xl" aria-hidden>⏸️</span>
            <span className="text-lg font-mono font-bold tabular-nums text-white">🕒 {formatTime(elapsedMs)}</span>
            <p className="font-bold text-white animate-pulse">{tr.paying}</p>
            <p className="text-sm text-neutral-300 text-center max-w-xs">{tr.payTimerPaused}</p>
          </div>
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
            controls={tr.a11y}
          />
        ) : jugarStep === "reto" ? (
          <div className="w-full flex flex-col items-center justify-center gap-3 py-2">
            {/* FIX-2 (guest play): cualquiera con el link puede JUGAR sin
                identidad. Wallet/correo solo se piden para ranking, premios
                y compras — la WinCard ya muestra ese CTA tras ganar. */}
            <button
              onClick={openPregame}
              className="btn-3d font-display font-bold text-2xl px-12 py-4"
            >
              {tr.play}
            </button>
            {/* Zero-click connect: dentro de MiniPay la wallet llega sola vía el
                auto-connect del mount; enseñar "Conectar" ahí está prohibido,
                incluso en el instante en que `myId` aún no se resolvió. */}
            {!myId && ((hasWallet && !inMiniPay) || privyActive) && (
              <div className="flex flex-col items-center gap-2">
                <p className="text-[11px] text-neutral-300 text-center">{tr.connectBenefit}</p>
                <div className="flex items-center gap-2">
                  {hasWallet && !inMiniPay && (
                    <button
                      onClick={connectForRanking}
                      className="brutal-sm brutal-press rounded-xl bg-[#34d399] px-4 py-2 text-xs font-bold text-[#053b27]"
                    >
                      {tr.connectWallet}
                    </button>
                  )}
                  {privyActive && (
                    <EmailLoginButton
                      label={tr.emailLogin}
                      className="brutal-sm brutal-press rounded-xl bg-[#38bdf8] px-4 py-2 text-xs font-bold text-[#082f49]"
                    />
                  )}
                </div>
              </div>
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
                confetti={justWon}
                guesses={guessCount}
                optimal={challenge.optimal}
                timeMs={elapsedMs}
                chain={[challenge.start, ...state.chain.map((c) => c.country), challenge.end]}
                squares={["start", ...state.chain.map((c) => c.quality), "end"]}
                levelLabel={tr.levels[level]}
                onRetry={retry}
                retryPrice={PRICES.retry}
                retryBusy={paying === "retry"}
                payError={payError}
                showDeposit={payLow && inMiniPay}
                onHome={() => { setStarted(false); setJugarStep("level"); setPayError(null); setPayLow(false); }}
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
                  <button type="submit" className="brutal-sm brutal-press rounded-xl bg-[#fcff52] px-5 py-3 font-bold text-[#1c0b3e]">OK</button>
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

                {/* Pista impagable por saldo: salida a la pantalla de recarga */}
                {payLow && inMiniPay && (
                  <div className="flex flex-col">
                    <DepositButton label={tr.deposit} />
                    <p className="text-[10px] text-neutral-400 text-center mt-1.5">{tr.usdtOnly}</p>
                  </div>
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
            {/* Liga semanal v2 (Fase 1: en seco, sin premio) */}
            <WeeklyLeague tr={tr} />
            {/* Selector de nivel: cada nivel tiene su ranking */}
            <LevelSelect tr={tr} level={level} onChange={setLevel} />
            <RankingCard tr={tr} ranking={ranking} best={best} panel={panel} myId={myId} alias={alias} levelLabel={tr.levels[level]} />
            {/* Ganadores del ciclo cerrado. Informativa: se reclama en Perfil */}
            <WinnersCard
              tr={tr}
              cycle={cycle}
              names={winnerNames}
              myId={myId}
              onGoToProfile={() => setTab("perfil")}
              panel={panel}
              fmt={fmt}
            />
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
                    <button type="submit" className="brutal-sm brutal-press rounded-lg bg-[#fcff52] text-[#1c0b3e] font-bold text-xs px-2.5">OK</button>
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
              {/* Igual que en el sheet: nunca "Conectar" dentro de MiniPay. */}
              {!myId && hasWallet && !inMiniPay && (
                <button onClick={connectForRanking} className="brutal-sm brutal-press rounded-lg bg-[#34d399] px-3 py-1.5 text-xs font-bold text-[#053b27]">
                  {tr.connectWallet}
                </button>
              )}
            </section>
            {myId && balances && (
              <WalletCard tr={tr} address={myId} usdt={balances.usdt} fmt={fmt} showAddress={!inMiniPay} />
            )}
            <div className="grid grid-cols-3 gap-2">
              <StatCard v={daysPlayed} k={tr.statDays} color="#fcff52" />
              <StatCard v={best ?? "—"} k={tr.statBestToday} color="#22d3ee" />
              <StatCard v={prizes.length} k={tr.statPrizes} color="#e879f9" />
            </div>
            <Achievements tr={tr} playerId={myId || undefined} />
            {prizes.length > 0 && (
              <PrizesCard tr={tr} prizes={prizes} claimingKey={claimingKey} justClaimed={justClaimed} onClaim={handleClaim} panel={panel} fmt={fmt} />
            )}
            {/* Ajuste de idioma (además del selector rápido del header) */}
            <section className="panel p-4 flex items-center justify-between gap-3">
              <span className="text-sm text-neutral-100 flex items-center gap-2">
                <span>🌐</span>{tr.language}
              </span>
              <LanguageSelect locale={locale} onChange={changeLocale} />
            </section>
            {/* Ajustes de audio: música de fondo y efectos, mute independiente */}
            <section className="panel p-4 flex flex-col gap-3">
              <span className="text-sm text-neutral-100 flex items-center gap-2">
                <span>🔊</span>{tr.audio}
              </span>
              <AudioToggle label={tr.music} icon="🎵" on={!musicMuted} onToggle={onToggleMusic} />
              <AudioToggle label={tr.effects} icon="✨" on={!sfxMuted} onToggle={onToggleSfx} />
            </section>
            {/* Enlaces exigidos por el listado de MiniPay, alcanzables desde
                dentro de la app. Soporte va al correo: el DM de X no cuenta
                como canal válido. */}
            <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-[11px] text-neutral-400 mt-1">
              <a href="/terms" className="underline">{tr.legalTerms}</a>
              <a href="/privacy" className="underline">{tr.legalPrivacy}</a>
              <a href="/stats" className="underline">{tr.stats.title}</a>
              <a href={SUPPORT_MAILTO} className="underline">{tr.legalSupport}</a>
            </div>
            {/* Redes sociales (separadas de los enlaces legales) */}
            <div className="flex justify-center">
              <a
                href={SUPPORT_X_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="X"
                className="w-9 h-9 rounded-full bg-white/5 border border-[#b79ced]/25 flex items-center justify-center text-base text-white active:scale-90 transition"
              >
                𝕏
              </a>
            </div>
            {/* neutral-500 medía ~3.8:1 sobre el fondo violeta (falla AA 4.5:1
                para texto normal). neutral-400 pasa con ~7:1. */}
            <footer className="text-center text-[11px] text-neutral-400">{tr.footer}</footer>
          </>
        )}

        {/* ---------- TAB APRENDER ---------- */}
        {tab === "aprender" && practiceOn && (
          <PracticeGame locale={locale} onExit={() => setPracticeOn(false)} />
        )}

        {tab === "aprender" && !practiceOn && (
          <>
            {/* Bordy presenta el tutorial (mascota real, no un emoji genérico) */}
            <section className="panel p-5 flex flex-col items-center gap-3 text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/bordy-m2.webp" alt="Bordy" className="w-28 h-32 object-contain bordy-float-sm drop-shadow-xl" />
              <h2 className="font-display text-xl font-bold text-white leading-tight">{tr.tabs.aprender}</h2>
              <p className="text-xs text-neutral-300 max-w-[16rem]">{tr.learnBubbles[0]}</p>
              <button
                onClick={() => setOverlay("full")}
                className="brutal brutal-press w-full rounded-2xl bg-[#fcff52] text-[#1c0b3e] font-black px-6 py-3"
              >
                ✨ {tr.fullTutorial}
              </button>
            </section>
            {/* Modo práctica: juego infinito, sin premios, con pistas gratis */}
            <button
              onClick={() => setPracticeOn(true)}
              className="panel p-4 flex items-center gap-3 text-left active:scale-[0.98] transition border border-[#22c55e]/30"
            >
              <span className="text-3xl">🎓</span>
              <span className="flex-1">
                <span className="font-display font-bold text-white text-lg block leading-tight">{tr.practiceMode}</span>
                <span className="text-xs text-neutral-300">{tr.practiceFree}</span>
              </span>
              <span className="text-[#fcff52] text-2xl">→</span>
            </button>
            {/* Ir a jugar: lleva al tab Jugar para elegir modo */}
            <button
              onClick={() => setTab("jugar")}
              className="panel p-4 flex items-center gap-3 text-left active:scale-[0.98] transition"
            >
              <span className="text-3xl">🌍</span>
              <span className="flex-1">
                <span className="font-display font-bold text-white text-lg block leading-tight">{tr.tabs.jugar}</span>
                <span className="text-xs text-neutral-300">{tr.modes.moreModesSub}</span>
              </span>
              <span className="text-[#fcff52] text-2xl">→</span>
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
          className="bordy-fab fixed right-2 z-30 w-[64px] h-[76px] bordy-float-sm active:scale-90 transition"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/bordy-m2.webp" alt="Bordy" className="w-full h-full object-contain drop-shadow-xl" />
        </button>
      )}

      {/* Aviso de Bordy: bono de bienvenida recién otorgado */}
      {bonus && (
        <div className="fixed inset-x-0 bottom-24 z-40 flex justify-center px-4">
          <div className="panel flex items-start gap-3 max-w-sm w-full p-3 border-[#fcff52]/40 shadow-xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/bordy-m2.webp" alt="Bordy" className="w-12 h-14 object-contain shrink-0 bordy-talk" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white leading-snug">{tr.welcomeBonus(fmt(Number(bonus)))}</p>
              <button
                onClick={() => setBonus(null)}
                className="brutal-sm brutal-press mt-2 rounded-lg bg-[#fcff52] px-3 py-1.5 text-xs font-bold text-[#1c0b3e]"
              >
                {tr.bonusDismiss}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom-nav */}
      {/* Burbuja de hito de racha (GAM-2): aparece sobre la nav en el momento
          real del hito (al resolver), se va sola o con un toque. */}
      {milestone !== null && (
        <div
          role="status"
          onClick={() => setMilestone(null)}
          className="milestone-toast panel fixed inset-x-4 z-40 flex items-center gap-3 px-4 py-3 cursor-pointer"
        >
          <img src="/bordy-m2.webp" alt="Bordy" className="w-12 h-14 object-contain bordy-talk" />
          <p className="flex-1 font-display font-bold text-lg leading-tight prism-text">
            {tr.home.milestone(milestone)}
          </p>
        </div>
      )}
      <TabBar tr={tr} tab={tab} onTab={setTab} playPending={!state.solved} streak={daysPlayed} />

      {/* Overlays pre-juego */}
      {overlay === "full" && (
        <BordyTutorial
          tr={tr}
          locale={locale}
          onDone={() => {
            setOverlay(null);
            if (!started) enterGame();
          }}
        />
      )}
      {overlay === "quick" && (
        <QuickStart
          tr={tr}
          onDone={() => {
            setOverlay(null);
            if (!started) enterGame();
          }}
          onFull={() => setOverlay("full")}
        />
      )}

      {/* Wallet sheet */}
      {walletOpen && (
        <WalletSheet
          onClose={() => setWalletOpen(false)}
          myId={myId}
          alias={alias}
          hasWallet={hasWallet}
          inMiniPay={inMiniPay}
          emailLogin={privyActive}
          onConnect={connectForRanking}
          tr={tr}
        />
      )}

      {/* Settings sheet: idioma + música + efectos, todo detrás del ⚙️ */}
      {settingsOpen && (
        <SettingsSheet
          onClose={() => setSettingsOpen(false)}
          locale={locale}
          onChangeLocale={changeLocale}
          musicMuted={musicMuted}
          onToggleMusic={onToggleMusic}
          sfxMuted={sfxMuted}
          onToggleSfx={onToggleSfx}
          tr={tr}
        />
      )}

      {/* Prompt de nombre al registrarse */}
      {nameModal && (
        <NamePrompt
          tr={tr}
          initial={alias}
          onSave={(name) => {
            setAlias(name);
            setAliasState(getAlias());
            try { localStorage.setItem("frontle-name-asked", "1"); } catch {}
            setNameModal(false);
          }}
          onSkip={() => {
            try { localStorage.setItem("frontle-name-asked", "1"); } catch {}
            setNameModal(false);
          }}
        />
      )}

      {/* Coachmarks de las pistas (1ª partida): el juego está en modo previo
          (reto oculto, reloj en 00:00); al terminar arranca la partida real */}
      {coaching && (
        <Coachmarks
          steps={[
            { target: "game-input", text: tr.coachSteps[0] },
            { target: "hints-panel", text: tr.coachSteps[1] },
            { target: "game-timer", text: tr.coachSteps[2] },
          ]}
          labels={{ skip: tr.coachSkip, next: tr.tutNext, done: tr.coachDone }}
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

// Botón de recarga. MiniPay pide que un saldo insuficiente lleve a su pantalla
// de depósito y no a un error sin salida. Solo tiene sentido dentro de MiniPay:
// fuera, el deeplink no resuelve a nada.
function DepositButton({ label }: { label: string }) {
  return (
    <a
      href={ADD_CASH_URL}
      className="brutal-sm brutal-press rounded-xl bg-[#34d399] px-6 py-3 text-center font-bold text-[#053b27] inline-block"
    >
      ↓ {label}
    </a>
  );
}

// Tarjeta de saldo (perfil). Muestra el stablecoin en la moneda elegida.
//
// Dos cosas que MiniPay prohíbe y que por eso NO aparecen aquí dentro:
//   · El token CELO: la comisión de red se paga con el stablecoin (CIP-64) y
//     MiniPay lo oculta al usuario.
//   · La dirección 0x cruda como identidad. Se sigue mostrando FUERA de
//     MiniPay porque el usuario de correo no tiene otra forma de recargar su
//     wallet embebida; dentro de MiniPay el propio wallet ya la provee.
function WalletCard({
  tr,
  address,
  usdt,
  fmt,
  showAddress,
}: {
  tr: ReturnType<typeof t>;
  address: string;
  usdt: number;
  fmt: (u: number) => string;
  showAddress: boolean;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <section className="panel p-4">
      <p className="text-[10px] uppercase tracking-widest text-neutral-300 mb-2">{tr.walletBalanceTitle}</p>
      <span className="text-2xl font-black text-white">{fmt(usdt)}</span>
      {showAddress && (
        <button
          onClick={() => {
            navigator.clipboard?.writeText(address);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
          className="brutal-sm brutal-press mt-2 w-full truncate rounded-lg bg-[#160833] px-2 py-1.5 text-[11px] font-mono text-neutral-300"
          title={address}
        >
          {copied ? tr.addressCopied : `${address} 📋`}
        </button>
      )}
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
function TabBar({
  tr,
  tab,
  onTab,
  playPending,
  streak,
}: {
  tr: ReturnType<typeof t>;
  tab: Tab;
  onTab: (t: Tab) => void;
  playPending: boolean;
  streak: number;
}) {
  // El pop solo se dispara al tocar un tab, no al cargar la página.
  const booted = useRef(false);
  useEffect(() => {
    booted.current = true;
  }, []);
  const items: { id: Tab; label: string }[] = [
    { id: "jugar", label: tr.tabs.jugar },
    { id: "ranking", label: tr.tabs.ranking },
    { id: "perfil", label: tr.tabs.perfil },
    { id: "aprender", label: tr.tabs.aprender },
  ];
  return (
    <nav className="app-nav fixed bottom-0 inset-x-0 z-30 flex bg-[#130729]/85 backdrop-blur-md border-t border-[#b79ced]/15">
      {items.map((it) => {
        const on = tab === it.id;
        return (
          <button
            key={it.id}
            onClick={() => onTab(it.id)}
            aria-current={on ? "page" : undefined}
            className={`relative flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] transition active:scale-95 ${
              on ? "text-white" : "text-neutral-400"
            }`}
          >
            {on && <span aria-hidden className="tab-glow" />}
            <span
              className={`tab-icon relative ${
                on ? `tab-icon-on${booted.current ? " tab-pop" : ""}` : "opacity-60"
              }`}
            >
              <NavIcon name={it.id} />
            </span>
            {it.label}
            {it.id === "jugar" && playPending && (
              <>
                <span aria-hidden className="tab-dot" />
                <span className="sr-only">{tr.home.pendingToday}</span>
              </>
            )}
            {it.id === "perfil" && streak >= 2 && (
              <span className="tab-streak" aria-label={`${streak} ${tr.home.streak}`}>
                🔥{streak}
              </span>
            )}
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
  alias,
  hasWallet,
  inMiniPay,
  emailLogin,
  onConnect,
  tr,
}: {
  onClose: () => void;
  myId: string;
  alias: string;
  hasWallet: boolean;
  inMiniPay: boolean;
  emailLogin: boolean;
  onConnect: () => void;
  tr: ReturnType<typeof t>;
}) {
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/55" onClick={onClose} />
      <div className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl bg-[#1c0b3e] border-t border-[#b79ced]/25 px-5 pt-3 pb-8">
        <div className="w-10 h-1 rounded-full bg-white/25 mx-auto mb-4" />
        <h3 className="text-white font-bold text-base mb-3">{tr.walletSheet.title}</h3>
        {myId ? (
          <div className="panel p-4">
            <div className="text-[11px] text-neutral-400">{tr.walletSheet.connectedAs}</div>
            {/* Nunca la dirección 0x cruda: alias primero, y si no hay, la
                forma truncada, que MiniPay solo admite como pista secundaria. */}
            <div className="text-white text-sm mt-0.5 break-all">
              {alias || <span className="font-mono">{shortId(myId)}</span>}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {/* Zero-click connect: dentro de MiniPay la wallet ya está
                conectada, así que enseñar "Conectar" está prohibido. */}
            {hasWallet && !inMiniPay && (
              <button onClick={() => { onConnect(); onClose(); }} className="brutal-sm brutal-press rounded-2xl bg-[#34d399] px-6 py-3 font-bold text-[#053b27]">
                {tr.connectWallet}
              </button>
            )}
            {emailLogin && (
              <EmailLoginButton label={tr.emailLogin} className="brutal-sm brutal-press rounded-2xl bg-[#38bdf8] px-6 py-3 font-bold text-[#082f49]" />
            )}
            <p className="text-center text-[11px] text-neutral-400">{tr.connectBenefit}</p>
          </div>
        )}
      </div>
    </>
  );
}

// Sheet de ajustes: agrupa idioma + música + efectos detrás del ⚙️ del header
// (a 360px no caben como controles sueltos; ver comentario en el header).
function SettingsSheet({
  onClose,
  locale,
  onChangeLocale,
  musicMuted,
  onToggleMusic,
  sfxMuted,
  onToggleSfx,
  tr,
}: {
  onClose: () => void;
  locale: Locale;
  onChangeLocale: (l: Locale) => void;
  musicMuted: boolean;
  onToggleMusic: () => void;
  sfxMuted: boolean;
  onToggleSfx: () => void;
  tr: ReturnType<typeof t>;
}) {
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/55" onClick={onClose} />
      <div className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl bg-[#1c0b3e] border-t border-[#b79ced]/25 px-5 pt-3 pb-8">
        <div className="w-10 h-1 rounded-full bg-white/25 mx-auto mb-4" />
        <h3 className="text-white font-bold text-base mb-4">{tr.settingsSheet.title}</h3>
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-neutral-200 flex items-center gap-2">
              <span>🌐</span>{tr.settingsSheet.language}
            </span>
            <LanguageSelect locale={locale} onChange={onChangeLocale} />
          </div>
          <AudioToggle label={tr.music} icon="🎵" on={!musicMuted} onToggle={onToggleMusic} />
          <AudioToggle label={tr.effects} icon="✨" on={!sfxMuted} onToggle={onToggleSfx} />
        </div>
      </div>
    </>
  );
}

// Botón de "volver" del flujo pre-juego
// Modal de elección de nombre al registrarse (pendiente i18n como los coachmarks)
function NamePrompt({
  tr,
  initial,
  onSave,
  onSkip,
}: {
  tr: ReturnType<typeof t>;
  initial: string;
  onSave: (name: string) => void;
  onSkip: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  const clean = draft.trim();
  return (
    <>
      <div className="fixed inset-0 z-[65] bg-black/60" onClick={onSkip} />
      <div className="fixed inset-x-0 bottom-0 z-[66] rounded-t-3xl bg-[#1c0b3e] border-t border-[#b79ced]/25 px-5 pt-3 pb-8 pop-in">
        <div className="w-10 h-1 rounded-full bg-white/25 mx-auto mb-4" />
        <div className="flex items-center gap-3 mb-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/bordy-m2.webp" alt="Bordy" className="w-12 h-14 object-contain flex-none bordy-float-sm" />
          <div>
            <h3 className="font-display font-bold text-white text-lg leading-tight">{tr.name.title}</h3>
            <p className="text-xs text-neutral-300">{tr.name.sub}</p>
          </div>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); if (clean) onSave(clean); }} className="flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={16}
            autoFocus
            placeholder={tr.namePlaceholder}
            className="flex-1 rounded-xl bg-[#160833] border border-[#b79ced]/40 px-4 py-3 text-base text-white outline-none focus:border-[#fcff52]/70"
          />
          <button type="submit" disabled={!clean} className="btn-3d font-display font-bold text-base px-6 disabled:opacity-40">
            {tr.name.save}
          </button>
        </form>
        <button onClick={onSkip} className="block mx-auto mt-3 text-[11px] text-neutral-400 underline active:scale-95 transition">
          {tr.name.skip}
        </button>
      </div>
    </>
  );
}

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
      className={`brutal-sm brutal-press rounded-lg px-3 py-1.5 text-xs font-semibold ${
        active
          ? "bg-amber-300 text-[#1c0b3e]"
          : busy
            ? "bg-[#1c0b3e] text-white animate-pulse"
            : `bg-[#1c0b3e] text-white hover:bg-[#2a1257] ${locked ? "opacity-50" : ""}`
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

// Selector de idioma. `compact` = versión de header (solo el globo 🌐);
// sin `compact` = versión con etiqueta para el tab Perfil. Los 4 idiomas
// (es/en/fr/pt) ya están traducidos en STRINGS.
function LanguageSelect({ locale, onChange, compact }: { locale: Locale; onChange: (l: Locale) => void; compact?: boolean }) {
  return (
    <div className="relative inline-flex shrink-0 items-center">
      <span className="pointer-events-none absolute left-2 text-xs">🌐</span>
      <select
        value={locale}
        onChange={(e) => onChange(e.target.value as Locale)}
        aria-label="Language"
        className={
          compact
            ? "appearance-none h-11 rounded-full bg-white/5 border border-[#b79ced]/25 pl-5 pr-1.5 text-xs font-semibold text-white outline-none focus:border-[#fcff52]/50 active:scale-95 transition"
            : "appearance-none rounded-md border border-[#b79ced]/25 bg-[#1c0b3e]/70 pl-7 pr-3 py-1.5 text-xs font-semibold text-white outline-none focus:border-[#fcff52]/50"
        }
      >
        {/* Colores explícitos en cada option: el popup nativo hereda fondo
            claro en algunos navegadores y el texto blanco quedaba ilegible. */}
        {LOCALES.map((l) => (
          <option key={l} value={l} style={{ background: "#1c0b3e", color: "#fff" }}>{compact ? l.toUpperCase() : LOCALE_LABELS[l]}</option>
        ))}
      </select>
    </div>
  );
}

// Interruptor de audio (música / efectos) estilo switch, con estado on/off.
function AudioToggle({ label, icon, on, onToggle }: { label: string; icon: string; on: boolean; onToggle: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-neutral-200 flex items-center gap-2">
        <span>{icon}</span>{label}
      </span>
      <button
        onClick={onToggle}
        role="switch"
        aria-checked={on}
        aria-label={label}
        className={`relative w-12 h-7 rounded-full border transition ${on ? "bg-[#fcff52]/80 border-[#fcff52]" : "bg-[#160833] border-[#b79ced]/30"}`}
      >
        <span className={`absolute top-1 w-5 h-5 rounded-full transition-all ${on ? "left-6 bg-[#1c0b3e]" : "left-1 bg-neutral-400"}`} />
      </button>
    </div>
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
              className={`brutal-shadow brutal-press flex flex-col items-center gap-0.5 rounded-2xl border-2 px-2 py-2.5 backdrop-blur-sm ${
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

// Ganadores del último día cerrado, un renglón por nivel. Es INFORMATIVA:
// el reclamo vive en un solo sitio, el Perfil, para que el jugador no tenga
// que buscarlo en dos pantallas. Si el ganador eres tú y aún no lo cobraste,
// esta tarjeta te lleva allí.
//
// El estado "Reclamado" sale de `claimed` del CONTRATO, nunca de un estado
// local: así sigue diciendo la verdad tras recargar o si cobraste desde otro
// dispositivo.
function WinnersCard({
  tr,
  cycle,
  names,
  myId,
  onGoToProfile,
  panel,
  fmt,
}: {
  tr: ReturnType<typeof t>;
  cycle: LastCycle | null;
  names: Record<string, string>;
  myId: string;
  onGoToProfile: () => void;
  panel: string;
  fmt: (usdt: number) => string;
}) {
  if (!cycle) {
    return (
      <section className={`${panel} p-3`}>
        <p className="text-[10px] uppercase tracking-widest text-amber-300 mb-1 text-center">{tr.winnersTitle}</p>
        <p className="text-sm text-neutral-300 text-center py-2">{tr.winnersEmpty}</p>
      </section>
    );
  }

  const me = myId.toLowerCase();

  return (
    <section className={`${panel} p-3`}>
      <div className="flex items-baseline justify-between gap-2 mb-2">
        <p className="text-[10px] uppercase tracking-widest text-amber-300">{tr.winnersTitle}</p>
        <span className="text-[10px] text-neutral-400 tabular-nums">{tr.winnersDay(cycle.day)}</span>
      </div>

      <ul className="flex flex-col gap-2">
        {cycle.winners.map((w) => {
          const key = `${cycle.day}-${w.level}`;
          const mine = !!w.winner && w.winner === me;
          const label = w.winner
            ? names[w.winner] || `${tr.anonPlayer} ${shortId(w.winner)}`
            : tr.noWinner;

          return (
            <li
              key={key}
              className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 ${
                mine ? "border-amber-400/50 bg-amber-400/10" : "border-white/10 bg-white/[0.03]"
              }`}
            >
              <div className="flex flex-col min-w-0">
                <span className="text-[10px] uppercase tracking-wider text-neutral-400">{tr.levels[w.level]}</span>
                <span className={`text-sm truncate ${mine ? "text-amber-100 font-semibold" : "text-neutral-200"}`}>
                  {label} {mine ? "👈" : ""}
                </span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {/* neutral-500 falla AA (~3.8:1); neutral-400 pasa (~7:1). */}
                <span className={`text-sm tabular-nums ${w.winner ? "text-amber-300" : "text-neutral-400"}`}>
                  {fmt(w.amount)}
                </span>

                {mine && w.claimed && (
                  <span className="rounded-lg border border-emerald-400/40 bg-emerald-400/10 px-2 py-1 text-[11px] font-medium text-emerald-300">
                    ✓ {tr.prizeClaimedLabel}
                  </span>
                )}

                {mine && !w.claimed && (
                  <button
                    onClick={onGoToProfile}
                    className="brutal-sm brutal-press rounded-lg bg-amber-300 px-2.5 py-1 text-[11px] font-bold text-[#1c0b3e]"
                  >
                    {tr.claimInProfile}
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// El ÚNICO sitio donde se reclama. Lista todos los (día, nivel) que el
// contrato confirma cobrables, no solo los del último ciclo.
function PrizesCard({
  tr,
  prizes,
  claimingKey,
  justClaimed,
  onClaim,
  panel,
  fmt,
}: {
  tr: ReturnType<typeof t>;
  prizes: ClaimablePrize[];
  claimingKey: string | null;
  justClaimed: string | null;
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
          const celebrating = justClaimed === key;
          return (
            <li
              key={key}
              className={`relative overflow-hidden flex items-center justify-between gap-3 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 ${
                celebrating ? "claim-flash" : ""
              }`}
            >
              {celebrating &&
                ["-18px", "0px", "16px", "30px"].map((dx, i) => (
                  <span
                    key={dx}
                    className="claim-spark right-6 bottom-2 text-sm"
                    style={{ ["--dx" as string]: dx, animationDelay: `${i * 70}ms` }}
                    aria-hidden="true"
                  >
                    ✨
                  </span>
                ))}

              <span className="text-sm text-amber-100">
                {tr.prizeRow(fmt(p.amount))} <span className="text-amber-300/80">· {tr.levels[p.level]}</span>
              </span>
              {/* Durante la celebración la fila sigue visible pero el premio
                  ya está cobrado: el botón queda bloqueado y marcado. */}
              <button
                onClick={() => onClaim(p.day, p.level)}
                disabled={claimingKey !== null || celebrating}
                className="brutal-sm brutal-press rounded-lg bg-amber-300 px-3 py-1.5 text-xs font-bold text-[#1c0b3e] disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {celebrating ? `✓ ${tr.prizeClaimedLabel}` : claimingKey === key ? tr.prizeClaiming : tr.prizeClaim}
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
  alias,
  levelLabel,
}: {
  tr: ReturnType<typeof t>;
  ranking: ScoreEntry[];
  best: number | null;
  panel: string;
  myId: string;
  alias: string;
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
              <th className="text-left font-medium py-1">{tr.colPlayer}</th>
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
                  {/* El nombre manda. Quien jugó antes de que existiera el
                      perfil no tiene ninguno: se le identifica con la etiqueta
                      genérica y la dirección truncada, que MiniPay solo admite
                      como pista secundaria, nunca como identidad principal. */}
                  <td className="py-1.5 text-xs">
                    {r.name ? (
                      <span className="font-semibold">{r.name}</span>
                    ) : (
                      <span className="text-neutral-300">
                        {tr.anonPlayer} <span className="font-mono text-neutral-400">{shortId(r.playerId)}</span>
                      </span>
                    )}
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
        {/* Mismo criterio que la tabla: nombre, o etiqueta + dirección. */}
        {myId ? `${alias || `${tr.anonPlayer} ${shortId(myId)}`} · ` : ""}
        {best !== null ? `${tr.bestToday(best)} · ` : ""}{tr.rankingNote}
      </p>
    </section>
  );
}

function WinCard({
  tr,
  confetti,
  guesses,
  optimal,
  timeMs,
  chain,
  squares,
  levelLabel,
  onRetry,
  retryPrice,
  retryBusy,
  payError,
  showDeposit,
  onHome,
  hasWallet,
  inRanking,
  onConnect,
  panel,
  fmt,
}: {
  tr: ReturnType<typeof t>;
  confetti: boolean;
  guesses: number;
  optimal: number;
  timeMs: number;
  chain: string[];
  squares: Square[];
  levelLabel: string;
  onRetry: () => void;
  retryPrice: number;
  retryBusy: boolean;
  payError: string | null;
  showDeposit: boolean;
  onHome: () => void;
  hasWallet: boolean;
  inRanking: boolean;
  onConnect: () => void;
  panel: string;
  fmt: (usdt: number) => string;
}) {
  const perfect = guesses <= optimal;
  const stars: 1 | 2 | 3 = perfect ? 3 : guesses <= optimal + 1 ? 2 : 1;

  // Texto que acompaña a la imagen — spoiler-free (sin las banderas de la ruta).
  const shareText = `🌍 Frontle · ${tr.modes.dailyTitle}\n${tr.winText(guesses, optimal, perfect)} · ${formatTime(timeMs)}\nfrontle.vercel.app`;

  // Piezas de confeti del gradiente prisma: dispersión determinista por índice
  // (nada aleatorio en render — consistencia SSR/cliente).
  const PRISM = ["#c084fc", "#a855f7", "#ffffff", "#fcff52"];
  const pieces = confetti && perfect ? Array.from({ length: 14 }, (_, i) => i) : [];

  return (
    <section className={`${panel} relative overflow-hidden p-5 text-center`}>
      {pieces.length > 0 && (
        <div aria-hidden className="absolute inset-0 pointer-events-none">
          {pieces.map((i) => (
            <span
              key={i}
              className="confetti-piece"
              style={{
                background: PRISM[i % PRISM.length],
                left: `${8 + ((i * 37) % 84)}%`,
                ["--dx" as string]: `${((i % 7) - 3) * 16}px`,
                ["--rot" as string]: `${180 + ((i * 53) % 180)}deg`,
                animationDelay: `${(i % 5) * 0.07}s`,
              }}
            />
          ))}
        </div>
      )}
      {/* El prisma se reserva para la celebración: solo la ruta óptima lo luce. */}
      <div className={`text-3xl font-black ${perfect ? "prism-text" : "text-white"}`}>{perfect ? tr.winPerfect : tr.winNormal}</div>
      <PrecisionStars count={stars} label={tr.starsLabel(stars)} />
      <p className="text-neutral-200 mt-2">{tr.winText(guesses, optimal, perfect)}</p>
      <p className="text-neutral-300 mt-1 font-mono">⏱️ {tr.timeLabel}: {formatTime(timeMs)}</p>
      {/* Puntos Frontle (GAM-5): se ganan por resolver, aunque no ganes el
          pot. El total vive en Perfil (vista player_progress). */}
      <p className="pop-in mt-2 inline-block rounded-full border border-[#fcff52]/40 bg-[#fcff52]/10 px-3 py-1 text-xs font-semibold text-[#fcff52]">
        ✨ {tr.points.earned(POINTS_PER_SOLVE)}
      </p>
      <div className="mt-4">
        <ScoreCard
          data={{
            modeLabel: `${tr.modes.dailyTitle} · ${levelLabel}`,
            dateLabel: new Date().toLocaleDateString(),
            stars,
            squares,
            stats: [tr.winText(guesses, optimal, perfect), formatTime(timeMs)],
          }}
          shareText={shareText}
          label={tr.share}
          copiedLabel={tr.copied}
        />
      </div>
      <div className="flex flex-col gap-2 mt-4">
        {/* Siempre disponible: aun con marca perfecta se puede reintentar para mejorar el TIEMPO (desempate del ranking). */}
        <button
          onClick={onRetry}
          disabled={retryBusy}
          className={`brutal-sm brutal-press rounded-xl bg-[#1c0b3e] px-6 py-3 font-bold text-white ${retryBusy ? "animate-pulse" : ""}`}
        >
          {retryBusy ? <>⏳ {tr.paying}</> : <>{tr.retry} <span className="opacity-70 text-sm">· {fmt(retryPrice)}</span></>}
        </button>
        {payError && <p className="text-xs text-rose-400">{payError}</p>}
        {showDeposit && (
          <div className="flex flex-col">
            <DepositButton label={tr.deposit} />
            <p className="text-[10px] text-neutral-400 text-center mt-1.5">{tr.usdtOnly}</p>
          </div>
        )}
        {/* Volver a la selección de nivel: jugar otro nivel (o revisar este). */}
        <button onClick={onHome} className="brutal-sm brutal-press rounded-xl bg-[#1c0b3e] px-6 py-3 font-bold text-[#c4b5fd]">
          🎮 {tr.chooseLevel}
        </button>
        {!inRanking && hasWallet && (
          <button onClick={onConnect} className="brutal-sm brutal-press rounded-xl bg-[#34d399] px-6 py-3 font-bold text-[#053b27]">
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
