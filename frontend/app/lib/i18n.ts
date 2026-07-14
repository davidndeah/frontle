// ============================================================
//  Frontle — Internacionalización
//  Idiomas de los mercados principales de Celo/MiniPay:
//   ES (Colombia) · EN (Nigeria, Kenia, Ghana, Sudáfrica, Filipinas)
//   PT (Brasil) · FR (África francófona)
//  Los nombres de países se traducen con Intl.DisplayNames (nativo),
//  derivando el código ISO desde la bandera — sin traducir a mano.
// ============================================================

import { COUNTRY_NAMES, getCountry } from "./countries";
import { getIsland } from "./islands";
import { normalize, resolveCountry, type GuessReason } from "./game";

export type Locale = "es" | "en" | "fr" | "pt";
export const LOCALES: Locale[] = ["es", "en", "fr", "pt"];

// Nombres nativos para el selector manual de idioma.
export const LOCALE_LABELS: Record<Locale, string> = {
  es: "Español",
  en: "English",
  fr: "Français",
  pt: "Português",
};

// Idioma por defecto: inglés. Frontle es un producto global (MiniPay),
// así que sin señales del navegador el fallback es inglés, no español.
export const DEFAULT_LOCALE: Locale = "en";
const LOCALE_STORAGE_KEY = "frontle-locale";

// Preferencia manual guardada (o null si no hay / no es válida).
export function savedLocale(): Locale | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const v = localStorage.getItem(LOCALE_STORAGE_KEY);
    return v && (LOCALES as string[]).includes(v) ? (v as Locale) : null;
  } catch {
    return null;
  }
}

// Persiste la elección manual de idioma.
export function saveLocale(locale: Locale): void {
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {}
}

export function detectLocale(): Locale {
  // 1) La preferencia manual del usuario manda por encima de todo.
  const saved = savedLocale();
  if (saved) return saved;
  // 2) Idioma del navegador; en SSR (sin navigator) o si no lo soportamos, inglés.
  if (typeof navigator === "undefined") return DEFAULT_LOCALE;
  const lang = (navigator.language || DEFAULT_LOCALE).slice(0, 2).toLowerCase();
  return (LOCALES as string[]).includes(lang) ? (lang as Locale) : DEFAULT_LOCALE;
}

// --- Idioma por REGIÓN de conexión (petición de David) ---
// El país (vía IP, ya disponible por getIpCountry) decide el idioma cuando el
// usuario no eligió uno manualmente. Orden final: manual → geo → navegador → en.
const ES_COUNTRIES = "AR BO CL CO CR CU DO EC ES GQ GT HN MX NI PA PE PY SV UY VE".split(" ");
const PT_COUNTRIES = "AO BR CV GW MZ PT ST TL".split(" ");
const FR_COUNTRIES = "BF BJ CD CF CG CI CM FR GA GN HT KM MC MG ML NE SN TD TG".split(" ");
const COUNTRY_LOCALE: Record<string, Locale> = Object.fromEntries([
  ...ES_COUNTRIES.map((c) => [c, "es"]),
  ...PT_COUNTRIES.map((c) => [c, "pt"]),
  ...FR_COUNTRIES.map((c) => [c, "fr"]),
]) as Record<string, Locale>;

// Idioma sugerido para un código de país ISO2 (null si no mapeamos → inglés/navegador).
export function localeForCountry(iso2: string): Locale | null {
  return COUNTRY_LOCALE[iso2?.toUpperCase?.() ?? ""] ?? null;
}

// --- Nombres de país localizados ---
const dnCache: Partial<Record<Locale, Intl.DisplayNames>> = {};
function displayNames(locale: Locale): Intl.DisplayNames | null {
  try {
    if (!dnCache[locale]) {
      dnCache[locale] = new Intl.DisplayNames([locale], { type: "region" });
    }
    return dnCache[locale]!;
  } catch {
    return null;
  }
}

export function countryName(canonical: string, locale: Locale): string {
  // País del grafo o insular (modos quiz) — mismo criterio Intl para ambos.
  const c = getCountry(canonical) ?? getIsland(canonical);
  if (!c) return canonical;
  const dn = displayNames(locale);
  if (!dn) return canonical;
  try {
    const name = dn.of(c.code);
    if (!name || name === c.code) return canonical; // p.ej. XK desconocido
    return name;
  } catch {
    return canonical;
  }
}

// Nombre de país a partir del código ISO alpha-2 (el que guarda `scores`,
// derivado de la IP). Mismo criterio que countryName: nunca se traduce a mano.
export function regionName(code: string, locale: Locale): string {
  const cc = code.toUpperCase();
  const dn = displayNames(locale);
  if (!dn) return cc;
  try {
    return dn.of(cc) || cc;
  } catch {
    return cc;
  }
}

// Bandera emoji desde el código ISO: cada letra → su Regional Indicator.
export function codeToFlag(code: string): string {
  const cc = code.toUpperCase();
  if (!/^[A-Z]{2}$/.test(cc)) return "🏳️";
  return String.fromCodePoint(...[...cc].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65));
}

// --- Resolución de input en cualquier idioma ---
// Fábrica: índice normalizado (canónico + los 4 idiomas) sobre CUALQUIER
// lista de nombres. El mundial usa la del grafo; los quiz, la extendida
// con insulares (lib/quiz.ts) — sin tocar el comportamiento del mundial.
export function makeLocalizedResolver(names: readonly string[]): (input: string) => string | null {
  const idx: Record<string, string> = {};
  for (const canonical of names) {
    idx[normalize(canonical)] = canonical;
    for (const loc of LOCALES) {
      idx[normalize(countryName(canonical, loc))] = canonical;
    }
  }
  return (input) => idx[normalize(input)] ?? null;
}

const resolveGraphLocalized = makeLocalizedResolver(COUNTRY_NAMES);

export function resolveLocalized(input: string): string | null {
  return resolveGraphLocalized(input) ?? resolveCountry(input);
}

export function suggestLocalized(
  input: string,
  locale: Locale,
  limit = 6,
  names: readonly string[] = COUNTRY_NAMES
): string[] {
  const q = normalize(input);
  if (!q) return [];
  const starts: string[] = [];
  const contains: string[] = [];
  for (const canonical of names) {
    const loc = normalize(countryName(canonical, locale));
    const canon = normalize(canonical);
    if (loc.startsWith(q) || canon.startsWith(q)) starts.push(canonical);
    else if (loc.includes(q) || canon.includes(q)) contains.push(canonical);
  }
  return [...starts, ...contains].slice(0, limit);
}

