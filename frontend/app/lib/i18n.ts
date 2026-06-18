// ============================================================
//  Frontle — Internacionalización
//  Idiomas de los mercados principales de Celo/MiniPay:
//   ES (Colombia) · EN (Nigeria, Kenia, Ghana, Sudáfrica, Filipinas)
//   PT (Brasil) · FR (África francófona)
//  Los nombres de países se traducen con Intl.DisplayNames (nativo),
//  derivando el código ISO desde la bandera — sin traducir a mano.
// ============================================================

import { COUNTRY_NAMES, getCountry } from "./countries";
import { normalize, resolveCountry, type GuessReason } from "./game";

export type Locale = "es" | "en" | "fr" | "pt";
export const LOCALES: Locale[] = ["es", "en", "fr", "pt"];

export function detectLocale(): Locale {
  if (typeof navigator === "undefined") return "es";
  const lang = (navigator.language || "es").slice(0, 2).toLowerCase();
  return (LOCALES as string[]).includes(lang) ? (lang as Locale) : "en";
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
  const c = getCountry(canonical);
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

// --- Resolución de input en cualquier idioma ---
const LOCALIZED_INDEX: Record<string, string> = (() => {
  const idx: Record<string, string> = {};
  for (const canonical of COUNTRY_NAMES) {
    idx[normalize(canonical)] = canonical;
    for (const loc of LOCALES) {
      idx[normalize(countryName(canonical, loc))] = canonical;
    }
  }
  return idx;
})();

export function resolveLocalized(input: string): string | null {
  return LOCALIZED_INDEX[normalize(input)] ?? resolveCountry(input);
}

export function suggestLocalized(input: string, locale: Locale, limit = 6): string[] {
  const q = normalize(input);
  if (!q) return [];
  const starts: string[] = [];
  const contains: string[] = [];
  for (const canonical of COUNTRY_NAMES) {
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
  footer: string;
  hintsTitle: string;
  hintInitial: string;
  hintSilhouetteNext: string;
  hintSilhouetteAll: string;
  hintNextInitial: (letter: string) => string;
  nextChallenge: (time: string) => string;
  prize: (amount: string) => string;
  rankingTitle: string;
  bestToday: (n: number) => string;
  noScoreYet: string;
  rankingNote: string;
  feedback: (r: GuessReason, ctx: { country?: string; end: string; quality?: string; input: string }) => string;
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
    footer: "Frontle · Hackathon de Agentes Onchain · Celo Colombia",
    hintsTitle: "Pistas",
    hintInitial: "Inicial del siguiente país",
    hintSilhouetteNext: "Silueta del siguiente país",
    hintSilhouetteAll: "Silueta de todos los países",
    hintNextInitial: (l) => `El siguiente país empieza por «${l}»`,
    nextChallenge: (t) => `Nuevo reto en ${t}`,
    prize: (a) => `🏆 Premio de hoy: ${a} USDT`,
    rankingTitle: "Ranking diario",
    bestToday: (n) => `Tu mejor marca hoy: ${n} países`,
    noScoreYet: "Aún no tienes marca hoy — ¡resuelve el reto!",
    rankingNote: "Al final del día, quien tenga la mejor ruta gana el premio base + lo recolectado en el pot. El ranking y el pago se liquidan on-chain.",
    feedback: (r, c) =>
      r === "unknown" ? `No reconozco "${c.input}".`
      : r === "revealed" ? `${c.country} ya está en el mapa.`
      : r === "duplicate" ? `${c.country} ya está en tu ruta.`
      : r === "not_adjacent" ? `${c.country} no limita con ningún país revelado.`
      : c.quality === "green" ? `${c.country} ✓`
      : c.quality === "yellow" ? `${c.country} — vas de lado`
      : `${c.country} — te alejaste`,
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
    footer: "Frontle · Onchain Agents Hackathon · Celo Colombia",
    hintsTitle: "Hints",
    hintInitial: "Next country's initial",
    hintSilhouetteNext: "Next country's silhouette",
    hintSilhouetteAll: "All countries' silhouettes",
    hintNextInitial: (l) => `The next country starts with “${l}”`,
    nextChallenge: (t) => `Next challenge in ${t}`,
    prize: (a) => `🏆 Today's prize: ${a} USDT`,
    rankingTitle: "Daily ranking",
    bestToday: (n) => `Your best today: ${n} countries`,
    noScoreYet: "No score yet today — solve the challenge!",
    rankingNote: "At the end of the day, whoever has the best route wins the base prize + the collected pot. Ranking and payout settle on-chain.",
    feedback: (r, c) =>
      r === "unknown" ? `I don't recognize "${c.input}".`
      : r === "revealed" ? `${c.country} is already on the map.`
      : r === "duplicate" ? `${c.country} is already in your route.`
      : r === "not_adjacent" ? `${c.country} doesn't border any revealed country.`
      : c.quality === "green" ? `${c.country} ✓`
      : c.quality === "yellow" ? `${c.country} — sideways`
      : `${c.country} — you drifted away`,
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
    footer: "Frontle · Hackathon de Agentes Onchain · Celo Colombia",
    hintsTitle: "Dicas",
    hintInitial: "Inicial do próximo país",
    hintSilhouetteNext: "Silhueta do próximo país",
    hintSilhouetteAll: "Silhueta de todos os países",
    hintNextInitial: (l) => `O próximo país começa com “${l}”`,
    nextChallenge: (t) => `Próximo desafio em ${t}`,
    prize: (a) => `🏆 Prêmio de hoje: ${a} USDT`,
    rankingTitle: "Ranking diário",
    bestToday: (n) => `Sua melhor marca hoje: ${n} países`,
    noScoreYet: "Ainda sem marca hoje — resolva o desafio!",
    rankingNote: "No fim do dia, quem tiver a melhor rota ganha o prêmio base + o pot arrecadado. Ranking e pagamento liquidam on-chain.",
    feedback: (r, c) =>
      r === "unknown" ? `Não reconheço "${c.input}".`
      : r === "revealed" ? `${c.country} já está no mapa.`
      : r === "duplicate" ? `${c.country} já está na sua rota.`
      : r === "not_adjacent" ? `${c.country} não faz fronteira com nenhum país revelado.`
      : c.quality === "green" ? `${c.country} ✓`
      : c.quality === "yellow" ? `${c.country} — de lado`
      : `${c.country} — você se afastou`,
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
    footer: "Frontle · Hackathon des Agents Onchain · Celo Colombia",
    hintsTitle: "Indices",
    hintInitial: "Initiale du pays suivant",
    hintSilhouetteNext: "Silhouette du pays suivant",
    hintSilhouetteAll: "Silhouette de tous les pays",
    hintNextInitial: (l) => `Le pays suivant commence par « ${l} »`,
    nextChallenge: (t) => `Prochain défi dans ${t}`,
    prize: (a) => `🏆 Prix du jour : ${a} USDT`,
    rankingTitle: "Classement du jour",
    bestToday: (n) => `Votre meilleur score aujourd'hui : ${n} pays`,
    noScoreYet: "Pas encore de score aujourd'hui — résolvez le défi !",
    rankingNote: "En fin de journée, le meilleur itinéraire remporte le prix de base + la cagnotte collectée. Classement et paiement réglés on-chain.",
    feedback: (r, c) =>
      r === "unknown" ? `Je ne reconnais pas "${c.input}".`
      : r === "revealed" ? `${c.country} est déjà sur la carte.`
      : r === "duplicate" ? `${c.country} est déjà dans votre route.`
      : r === "not_adjacent" ? `${c.country} ne touche aucun pays révélé.`
      : c.quality === "green" ? `${c.country} ✓`
      : c.quality === "yellow" ? `${c.country} — de côté`
      : `${c.country} — vous vous êtes éloigné`,
  },
};

export function t(locale: Locale): Dict {
  return STRINGS[locale] ?? STRINGS.en;
}
