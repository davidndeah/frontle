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
  footer: string;
  feedback: (r: GuessReason, ctx: { country?: string; last?: string; end: string; quality?: string; input: string }) => string;
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
    footer: "Frontle · Hackathon de Agentes Onchain · Celo Colombia",
    feedback: (r, c) =>
      r === "unknown" ? `No reconozco "${c.input}".`
      : r === "is_start" ? "Ese es el país de origen."
      : r === "is_end" ? `Llega a un país que limite con ${c.end}, no a ${c.end} directo.`
      : r === "duplicate" ? `${c.country} ya está en tu ruta.`
      : r === "not_adjacent" ? `${c.country} no limita con ${c.last}.`
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
    footer: "Frontle · Onchain Agents Hackathon · Celo Colombia",
    feedback: (r, c) =>
      r === "unknown" ? `I don't recognize "${c.input}".`
      : r === "is_start" ? "That's the starting country."
      : r === "is_end" ? `Reach a country bordering ${c.end}, not ${c.end} directly.`
      : r === "duplicate" ? `${c.country} is already in your route.`
      : r === "not_adjacent" ? `${c.country} doesn't border ${c.last}.`
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
    footer: "Frontle · Hackathon de Agentes Onchain · Celo Colombia",
    feedback: (r, c) =>
      r === "unknown" ? `Não reconheço "${c.input}".`
      : r === "is_start" ? "Esse é o país de origem."
      : r === "is_end" ? `Chegue a um país que faça fronteira com ${c.end}, não a ${c.end} direto.`
      : r === "duplicate" ? `${c.country} já está na sua rota.`
      : r === "not_adjacent" ? `${c.country} não faz fronteira com ${c.last}.`
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
    footer: "Frontle · Hackathon des Agents Onchain · Celo Colombia",
    feedback: (r, c) =>
      r === "unknown" ? `Je ne reconnais pas "${c.input}".`
      : r === "is_start" ? "C'est le pays de départ."
      : r === "is_end" ? `Atteignez un pays voisin de ${c.end}, pas ${c.end} directement.`
      : r === "duplicate" ? `${c.country} est déjà dans votre route.`
      : r === "not_adjacent" ? `${c.country} ne touche pas ${c.last}.`
      : c.quality === "green" ? `${c.country} ✓`
      : c.quality === "yellow" ? `${c.country} — de côté`
      : `${c.country} — vous vous êtes éloigné`,
  },
};

export function t(locale: Locale): Dict {
  return STRINGS[locale] ?? STRINGS.en;
}