// --- Cadenas de UI ---
type Dict = {
  tagline: string;
  daily: string;
  optimal: (n: number) => string;
  legend: { origin: string; destination: string; good: string; lateral: string; far: string };
  placeholder: string;
  used: (n: number) => string;
  free: string;
  loadingMap: string;
  winPerfect: string;
  winNormal: string;
  winText: (guesses: number, optimal: number, perfect: boolean) => string;
  share: string;
  copied: string;
  comeback: string;
  retry: string;
  paying: string;
  payFailed: string;
  payCancelled: string;
  payNoFunds: (amount: string) => string;
  payNoGas: string;
  footer: string;
  hintsTitle: string;
  hintInitial: string;
  hintSilhouetteNext: string;
  hintSilhouetteAll: string;
  hintNextInitial: (letter: string) => string;
  nextChallenge: (time: string) => string;
  prize: (amount: string) => string;
  levelPrize: (amount: string) => string;
  copmBalance: (amount: string) => string;
  amountIn: string;
  noWallet: string;
  connectToRank: string;
  connectWallet: string;
  connectBenefit: string;
  connectToPlay: string;
  openInMiniPay: string;
  emailLogin: string;
  welcomeBonus: (amount: string) => string;
  bonusDismiss: string;
  levels: { easy: string; medium: string; hard: string };
  chooseLevel: string;
  tabs: { jugar: string; ranking: string; perfil: string; aprender: string };
  profileGuest: string;
  profileConnected: string;
  profileConnectHint: string;
  namePlaceholder: string;
  statDays: string;
  statBestToday: string;
  statPrizes: string;
  walletBalanceTitle: string;
  deposit: string;
  addressCopied: string;
  language: string;
  audio: string;
  music: string;
  effects: string;
  legalTerms: string;
  legalPrivacy: string;
  legalSupport: string;
  learnBubbles: string[];
  practiceSoon: string;
  practiceMode: string;
  practiceFree: string;
  practiceHint: string;
  practiceNextRound: string;
  practiceExit: string;
  // Modo Regiones (marco del juego; los nombres de subdivisiones van en idioma local)
  region: {
    challengeOfDay: string;
    timerStarts: string;
    chooseOtherMode: string;
    modeFooter: (title: string) => string;
    placeholder: (noun: string) => string;
    optimalRoute: (n: number, noun: string) => string;
    winText: (guesses: number, optimal: number, perfect: boolean, noun: string) => string;
    used: (n: number) => string;
    bestToday: (n: number, noun: string) => string;
    hintInitial: (noun: string) => string;
    hintSilNext: (noun: string) => string;
    hintSilAll: (nounMany: string) => string;
    hintNextInitial: (letter: string, noun: string) => string;
  };
  // Selector de modos (paso "modes" del tab Jugar)
  modes: {
    dailyTitle: string; dailySub: string;
    regionsTitle: string; regionsSub: string; new: string;
    play: (title: string) => string; moreCountries: string;
    moreModesTitle: string; moreModesSub: string;
  };
  a11y: {
    country: string;
    sound: string;
    music: (muted: boolean) => string;
    effects: (muted: boolean) => string;
    zoomIn: string;
    zoomOut: string;
    recenter: string;
    settings: string;
  };
  // Prompt de alias al registrarse
  name: { title: string; sub: string; save: string; skip: string };
  // Cabecera del home (título + strip de gamificación)
  home: { titlePre: string; titleWord: string; streak: string; level: (n: number) => string };
  // `signIn` es el chip del header cuando aún no hay wallet ni alias
  walletSheet: { title: string; connectedAs: string; signIn: string };
  // Sheet del header que agrupa idioma + audio (botón ⚙️)
  settingsSheet: { title: string; language: string };
  comingSoon: string;
  // Nombres de continente (pistas de los modos quiz)
  continents: Record<"AF" | "EU" | "AS" | "NA" | "SA" | "OC", string>;
  // Modos quiz (Adivina la bandera / el contorno)
  quiz: {
    flagTitle: string; flagSub: string;
    outlineTitle: string; outlineSub: string;
    whichCountry: string;
    hintBtn: string;
    continentIn: (name: string) => string;
    borders: (n: number) => string;
    island: string;
    initial: (letter: string) => string;
    crossFlag: string; crossOutline: string;
    tries: (n: number) => string;
    wrong: string;
    correct: (name: string) => string;
  };
  // Sustantivo localizado por tipo de subdivisión (singular/plural)
  subdivisionNoun: Record<"department" | "state" | "province" | "region", { one: string; many: string }>;
  tutorialSteps: string[];
  tutNext: string;
  tutPlay: string;
  dontShowAgain: string;
  skipTutorial: string;
  ready: string;
  go: string;
  fullTutorial: string;
  coachSteps: string[];
  coachSkip: string;
  coachDone: string;
  rankingTitle: string;
  bestToday: (n: number) => string;
  noScoreYet: string;
  rankingNote: string;
  prizesTitle: string;
  prizeRow: (amount: string) => string;
  prizeClaim: string;
  prizeClaiming: string;
  prizeClaimedMsg: string;
  prizeClaimError: string;
  // Ganadores del último día cerrado (tab Ranking)
  winnersTitle: string;
  winnersDay: (day: number) => string;
  winnersEmpty: string;
  noWinner: string;
  prizeClaimedLabel: string;
  // El reclamo vive solo en Perfil; desde el Ranking se enlaza allí.
  claimInProfile: string;
  play: string;
  timerHint: string;
  timeLabel: string;
  colPlayer: string;
  colRoute: string;
  colTime: string;
  // Etiqueta para quien jugó antes de que existiera el nombre de perfil.
  // Se muestra junto a la dirección truncada: "Jugador 0df8…a1c3".
  anonPlayer: string;
  rankingEmpty: string;
  feedback: (r: GuessReason, ctx: { country?: string; end: string; quality?: string; input: string }) => string;
  stats: {
    back: string;
    title: string;
    subtitle: (chain: string) => string;
    today: string;
    dayNo: (n: number) => string;
    prize: string;
    plays: string;
    players: string;
    community: string;
    since: (date: string) => string;
    daysPlayed: string;
    countries: string;
    activeMonth: string;
    retention: string;
    retentionHint: string;
    noCohort: string;
    onchain: string;
    txTotal: string;
    onchainUsers: string;
    failedRate: string;
    byAction: string;
    partialData: string;
    topCountries: string;
    last30d: string;
    economy: string;
    bothContracts: string;
    prizesPaid: string;
    daysClosed: string;
    playerFunds: string;
    playerFundsHint: string;
    protocolFees: string;
    protocolFeesHint: string;
    moneyTitle: string;
    money1: string;
    money2: (pot: string, fee: string) => string;
    money3: string;
    contractsTitle: string;
    contractInUse: string;
    contractLegacy: string;
    contractsNote: string;
    verified: string;
    unverified: string;
    sourceOpen: string;
    supportTitle: string;
    supportNote: string;
    supportEmail: string;
    footerTerms: string;
    footerPrivacy: string;
  };
};

const STRINGS: Record<Locale, Dict> = {
  es: {
    tagline: "Conecta países por sus fronteras",
    daily: "Reto del día",
    optimal: (n) => `Ruta óptima: ${n} países`,
    legend: { origin: "Origen", destination: "Destino", good: "Bien", lateral: "Lateral", far: "Lejos" },
    placeholder: "Escribe un país…",
    used: (n) => `Países usados: ${n}`,
    free: "1ª partida gratis",
    loadingMap: "Cargando mapa…",
    winPerfect: "¡Ruta perfecta! 🏆",
    winNormal: "¡Lo lograste! 🎉",
    winText: (g, o, p) =>
      p ? `Conectaste con ${g} países — la ruta óptima.` : `Conectaste con ${g} países (la óptima era ${o}).`,
    share: "Compartir resultado",
    copied: "¡Copiado!",
    comeback: "Vuelve mañana para el siguiente reto 🗓️",
    retry: "Reintentar para mejorar tu marca",
    paying: "Procesando pago…",
    payFailed: "No se pudo completar el pago. Intenta de nuevo.",
    payCancelled: "Pago cancelado.",
    payNoFunds: (a) => `Saldo insuficiente: esta compra cuesta ${a}. Recarga tu wallet para continuar.`,
    payNoGas: "Tu wallet no tiene saldo para la comisión de red. El saldo de bienvenida ya se agotó; deposita un poco para pagar pistas o reintentos.",
    footer: "Frontle · Juego diario de geografía · Hecho en Colombia",
    hintsTitle: "Pistas",
    hintInitial: "Inicial del siguiente país",
    hintSilhouetteNext: "Silueta del siguiente país",
    hintSilhouetteAll: "Silueta de todos los países",
    hintNextInitial: (l) => `El siguiente país empieza por «${l}»`,
    nextChallenge: (t) => `Nuevo reto en ${t}`,
    prize: (a) => `🏆 Premio de hoy: ${a}`,
    levelPrize: (a) => `🏅 Premio de este nivel: ${a}`,
    copmBalance: (a) => `Saldo: ${a} COP`,
    amountIn: "Ver montos en",
    noWallet: "Abre Frontle en MiniPay para pistas y reintentos.",
    connectToRank: "🔗 Conecta tu wallet para entrar al ranking",
    connectWallet: "🔗 Conectar wallet",
    connectBenefit: "Para el ranking y las pistas",
    connectToPlay: "Conéctate para jugar",
    openInMiniPay: "Conéctate con tu wallet o correo para jugar, o abre Frontle desde MiniPay.",
    emailLogin: "✉️ Entrar con correo",
    welcomeBonus: (a) => `¡Hola! Soy Bordy 👋 Te regalé ${a} de bienvenida para pistas o reintentos. ¡A jugar! 🎁`,
    bonusDismiss: "¡Gracias!",
    levels: { easy: "Fácil", medium: "Medio", hard: "Difícil" },
    chooseLevel: "Elige nivel",
    tabs: { jugar: "Jugar", ranking: "Ranking", perfil: "Perfil", aprender: "Aprender" },
    profileGuest: "Invitado",
    profileConnected: "Conectado",
    profileConnectHint: "Conéctate para el ranking",
    namePlaceholder: "Tu nombre…",
    statDays: "días jugados",
    statBestToday: "mejor hoy",
    statPrizes: "premios",
    walletBalanceTitle: "Saldo de tu wallet",
    deposit: "Depositar",
    addressCopied: "¡Dirección copiada!",
    language: "Idioma",
    audio: "Audio",
    music: "Música",
    effects: "Efectos",
    legalTerms: "Términos",
    legalPrivacy: "Privacidad",
    legalSupport: "Soporte",
    learnBubbles: [
      "¡Hola! Soy Bordy 👋 Cada día conectas el país de origen con el de destino nombrando países que compartan frontera.",
      "El semáforo te guía: verde vas por la mejor ruta, amarillo te desviaste un poco, rojo te alejaste.",
      "Menos países y menos tiempo = mejor puesto. El mejor del día se lleva el pot 🏆. El primer intento es gratis.",
    ],
    practiceSoon: "Modo práctica (próximamente)",
    practiceMode: "Modo práctica",
    practiceFree: "Práctica libre · sin premios",
    practiceHint: "Pista (gratis)",
    practiceNextRound: "Otra ronda",
    practiceExit: "Salir de práctica",
    region: {
      challengeOfDay: "Reto del día",
      timerStarts: "El cronómetro arranca al pulsar Jugar",
      chooseOtherMode: "Elegir otro modo",
      modeFooter: (t) => `Modo ${t} · gratis · vuelve mañana para un nuevo reto`,
      placeholder: (n) => `Escribe un ${n}…`,
      optimalRoute: (n, noun) => `Ruta óptima: ${n} ${noun}`,
      winText: (g, o, p, noun) => p ? `Conectaste con ${g} ${noun} — la ruta óptima.` : `Conectaste con ${g} ${noun} (la óptima era ${o}).`,
      used: (n) => `Usados: ${n}`,
      bestToday: (n, noun) => `Tu mejor hoy: ${n} ${noun}`,
      hintInitial: (noun) => `Inicial del siguiente ${noun}`,
      hintSilNext: (noun) => `Silueta del siguiente ${noun}`,
      hintSilAll: (nm) => `Silueta de todos los ${nm}`,
      hintNextInitial: (l, noun) => `El siguiente ${noun} empieza por «${l}»`,
    },
    modes: {
      dailyTitle: "Reto diario", dailySub: "3 niveles · premio real del pot 🏆",
      regionsTitle: "Regiones", regionsSub: "conecta departamentos y estados · gratis", new: "nuevo",
      play: (t) => `Jugar ${t}`, moreCountries: "más países muy pronto…",
      moreModesTitle: "Más modos", moreModesSub: "práctica, duelos y más…",
    },
    a11y: {
      country: "País", sound: "sonido",
      music: (m) => m ? "Activar música" : "Silenciar música",
      effects: (m) => m ? "Activar efectos" : "Silenciar efectos",
      zoomIn: "Acercar", zoomOut: "Alejar", recenter: "Reencuadrar", settings: "Ajustes",
    },
    name: { title: "¡Elige tu nombre!", sub: "Así apareces en el ranking (en vez de tu wallet).", save: "Guardar", skip: "Usar mi wallet" },
    walletSheet: { title: "💰 Tu wallet", connectedAs: "Conectado como", signIn: "👤 Entrar" },
    settingsSheet: { title: "⚙️ Ajustes", language: "Idioma" },
    continents: { AF: "África", EU: "Europa", AS: "Asia", NA: "Norteamérica", SA: "Sudamérica", OC: "Oceanía" },
    quiz: {
      flagTitle: "Adivina la bandera", flagSub: "¿de qué país es? · gratis",
      outlineTitle: "Adivina el país", outlineSub: "reconoce el país por su forma · gratis",
      whichCountry: "¿Qué país es?",
      hintBtn: "Pista",
      continentIn: (n) => `Está en ${n}`,
      borders: (n) => `Limita con ${n} ${n === 1 ? "país" : "países"}`,
      island: "No tiene fronteras terrestres",
      initial: (l) => `Empieza por «${l}»`,
      crossFlag: "Su bandera:", crossOutline: "Su contorno:",
      tries: (n) => `Intentos: ${n}`,
      wrong: "No es ese, ¡sigue intentando!",
      correct: (n) => `¡Correcto! Era ${n} 🎉`,
    },
    comingSoon: "coming soon",
    home: { titlePre: "Conecta el", titleWord: "mundo", streak: "racha", level: (n) => `⚡ Nivel ${n}` },
    subdivisionNoun: {
      department: { one: "departamento", many: "departamentos" },
      state: { one: "estado", many: "estados" },
      province: { one: "provincia", many: "provincias" },
      region: { one: "región", many: "regiones" },
    },
    tutorialSteps: [
      "¡Hola! Soy Bordy 👋 Tu misión: conectar el ORIGEN con el DESTINO escribiendo países vecinos. Hoy de ejemplo: Portugal → Alemania.",
      "Verde = ¡vas perfecto! España comparte frontera con Portugal y está en la ruta óptima hacia Alemania.",
      "Amarillo = desvío. Suiza te saca un poco del camino… no es grave, pero gastas países de más.",
      "Rojo = ¡te alejas! Marruecos va en dirección contraria a Alemania. Ojo con el semáforo.",
      "Francia completa la ruta ✅ Menos países y menos tiempo = mejor puesto. ¡El mejor del día se lleva el pot!",
    ],
    tutNext: "Siguiente →",
    tutPlay: "¡A jugar!",
    dontShowAgain: "No volver a mostrar",
    skipTutorial: "Saltar tutorial",
    ready: "¿Listo?",
    go: "¡YA!",
    fullTutorial: "Ver tutorial completo",
    coachSteps: [
      "Escribe aquí un país que comparta frontera con el origen (o con cualquiera revelado). Te autocompleto mientras escribes 😉",
      "💡 ¿Atascado? Compra una pista: la INICIAL del siguiente país, su SILUETA en el mapa, o todas las siluetas. Cuestan centavos y el 80% alimenta el pot del día 🏆",
      "⏱️ El cronómetro desempata: a igual número de países, gana el más rápido. Arranca cuando toques ¡Entendido! — el reto sigue oculto, así que nadie gana ventaja 😄",
    ],
    coachSkip: "Saltar",
    coachDone: "¡Entendido!",
    rankingTitle: "Ranking diario",
    bestToday: (n) => `Tu mejor marca hoy: ${n} países`,
    noScoreYet: "Aún no tienes marca hoy — ¡resuelve el reto!",
    rankingNote: "A igualdad de países, gana quien lo resuelva en menos tiempo. Al final del día el ganador se lleva el premio base + el pot (pago automático).",
    prizesTitle: "🏆 Tus premios",
    prizeRow: (amount) => `Ganaste ${amount}`,
    prizeClaim: "Reclamar",
    prizeClaiming: "Reclamando…",
    prizeClaimedMsg: "¡Premio reclamado! 🎉",
    prizeClaimError: "No se pudo reclamar. Intenta de nuevo.",
    winnersTitle: "Ganadores del ciclo anterior",
    winnersDay: (d) => `día #${d}`,
    winnersEmpty: "Todavía no se ha cerrado ningún ciclo.",
    noWinner: "Sin ganador",
    prizeClaimedLabel: "Reclamado",
    claimInProfile: "Reclamar en Perfil →",
    play: "▶ Jugar",
    timerHint: "El cronómetro arranca al pulsar Jugar",
    timeLabel: "Tiempo",
    colPlayer: "Jugador",
    anonPlayer: "Jugador",
    colRoute: "Ruta",
    colTime: "Tiempo",
    rankingEmpty: "Aún nadie ha resuelto el reto de hoy. ¡Sé el primero!",
    feedback: (r, c) =>
      r === "unknown" ? `No reconozco "${c.input}".`
      : r === "revealed" ? `${c.country} ya está en el mapa.`
      : r === "duplicate" ? `${c.country} ya está en tu ruta.`
      : r === "not_adjacent" ? `${c.country} no limita con ningún país revelado.`
      : c.quality === "green" ? `${c.country} ✓`
      : c.quality === "yellow" ? `${c.country} — vas de lado`
      : `${c.country} — te alejaste`,
    stats: {
      back: "← Volver a Frontle",
      title: "Estadísticas",
      subtitle: (chain) => `Datos leídos en vivo del contrato en ${chain}. Nadie los edita a mano.`,
      today: "Hoy",
      dayNo: (n) => `día #${n} · UTC`,
      prize: "Premio",
      plays: "Partidas",
      players: "Jugadores",
      community: "Comunidad",
      since: (d) => `desde el ${d}`,
      daysPlayed: "Días jugados",
      countries: "Países",
      activeMonth: "Activos del mes",
      retention: "Retención",
      retentionHint: "de cada cohorte que ya tuvo tiempo de volver",
      noCohort: "sin cohorte",
      onchain: "Actividad en la red",
      txTotal: "Transacciones",
      onchainUsers: "Jugadores únicos",
      failedRate: "Fallidas",
      byAction: "Por acción",
      partialData: "Cuenta las transacciones más recientes; el historial completo es mayor.",
      topCountries: "Top países",
      last30d: "últimos 30 días",
      economy: "Economía",
      bothContracts: "contratos v1 + v2",
      prizesPaid: "Premios repartidos",
      daysClosed: "Días cerrados",
      playerFunds: "Fondos de los jugadores",
      playerFundsHint: "premio de hoy + premios sin reclamar",
      protocolFees: "Comisión de plataforma",
      protocolFeesHint: "el 20% de mantenimiento, aparte del premio",
      moneyTitle: "A dónde va tu dinero",
      money1: "El primer intento de cada reto diario es gratis. Las pistas y los reintentos son compras opcionales en USDT.",
      money2: (pot, fee) =>
        `De cada compra, el ${pot} alimenta el premio del día y el ${fee} cubre el mantenimiento de la plataforma. Al cierre del día (UTC) el premio se reparte entre los mejores de cada nivel, y los ganadores lo reclaman desde la app.`,
      money3:
        "Frontle nunca custodia tus fondos: los pagos van directo de tu wallet al contrato inteligente. La comisión se contabiliza aparte y no toca el premio.",
      contractsTitle: "Los contratos",
      contractInUse: "En uso · premio por nivel",
      contractLegacy: "Histórico · ganador único",
      contractsNote:
        "El v1 ya no recibe pagos y sus premios fueron reclamados; las cifras de arriba suman los dos. Puedes auditar cada transacción en el explorador.",
      verified: "verificado",
      unverified: "sin verificar",
      sourceOpen: "Ver el código en GitHub",
      supportTitle: "Soporte",
      supportNote: "¿Algo no funciona? Escríbenos y respondemos.",
      supportEmail: "Correo",
      footerTerms: "Términos",
      footerPrivacy: "Privacidad",
    },
  },
  en: {
    tagline: "Connect countries through borders",
    daily: "Daily challenge",
    optimal: (n) => `Optimal route: ${n} countries`,
    legend: { origin: "Start", destination: "End", good: "Good", lateral: "Lateral", far: "Far" },
    placeholder: "Type a country…",
    used: (n) => `Countries used: ${n}`,
    free: "1st play free",
    loadingMap: "Loading map…",
    winPerfect: "Perfect route! 🏆",
    winNormal: "You did it! 🎉",
    winText: (g, o, p) =>
      p ? `Connected with ${g} countries — the optimal route.` : `Connected with ${g} countries (optimal was ${o}).`,
    share: "Share result",
    copied: "Copied!",
    comeback: "Come back tomorrow for the next challenge 🗓️",
    retry: "Retry to beat your score",
    paying: "Processing payment…",
    payFailed: "Payment didn't go through. Please try again.",
    payCancelled: "Payment cancelled.",
    payNoFunds: (a) => `Insufficient balance: this purchase costs ${a}. Top up your wallet to continue.`,
    payNoGas: "Your wallet has no balance left for the network fee. Your welcome balance is used up; deposit a little to pay for hints or retries.",
    footer: "Frontle · Daily geography game · Made in Colombia",
    hintsTitle: "Hints",
    hintInitial: "Next country's initial",
    hintSilhouetteNext: "Next country's silhouette",
    hintSilhouetteAll: "All countries' silhouettes",
    hintNextInitial: (l) => `The next country starts with “${l}”`,
    nextChallenge: (t) => `Next challenge in ${t}`,
    prize: (a) => `🏆 Today's prize: ${a}`,
    levelPrize: (a) => `🏅 This level's prize: ${a}`,
    copmBalance: (a) => `Balance: ${a} COP`,
    amountIn: "Show amounts in",
    noWallet: "Open Frontle in MiniPay for hints and retries.",
    connectToRank: "🔗 Connect your wallet to join the ranking",
    connectWallet: "🔗 Connect wallet",
    connectBenefit: "For the ranking and hints",
    connectToPlay: "Sign in to play",
    openInMiniPay: "Connect your wallet or email to play, or open Frontle from MiniPay.",
    emailLogin: "✉️ Sign in with email",
    welcomeBonus: (a) => `Hi! I'm Bordy 👋 Here's ${a} as a welcome gift for hints or retries. Let's play! 🎁`,
    bonusDismiss: "Thanks!",
    levels: { easy: "Easy", medium: "Medium", hard: "Hard" },
    chooseLevel: "Choose level",
    tabs: { jugar: "Play", ranking: "Ranking", perfil: "Profile", aprender: "Learn" },
    profileGuest: "Guest",
    profileConnected: "Connected",
    profileConnectHint: "Connect to join the ranking",
    namePlaceholder: "Your name…",
    statDays: "days played",
    statBestToday: "best today",
    statPrizes: "prizes",
    walletBalanceTitle: "Your wallet balance",
    deposit: "Deposit",
    addressCopied: "Address copied!",
    language: "Language",
    audio: "Audio",
    music: "Music",
    effects: "Effects",
    legalTerms: "Terms",
    legalPrivacy: "Privacy",
    legalSupport: "Support",
    learnBubbles: [
      "Hi! I'm Bordy 👋 Every day you connect the start country to the destination by naming countries that share a border.",
      "The traffic light guides you: green means you're on the best route, yellow you drifted a bit, red you went off course.",
      "Fewer countries and less time = higher rank. The day's best takes the pot 🏆. Your first try is free.",
    ],
    practiceSoon: "Practice mode (coming soon)",
    practiceMode: "Practice mode",
    practiceFree: "Free practice · no prizes",
    practiceHint: "Hint (free)",
    practiceNextRound: "Another round",
    practiceExit: "Exit practice",
    region: {
      challengeOfDay: "Daily challenge",
      timerStarts: "The timer starts when you tap Play",
      chooseOtherMode: "Choose another mode",
      modeFooter: (t) => `${t} mode · free · come back tomorrow for a new challenge`,
      placeholder: (n) => `Type a ${n}…`,
      optimalRoute: (n, noun) => `Best route: ${n} ${noun}`,
      winText: (g, o, p, noun) => p ? `Connected with ${g} ${noun} — the best route.` : `Connected with ${g} ${noun} (the best was ${o}).`,
      used: (n) => `Used: ${n}`,
      bestToday: (n, noun) => `Your best today: ${n} ${noun}`,
      hintInitial: (noun) => `Next ${noun}'s initial`,
      hintSilNext: (noun) => `Next ${noun}'s silhouette`,
      hintSilAll: (nm) => `All ${nm}' silhouettes`,
      hintNextInitial: (l, noun) => `The next ${noun} starts with “${l}”`,
    },
    modes: {
      dailyTitle: "Daily challenge", dailySub: "3 levels · real prize from the pot 🏆",
      regionsTitle: "Regions", regionsSub: "connect departments and states · free", new: "new",
      play: (t) => `Play ${t}`, moreCountries: "more countries coming soon…",
      moreModesTitle: "More modes", moreModesSub: "practice, duels and more…",
    },
    a11y: {
      country: "Country", sound: "sound",
      music: (m) => m ? "Enable music" : "Mute music",
      effects: (m) => m ? "Enable effects" : "Mute effects",
      zoomIn: "Zoom in", zoomOut: "Zoom out", recenter: "Recenter", settings: "Settings",
    },
    name: { title: "Choose your name!", sub: "This is how you appear in the ranking (instead of your wallet).", save: "Save", skip: "Use my wallet" },
    walletSheet: { title: "💰 Your wallet", connectedAs: "Connected as", signIn: "👤 Sign in" },
    settingsSheet: { title: "⚙️ Settings", language: "Language" },
    continents: { AF: "Africa", EU: "Europe", AS: "Asia", NA: "North America", SA: "South America", OC: "Oceania" },
    quiz: {
      flagTitle: "Guess the flag", flagSub: "which country is it? · free",
      outlineTitle: "Guess the country", outlineSub: "recognize the country by its shape · free",
      whichCountry: "Which country is it?",
      hintBtn: "Hint",
      continentIn: (n) => `It's in ${n}`,
      borders: (n) => `Borders ${n} ${n === 1 ? "country" : "countries"}`,
      island: "It has no land borders",
      initial: (l) => `Starts with “${l}”`,
      crossFlag: "Its flag:", crossOutline: "Its outline:",
      tries: (n) => `Tries: ${n}`,
      wrong: "Not that one, keep trying!",
      correct: (n) => `Correct! It was ${n} 🎉`,
    },
    comingSoon: "coming soon",
    home: { titlePre: "Connect the", titleWord: "world", streak: "streak", level: (n) => `⚡ Level ${n}` },
    subdivisionNoun: {
      department: { one: "department", many: "departments" },
      state: { one: "state", many: "states" },
      province: { one: "province", many: "provinces" },
      region: { one: "region", many: "regions" },
    },
    tutorialSteps: [
      "Hi! I'm Bordy 👋 Your mission: connect the START with the DESTINATION by typing neighboring countries. Today's example: Portugal → Germany.",
      "Green = perfect! Spain shares a border with Portugal and is on the optimal route to Germany.",
      "Yellow = detour. Switzerland takes you a bit off track… not a big deal, but you spend extra countries.",
      "Red = you're drifting away! Morocco goes in the opposite direction from Germany. Watch the traffic light.",
      "France completes the route ✅ Fewer countries and less time = higher rank. The day's best takes the pot!",
    ],
    tutNext: "Next →",
    tutPlay: "Let's play!",
    dontShowAgain: "Don't show this again",
    skipTutorial: "Skip tutorial",
    ready: "Ready?",
    go: "GO!",
    fullTutorial: "See the full tutorial",
    coachSteps: [
      "Type a country here that shares a border with the start (or with any revealed country). I'll autocomplete as you type 😉",
      "💡 Stuck? Buy a hint: the next country's INITIAL, its SILHOUETTE on the map, or all the silhouettes. They cost cents and 80% feeds the day's pot 🏆",
      "⏱️ The timer breaks ties: with the same number of countries, the fastest wins. It starts when you tap Got it! — the challenge stays hidden, so nobody gets an edge 😄",
    ],
    coachSkip: "Skip",
    coachDone: "Got it!",
    rankingTitle: "Daily ranking",
    bestToday: (n) => `Your best today: ${n} countries`,
    noScoreYet: "No score yet today — solve the challenge!",
    rankingNote: "On a tie in countries, the fastest time wins. At the end of the day the winner takes the base prize + the pot (paid out automatically).",
    prizesTitle: "🏆 Your prizes",
    prizeRow: (amount) => `You won ${amount}`,
    prizeClaim: "Claim",
    prizeClaiming: "Claiming…",
    prizeClaimedMsg: "Prize claimed! 🎉",
    prizeClaimError: "Couldn't claim. Try again.",
    winnersTitle: "Last cycle winners",
    winnersDay: (d) => `day #${d}`,
    winnersEmpty: "No cycle has closed yet.",
    noWinner: "No winner",
    prizeClaimedLabel: "Claimed",
    claimInProfile: "Claim in Profile →",
    play: "▶ Play",
    timerHint: "The timer starts when you press Play",
    timeLabel: "Time",
    colPlayer: "Player",
    anonPlayer: "Player",
    colRoute: "Route",
    colTime: "Time",
    rankingEmpty: "Nobody has solved today's challenge yet. Be the first!",
    feedback: (r, c) =>
      r === "unknown" ? `I don't recognize "${c.input}".`
      : r === "revealed" ? `${c.country} is already on the map.`
      : r === "duplicate" ? `${c.country} is already in your route.`
      : r === "not_adjacent" ? `${c.country} doesn't border any revealed country.`
      : c.quality === "green" ? `${c.country} ✓`
      : c.quality === "yellow" ? `${c.country} — sideways`
      : `${c.country} — you drifted away`,
    stats: {
      back: "← Back to Frontle",
      title: "Stats",
      subtitle: (chain) => `Read live from the contract on ${chain}. Nobody edits these by hand.`,
      today: "Today",
      dayNo: (n) => `day #${n} · UTC`,
      prize: "Prize",
      plays: "Plays",
      players: "Players",
      community: "Community",
      since: (d) => `since ${d}`,
      daysPlayed: "Days played",
      countries: "Countries",
      activeMonth: "Monthly active",
      retention: "Retention",
      retentionHint: "of each cohort that has had time to come back",
      noCohort: "no cohort",
      onchain: "Network activity",
      txTotal: "Transactions",
      onchainUsers: "Unique players",
      failedRate: "Failed",
      byAction: "By action",
      partialData: "Counts the most recent transactions; the full history is larger.",
      topCountries: "Top countries",
      last30d: "last 30 days",
      economy: "Economy",
      bothContracts: "contracts v1 + v2",
      prizesPaid: "Prizes paid out",
      daysClosed: "Days closed",
      playerFunds: "Player funds",
      playerFundsHint: "today's prize + unclaimed prizes",
      protocolFees: "Platform fee",
      protocolFeesHint: "the 20% for upkeep, kept apart from the prize",
      moneyTitle: "Where your money goes",
      money1: "The first attempt at each daily challenge is free. Hints and retries are optional purchases in USDT.",
      money2: (pot, fee) =>
        `Of every purchase, ${pot} feeds the day's prize and ${fee} covers platform upkeep. When the day closes (UTC) the prize is split among the best of each level, and winners claim it from the app.`,
      money3:
        "Frontle never holds your funds: payments go straight from your wallet to the smart contract. The fee is accounted for separately and never touches the prize.",
      contractsTitle: "The contracts",
      contractInUse: "In use · prize per level",
      contractLegacy: "Historical · single winner",
      contractsNote:
        "v1 no longer takes payments and its prizes were all claimed; the figures above add up both. You can audit every transaction on the explorer.",
      verified: "verified",
      unverified: "unverified",
      sourceOpen: "See the code on GitHub",
      supportTitle: "Support",
      supportNote: "Something broken? Write to us and we'll answer.",
      supportEmail: "Email",
      footerTerms: "Terms",
      footerPrivacy: "Privacy",
    },
  },
  pt: {
    tagline: "Conecte países pelas fronteiras",
    daily: "Desafio do dia",
    optimal: (n) => `Rota ótima: ${n} países`,
    legend: { origin: "Origem", destination: "Destino", good: "Bom", lateral: "Lateral", far: "Longe" },
    placeholder: "Digite um país…",
    used: (n) => `Países usados: ${n}`,
    free: "1ª partida grátis",
    loadingMap: "Carregando mapa…",
    winPerfect: "Rota perfeita! 🏆",
    winNormal: "Você conseguiu! 🎉",
    winText: (g, o, p) =>
      p ? `Conectou com ${g} países — a rota ótima.` : `Conectou com ${g} países (a ótima era ${o}).`,
    share: "Compartilhar resultado",
    copied: "Copiado!",
    comeback: "Volte amanhã para o próximo desafio 🗓️",
    retry: "Tentar de novo para melhorar sua marca",
    paying: "Processando pagamento…",
    payFailed: "O pagamento não foi concluído. Tente de novo.",
    payCancelled: "Pagamento cancelado.",
    payNoFunds: (a) => `Saldo insuficiente: esta compra custa ${a}. Recarregue sua carteira para continuar.`,
    payNoGas: "Sua carteira não tem saldo para a taxa de rede. O saldo de boas-vindas acabou; deposite um pouco para pagar dicas ou novas tentativas.",
    footer: "Frontle · Jogo diário de geografia · Feito na Colômbia",
    hintsTitle: "Dicas",
    hintInitial: "Inicial do próximo país",
    hintSilhouetteNext: "Silhueta do próximo país",
    hintSilhouetteAll: "Silhueta de todos os países",
    hintNextInitial: (l) => `O próximo país começa com “${l}”`,
    nextChallenge: (t) => `Próximo desafio em ${t}`,
    prize: (a) => `🏆 Prêmio de hoje: ${a}`,
    levelPrize: (a) => `🏅 Prêmio deste nível: ${a}`,
    copmBalance: (a) => `Saldo: ${a} COP`,
    amountIn: "Ver valores em",
    noWallet: "Abra o Frontle no MiniPay para dicas e novas tentativas.",
    connectToRank: "🔗 Conecte sua wallet para entrar no ranking",
    connectWallet: "🔗 Conectar wallet",
    connectBenefit: "Para o ranking e as dicas",
    connectToPlay: "Entre para jogar",
    openInMiniPay: "Conecte sua wallet ou e-mail para jogar, ou abra o Frontle no MiniPay.",
    emailLogin: "✉️ Entrar com e-mail",
    welcomeBonus: (a) => `Oi! Sou o Bordy 👋 Ganhou ${a} de boas-vindas para dicas ou novas tentativas. Bora jogar! 🎁`,
    bonusDismiss: "Obrigado!",
    levels: { easy: "Fácil", medium: "Médio", hard: "Difícil" },
    chooseLevel: "Escolha o nível",
    tabs: { jugar: "Jogar", ranking: "Ranking", perfil: "Perfil", aprender: "Aprender" },
    profileGuest: "Convidado",
    profileConnected: "Conectado",
    profileConnectHint: "Conecte-se para o ranking",
    namePlaceholder: "Seu nome…",
    statDays: "dias jogados",
    statBestToday: "melhor hoje",
    statPrizes: "prêmios",
    walletBalanceTitle: "Saldo da sua carteira",
    deposit: "Depositar",
    addressCopied: "Endereço copiado!",
    language: "Idioma",
    audio: "Áudio",
    music: "Música",
    effects: "Efeitos",
    legalTerms: "Termos",
    legalPrivacy: "Privacidade",
    legalSupport: "Suporte",
    learnBubbles: [
      "Olá! Eu sou o Bordy 👋 Cada dia você conecta o país de origem ao de destino nomeando países que compartilham fronteira.",
      "O semáforo te guia: verde você está na melhor rota, amarelo desviou um pouco, vermelho se afastou.",
      "Menos países e menos tempo = melhor posição. O melhor do dia leva o pot 🏆. A primeira tentativa é grátis.",
    ],
    practiceSoon: "Modo prática (em breve)",
    practiceMode: "Modo prática",
    practiceFree: "Prática livre · sem prêmios",
    practiceHint: "Dica (grátis)",
    practiceNextRound: "Outra rodada",
    practiceExit: "Sair da prática",
    region: {
      challengeOfDay: "Desafio do dia",
      timerStarts: "O cronômetro começa ao tocar em Jogar",
      chooseOtherMode: "Escolher outro modo",
      modeFooter: (t) => `Modo ${t} · grátis · volte amanhã para um novo desafio`,
      placeholder: (n) => `Digite um ${n}…`,
      optimalRoute: (n, noun) => `Rota ótima: ${n} ${noun}`,
      winText: (g, o, p, noun) => p ? `Você conectou com ${g} ${noun} — a rota ótima.` : `Você conectou com ${g} ${noun} (a ótima era ${o}).`,
      used: (n) => `Usados: ${n}`,
      bestToday: (n, noun) => `Sua melhor hoje: ${n} ${noun}`,
      hintInitial: (noun) => `Inicial do próximo ${noun}`,
      hintSilNext: (noun) => `Silhueta do próximo ${noun}`,
      hintSilAll: (nm) => `Silhueta de todos os ${nm}`,
      hintNextInitial: (l, noun) => `O próximo ${noun} começa com “${l}”`,
    },
    modes: {
      dailyTitle: "Desafio diário", dailySub: "3 níveis · prêmio real do pot 🏆",
      regionsTitle: "Regiões", regionsSub: "conecte departamentos e estados · grátis", new: "novo",
      play: (t) => `Jogar ${t}`, moreCountries: "mais países em breve…",
      moreModesTitle: "Mais modos", moreModesSub: "prática, duelos e mais…",
    },
    a11y: {
      country: "País", sound: "som",
      music: (m) => m ? "Ativar música" : "Silenciar música",
      effects: (m) => m ? "Ativar efeitos" : "Silenciar efeitos",
      zoomIn: "Aproximar", zoomOut: "Afastar", recenter: "Reenquadrar", settings: "Ajustes",
    },
    name: { title: "Escolha seu nome!", sub: "É assim que você aparece no ranking (em vez da sua carteira).", save: "Salvar", skip: "Usar minha carteira" },
    walletSheet: { title: "💰 Sua carteira", connectedAs: "Conectado como", signIn: "👤 Entrar" },
    settingsSheet: { title: "⚙️ Ajustes", language: "Idioma" },
    continents: { AF: "África", EU: "Europa", AS: "Ásia", NA: "América do Norte", SA: "América do Sul", OC: "Oceania" },
    quiz: {
      flagTitle: "Adivinhe a bandeira", flagSub: "de que país é? · grátis",
      outlineTitle: "Adivinhe o país", outlineSub: "reconheça o país pela forma · grátis",
      whichCountry: "Que país é?",
      hintBtn: "Dica",
      continentIn: (n) => `Fica na ${n}`,
      borders: (n) => `Faz fronteira com ${n} ${n === 1 ? "país" : "países"}`,
      island: "Não tem fronteiras terrestres",
      initial: (l) => `Começa com “${l}”`,
      crossFlag: "Sua bandeira:", crossOutline: "Seu contorno:",
      tries: (n) => `Tentativas: ${n}`,
      wrong: "Não é esse, continue tentando!",
      correct: (n) => `Correto! Era ${n} 🎉`,
    },
    comingSoon: "em breve",
    home: { titlePre: "Conecte o", titleWord: "mundo", streak: "sequência", level: (n) => `⚡ Nível ${n}` },
    subdivisionNoun: {
      department: { one: "departamento", many: "departamentos" },
      state: { one: "estado", many: "estados" },
      province: { one: "província", many: "províncias" },
      region: { one: "região", many: "regiões" },
    },
    tutorialSteps: [
      "Olá! Eu sou o Bordy 👋 Sua missão: conectar a ORIGEM com o DESTINO escrevendo países vizinhos. Exemplo de hoje: Portugal → Alemanha.",
      "Verde = perfeito! A Espanha faz fronteira com Portugal e está na rota ótima para a Alemanha.",
      "Amarelo = desvio. A Suíça te tira um pouco do caminho… não é grave, mas você gasta países a mais.",
      "Vermelho = você está se afastando! O Marrocos vai na direção contrária à Alemanha. Olho no semáforo.",
      "A França completa a rota ✅ Menos países e menos tempo = melhor posição. O melhor do dia leva o pot!",
    ],
    tutNext: "Próximo →",
    tutPlay: "Vamos jogar!",
    dontShowAgain: "Não mostrar de novo",
    skipTutorial: "Pular tutorial",
    ready: "Pronto?",
    go: "JÁ!",
    fullTutorial: "Ver o tutorial completo",
    coachSteps: [
      "Escreva aqui um país que faça fronteira com a origem (ou com qualquer país revelado). Eu autocompleto enquanto você digita 😉",
      "💡 Travou? Compre uma dica: a INICIAL do próximo país, sua SILHUETA no mapa, ou todas as silhuetas. Custam centavos e 80% alimenta o pot do dia 🏆",
      "⏱️ O cronômetro desempata: com o mesmo número de países, ganha o mais rápido. Ele começa quando você tocar em Entendi! — o desafio segue oculto, então ninguém ganha vantagem 😄",
    ],
    coachSkip: "Pular",
    coachDone: "Entendi!",
    rankingTitle: "Ranking diário",
    bestToday: (n) => `Sua melhor marca hoje: ${n} países`,
    noScoreYet: "Ainda sem marca hoje — resolva o desafio!",
    rankingNote: "Em caso de empate em países, vence quem fizer no menor tempo. No fim do dia o vencedor leva o prêmio base + o pot (pagamento automático).",
    prizesTitle: "🏆 Seus prêmios",
    prizeRow: (amount) => `Você ganhou ${amount}`,
    prizeClaim: "Resgatar",
    prizeClaiming: "Resgatando…",
    prizeClaimedMsg: "Prêmio resgatado! 🎉",
    prizeClaimError: "Não foi possível resgatar. Tente novamente.",
    winnersTitle: "Vencedores do ciclo anterior",
    winnersDay: (d) => `dia #${d}`,
    winnersEmpty: "Nenhum ciclo foi encerrado ainda.",
    noWinner: "Sem vencedor",
    prizeClaimedLabel: "Resgatado",
    claimInProfile: "Resgatar no Perfil →",
    play: "▶ Jogar",
    timerHint: "O cronômetro começa ao tocar em Jogar",
    timeLabel: "Tempo",
    colPlayer: "Jogador",
    anonPlayer: "Jogador",
    colRoute: "Rota",
    colTime: "Tempo",
    rankingEmpty: "Ninguém resolveu o desafio de hoje ainda. Seja o primeiro!",
    feedback: (r, c) =>
      r === "unknown" ? `Não reconheço "${c.input}".`
      : r === "revealed" ? `${c.country} já está no mapa.`
      : r === "duplicate" ? `${c.country} já está na sua rota.`
      : r === "not_adjacent" ? `${c.country} não faz fronteira com nenhum país revelado.`
      : c.quality === "green" ? `${c.country} ✓`
      : c.quality === "yellow" ? `${c.country} — de lado`
      : `${c.country} — você se afastou`,
    stats: {
      back: "← Voltar ao Frontle",
      title: "Estatísticas",
      subtitle: (chain) => `Dados lidos ao vivo do contrato na ${chain}. Ninguém os edita à mão.`,
      today: "Hoje",
      dayNo: (n) => `dia #${n} · UTC`,
      prize: "Prêmio",
      plays: "Partidas",
      players: "Jogadores",
      community: "Comunidade",
      since: (d) => `desde ${d}`,
      daysPlayed: "Dias jogados",
      countries: "Países",
      activeMonth: "Ativos do mês",
      retention: "Retenção",
      retentionHint: "de cada coorte que já teve tempo de voltar",
      noCohort: "sem coorte",
      onchain: "Atividade na rede",
      txTotal: "Transações",
      onchainUsers: "Jogadores únicos",
      failedRate: "Falhas",
      byAction: "Por ação",
      partialData: "Conta as transações mais recentes; o histórico completo é maior.",
      topCountries: "Top países",
      last30d: "últimos 30 dias",
      economy: "Economia",
      bothContracts: "contratos v1 + v2",
      prizesPaid: "Prêmios distribuídos",
      daysClosed: "Dias encerrados",
      playerFunds: "Fundos dos jogadores",
      playerFundsHint: "prêmio de hoje + prêmios não resgatados",
      protocolFees: "Taxa da plataforma",
      protocolFeesHint: "os 20% de manutenção, à parte do prêmio",
      moneyTitle: "Para onde vai seu dinheiro",
      money1: "A primeira tentativa de cada desafio diário é grátis. Dicas e novas tentativas são compras opcionais em USDT.",
      money2: (pot, fee) =>
        `De cada compra, ${pot} alimenta o prêmio do dia e ${fee} cobre a manutenção da plataforma. Ao encerrar o dia (UTC) o prêmio é dividido entre os melhores de cada nível, e os vencedores o resgatam pelo app.`,
      money3:
        "O Frontle nunca guarda seus fundos: os pagamentos vão direto da sua carteira para o contrato inteligente. A taxa é contabilizada à parte e não toca no prêmio.",
      contractsTitle: "Os contratos",
      contractInUse: "Em uso · prêmio por nível",
      contractLegacy: "Histórico · vencedor único",
      contractsNote:
        "O v1 já não recebe pagamentos e seus prêmios foram resgatados; os números acima somam os dois. Você pode auditar cada transação no explorador.",
      verified: "verificado",
      unverified: "não verificado",
      sourceOpen: "Ver o código no GitHub",
      supportTitle: "Suporte",
      supportNote: "Algo não funciona? Escreva para nós e respondemos.",
      supportEmail: "E-mail",
      footerTerms: "Termos",
      footerPrivacy: "Privacidade",
    },
  },
  fr: {
    tagline: "Reliez les pays par leurs frontières",
    daily: "Défi du jour",
    optimal: (n) => `Route optimale : ${n} pays`,
    legend: { origin: "Départ", destination: "Arrivée", good: "Bien", lateral: "Latéral", far: "Loin" },
    placeholder: "Tapez un pays…",
    used: (n) => `Pays utilisés : ${n}`,
    free: "1re partie gratuite",
    loadingMap: "Chargement de la carte…",
    winPerfect: "Route parfaite ! 🏆",
    winNormal: "Réussi ! 🎉",
    winText: (g, o, p) =>
      p ? `Relié avec ${g} pays — la route optimale.` : `Relié avec ${g} pays (l'optimale était ${o}).`,
    share: "Partager le résultat",
    copied: "Copié !",
    comeback: "Revenez demain pour le prochain défi 🗓️",
    retry: "Réessayer pour battre votre score",
    paying: "Paiement en cours…",
    payFailed: "Le paiement n'a pas abouti. Réessayez.",
    payCancelled: "Paiement annulé.",
    payNoFunds: (a) => `Solde insuffisant : cet achat coûte ${a}. Rechargez votre portefeuille pour continuer.`,
    payNoGas: "Votre portefeuille n'a plus de solde pour les frais de réseau. Le solde de bienvenue est épuisé ; déposez un peu pour payer des indices ou des essais.",
    footer: "Frontle · Jeu de géographie quotidien · Fait en Colombie",
    hintsTitle: "Indices",
    hintInitial: "Initiale du pays suivant",
    hintSilhouetteNext: "Silhouette du pays suivant",
    hintSilhouetteAll: "Silhouette de tous les pays",
    hintNextInitial: (l) => `Le pays suivant commence par « ${l} »`,
    nextChallenge: (t) => `Prochain défi dans ${t}`,
    prize: (a) => `🏆 Prix du jour : ${a}`,
    levelPrize: (a) => `🏅 Prix de ce niveau : ${a}`,
    copmBalance: (a) => `Solde : ${a} COP`,
    amountIn: "Afficher les montants en",
    noWallet: "Ouvrez Frontle dans MiniPay pour les indices et les essais.",
    connectToRank: "🔗 Connectez votre wallet pour rejoindre le classement",
    connectWallet: "🔗 Connecter wallet",
    connectBenefit: "Pour le classement et les indices",
    connectToPlay: "Connecte-toi pour jouer",
    openInMiniPay: "Connecte ton wallet ou e-mail pour jouer, ou ouvre Frontle depuis MiniPay.",
    emailLogin: "✉️ Se connecter par e-mail",
    welcomeBonus: (a) => `Salut ! Je suis Bordy 👋 Voici ${a} de bienvenue pour des indices ou des essais. On joue ! 🎁`,
    bonusDismiss: "Merci !",
    levels: { easy: "Facile", medium: "Moyen", hard: "Difficile" },
    chooseLevel: "Choisir le niveau",
    tabs: { jugar: "Jouer", ranking: "Classement", perfil: "Profil", aprender: "Apprendre" },
    profileGuest: "Invité",
    profileConnected: "Connecté",
    profileConnectHint: "Connectez-vous pour le classement",
    namePlaceholder: "Votre nom…",
    statDays: "jours joués",
    statBestToday: "meilleur du jour",
    statPrizes: "prix",
    walletBalanceTitle: "Solde de votre portefeuille",
    deposit: "Déposer",
    addressCopied: "Adresse copiée !",
    language: "Langue",
    audio: "Audio",
    music: "Musique",
    effects: "Effets",
    legalTerms: "Conditions",
    legalPrivacy: "Confidentialité",
    legalSupport: "Support",
    learnBubbles: [
      "Salut ! Je suis Bordy 👋 Chaque jour, tu relies le pays de départ au pays d'arrivée en nommant des pays qui partagent une frontière.",
      "Le feu tricolore te guide : vert tu es sur la meilleure route, jaune tu t'es un peu écarté, rouge tu t'éloignes.",
      "Moins de pays et moins de temps = meilleur classement. Le meilleur du jour remporte le pot 🏆. Le premier essai est gratuit.",
    ],
    practiceSoon: "Mode entraînement (bientôt)",
    practiceMode: "Mode entraînement",
    practiceFree: "Entraînement libre · sans prix",
    practiceHint: "Indice (gratuit)",
    practiceNextRound: "Autre manche",
    practiceExit: "Quitter l'entraînement",
    region: {
      challengeOfDay: "Défi du jour",
      timerStarts: "Le chrono démarre en appuyant sur Jouer",
      chooseOtherMode: "Choisir un autre mode",
      modeFooter: (t) => `Mode ${t} · gratuit · reviens demain pour un nouveau défi`,
      placeholder: (n) => `Entrez un ${n}…`,
      optimalRoute: (n, noun) => `Route optimale : ${n} ${noun}`,
      winText: (g, o, p, noun) => p ? `Vous avez relié avec ${g} ${noun} — la route optimale.` : `Vous avez relié avec ${g} ${noun} (l'optimale était ${o}).`,
      used: (n) => `Utilisés : ${n}`,
      bestToday: (n, noun) => `Votre meilleur aujourd'hui : ${n} ${noun}`,
      hintInitial: (noun) => `Initiale du prochain ${noun}`,
      hintSilNext: (noun) => `Silhouette du prochain ${noun}`,
      hintSilAll: (nm) => `Silhouette de tous les ${nm}`,
      hintNextInitial: (l, noun) => `Le prochain ${noun} commence par « ${l} »`,
    },
    modes: {
      dailyTitle: "Défi quotidien", dailySub: "3 niveaux · vrai prix de la cagnotte 🏆",
      regionsTitle: "Régions", regionsSub: "reliez départements et états · gratuit", new: "nouveau",
      play: (t) => `Jouer ${t}`, moreCountries: "plus de pays bientôt…",
      moreModesTitle: "Plus de modes", moreModesSub: "entraînement, duels et plus…",
    },
    a11y: {
      country: "Pays", sound: "son",
      music: (m) => m ? "Activer la musique" : "Couper la musique",
      effects: (m) => m ? "Activer les effets" : "Couper les effets",
      zoomIn: "Zoom avant", zoomOut: "Zoom arrière", recenter: "Recadrer", settings: "Réglages",
    },
    name: { title: "Choisis ton nom !", sub: "C'est ainsi que tu apparais dans le classement (au lieu de ton portefeuille).", save: "Enregistrer", skip: "Utiliser mon portefeuille" },
    walletSheet: { title: "💰 Ton portefeuille", connectedAs: "Connecté en tant que", signIn: "👤 Se connecter" },
    settingsSheet: { title: "⚙️ Réglages", language: "Langue" },
    continents: { AF: "Afrique", EU: "Europe", AS: "Asie", NA: "Amérique du Nord", SA: "Amérique du Sud", OC: "Océanie" },
    quiz: {
      flagTitle: "Devine le drapeau", flagSub: "de quel pays est-il ? · gratuit",
      outlineTitle: "Devine le pays", outlineSub: "reconnais le pays à sa forme · gratuit",
      whichCountry: "Quel pays est-ce ?",
      hintBtn: "Indice",
      continentIn: (n) => `C'est en ${n}`,
      borders: (n) => `Frontalier de ${n} pays`,
      island: "Sans frontières terrestres",
      initial: (l) => `Commence par « ${l} »`,
      crossFlag: "Son drapeau :", crossOutline: "Son contour :",
      tries: (n) => `Essais : ${n}`,
      wrong: "Ce n'est pas ça, continue !",
      correct: (n) => `Correct ! C'était ${n} 🎉`,
    },
    comingSoon: "bientôt",
    home: { titlePre: "Relie le", titleWord: "monde", streak: "série", level: (n) => `⚡ Niveau ${n}` },
    subdivisionNoun: {
      department: { one: "département", many: "départements" },
      state: { one: "état", many: "états" },
      province: { one: "province", many: "provinces" },
      region: { one: "région", many: "régions" },
    },
    tutorialSteps: [
      "Salut ! Je suis Bordy 👋 Ta mission : relier le DÉPART à l'ARRIVÉE en écrivant des pays voisins. Exemple du jour : Portugal → Allemagne.",
      "Vert = parfait ! L'Espagne partage une frontière avec le Portugal et se trouve sur la route optimale vers l'Allemagne.",
      "Jaune = détour. La Suisse t'écarte un peu du chemin… pas grave, mais tu dépenses des pays en plus.",
      "Rouge = tu t'éloignes ! Le Maroc va dans la direction opposée à l'Allemagne. Attention au feu tricolore.",
      "La France complète la route ✅ Moins de pays et moins de temps = meilleur classement. Le meilleur du jour remporte le pot !",
    ],
    tutNext: "Suivant →",
    tutPlay: "C'est parti !",
    dontShowAgain: "Ne plus afficher",
    skipTutorial: "Passer le tutoriel",
    ready: "Prêt ?",
    go: "GO !",
    fullTutorial: "Voir le tutoriel complet",
    coachSteps: [
      "Écris ici un pays qui partage une frontière avec le départ (ou avec un pays déjà révélé). Je complète pendant que tu écris 😉",
      "💡 Bloqué ? Achète un indice : l'INITIALE du pays suivant, sa SILHOUETTE sur la carte, ou toutes les silhouettes. Quelques centimes, et 80 % alimentent le pot du jour 🏆",
      "⏱️ Le chrono départage : à nombre de pays égal, le plus rapide gagne. Il démarre quand tu touches Compris ! — le défi reste caché, donc personne n'est avantagé 😄",
    ],
    coachSkip: "Passer",
    coachDone: "Compris !",
    rankingTitle: "Classement du jour",
    bestToday: (n) => `Votre meilleur score aujourd'hui : ${n} pays`,
    noScoreYet: "Pas encore de score aujourd'hui — résolvez le défi !",
    rankingNote: "À égalité de pays, le temps le plus court gagne. En fin de journée le gagnant remporte le prix de base + la cagnotte (paiement automatique).",
    prizesTitle: "🏆 Vos prix",
    prizeRow: (amount) => `Vous avez gagné ${amount}`,
    prizeClaim: "Réclamer",
    prizeClaiming: "Réclamation…",
    prizeClaimedMsg: "Prix réclamé ! 🎉",
    prizeClaimError: "Échec de la réclamation. Réessayez.",
    winnersTitle: "Gagnants du cycle précédent",
    winnersDay: (d) => `jour n°${d}`,
    winnersEmpty: "Aucun cycle n'est encore clôturé.",
    noWinner: "Pas de gagnant",
    prizeClaimedLabel: "Réclamé",
    claimInProfile: "Réclamer dans Profil →",
    play: "▶ Jouer",
    timerHint: "Le chrono démarre quand vous appuyez sur Jouer",
    timeLabel: "Temps",
    colPlayer: "Joueur",
    anonPlayer: "Joueur",
    colRoute: "Itinéraire",
    colTime: "Temps",
    rankingEmpty: "Personne n'a encore résolu le défi du jour. Soyez le premier !",
    feedback: (r, c) =>
      r === "unknown" ? `Je ne reconnais pas "${c.input}".`
      : r === "revealed" ? `${c.country} est déjà sur la carte.`
      : r === "duplicate" ? `${c.country} est déjà dans votre route.`
      : r === "not_adjacent" ? `${c.country} ne touche aucun pays révélé.`
      : c.quality === "green" ? `${c.country} ✓`
      : c.quality === "yellow" ? `${c.country} — de côté`
      : `${c.country} — vous vous êtes éloigné`,
    stats: {
      back: "← Retour à Frontle",
      title: "Statistiques",
      subtitle: (chain) => `Données lues en direct du contrat sur ${chain}. Personne ne les modifie à la main.`,
      today: "Aujourd'hui",
      dayNo: (n) => `jour n°${n} · UTC`,
      prize: "Cagnotte",
      plays: "Parties",
      players: "Joueurs",
      community: "Communauté",
      since: (d) => `depuis le ${d}`,
      daysPlayed: "Jours joués",
      countries: "Pays",
      activeMonth: "Actifs du mois",
      retention: "Rétention",
      retentionHint: "de chaque cohorte ayant eu le temps de revenir",
      noCohort: "pas de cohorte",
      onchain: "Activité réseau",
      txTotal: "Transactions",
      onchainUsers: "Joueurs uniques",
      failedRate: "Échouées",
      byAction: "Par action",
      partialData: "Compte les transactions les plus récentes ; l'historique complet est plus grand.",
      topCountries: "Top pays",
      last30d: "30 derniers jours",
      economy: "Économie",
      bothContracts: "contrats v1 + v2",
      prizesPaid: "Gains distribués",
      daysClosed: "Jours clôturés",
      playerFunds: "Fonds des joueurs",
      playerFundsHint: "cagnotte du jour + gains non réclamés",
      protocolFees: "Commission de la plateforme",
      protocolFeesHint: "les 20 % d'entretien, à part de la cagnotte",
      moneyTitle: "Où va votre argent",
      money1: "Le premier essai de chaque défi quotidien est gratuit. Les indices et les essais supplémentaires sont des achats optionnels en USDT.",
      money2: (pot, fee) =>
        `Sur chaque achat, ${pot} alimente la cagnotte du jour et ${fee} couvre l'entretien de la plateforme. À la clôture du jour (UTC) la cagnotte est partagée entre les meilleurs de chaque niveau, et les gagnants la réclament depuis l'app.`,
      money3:
        "Frontle ne détient jamais vos fonds : les paiements vont directement de votre portefeuille au contrat intelligent. La commission est comptabilisée à part et ne touche pas la cagnotte.",
      contractsTitle: "Les contrats",
      contractInUse: "En service · gain par niveau",
      contractLegacy: "Historique · gagnant unique",
      contractsNote:
        "Le v1 ne reçoit plus de paiements et ses gains ont tous été réclamés ; les chiffres ci-dessus additionnent les deux. Vous pouvez auditer chaque transaction sur l'explorateur.",
      verified: "vérifié",
      unverified: "non vérifié",
      sourceOpen: "Voir le code sur GitHub",
      supportTitle: "Assistance",
      supportNote: "Un problème ? Écrivez-nous, nous répondons.",
      supportEmail: "E-mail",
      footerTerms: "Conditions",
      footerPrivacy: "Confidentialité",
    },
  },
};

export function t(locale: Locale): Dict {
  return STRINGS[locale] ?? STRINGS.en;
}
