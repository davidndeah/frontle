// ============================================================
//  Frontle — Lógica del juego
//  - BFS para la ruta más corta entre dos países (el "par")
//  - Reto diario determinístico (misma semilla = mismo reto)
//  - Normalización de nombres para el input del usuario
// ============================================================

import { COUNTRIES, COUNTRY_NAMES, getCountry, areNeighbors } from "./countries";

export interface DailyChallenge {
  start: string;
  end: string;
  optimal: number; // # de países intermedios en la ruta más corta
  path: string[]; // una ruta óptima (start ... end)
}

// --- BFS: ruta más corta por fronteras ---
export function shortestPath(start: string, end: string): string[] | null {
  if (start === end) return [start];
  if (!getCountry(start) || !getCountry(end)) return null;

  const queue: string[] = [start];
  const prev: Record<string, string | null> = { [start]: null };

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === end) break;
    for (const nb of COUNTRIES[current].neighbors) {
      if (!(nb in prev)) {
        prev[nb] = current;
        queue.push(nb);
      }
    }
  }

  if (!(end in prev)) return null; // no conectados

  const path: string[] = [];
  let node: string | null = end;
  while (node !== null) {
    path.unshift(node);
    node = prev[node];
  }
  return path;
}

// --- Normalización de nombres para comparar input ---
// Quita acentos, pasa a minúsculas, colapsa espacios.
export function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

// Mapa de alias comunes → nombre canónico
const ALIASES: Record<string, string> = {
  usa: "United States",
  us: "United States",
  "u.s.a.": "United States",
  "u.s.": "United States",
  america: "United States",
  uae: "United Arab Emirates",
  drc: "Democratic Republic of the Congo",
  "dr congo": "Democratic Republic of the Congo",
  "congo-kinshasa": "Democratic Republic of the Congo",
  "congo-brazzaville": "Republic of the Congo",
  congo: "Republic of the Congo",
  "south korea": "South Korea",
  "north korea": "North Korea",
  "czechia": "Czech Republic",
  "ivory coast": "Ivory Coast",
  "cote divoire": "Ivory Coast",
  "bosnia": "Bosnia and Herzegovina",
  "uk": "United Kingdom",
};

// Índice normalizado de nombres canónicos
const NORM_INDEX: Record<string, string> = (() => {
  const idx: Record<string, string> = {};
  for (const name of COUNTRY_NAMES) idx[normalize(name)] = name;
  for (const alias in ALIASES) {
    const canonical = ALIASES[alias];
    if (COUNTRIES[canonical]) idx[normalize(alias)] = canonical;
  }
  return idx;
})();

// Resuelve un texto del usuario al nombre canónico del país, o null.
export function resolveCountry(input: string): string | null {
  return NORM_INDEX[normalize(input)] ?? null;
}

// Sugerencias para autocomplete (máx `limit`)
export function suggest(input: string, limit = 6): string[] {
  const q = normalize(input);
  if (!q) return [];
  const starts: string[] = [];
  const contains: string[] = [];
  for (const name of COUNTRY_NAMES) {
    const n = normalize(name);
    if (n.startsWith(q)) starts.push(name);
    else if (n.includes(q)) contains.push(name);
  }
  return [...starts, ...contains].slice(0, limit);
}

// --- Reto diario determinístico ---
// PRNG simple (mulberry32) sembrado por la fecha → todos ven el mismo reto.
function mulberry32(seed: number): () => number {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function dateSeed(d = new Date()): number {
  // YYYYMMDD en UTC como semilla
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  return y * 10000 + m * 100 + day;
}

// Genera el reto del día: un par de países cuya ruta más corta
// tenga una dificultad razonable (entre 3 y 6 países intermedios).
export function dailyChallenge(seed = dateSeed()): DailyChallenge {
  const rand = mulberry32(seed);
  const names = COUNTRY_NAMES;
  const MIN_OPT = 3;
  const MAX_OPT = 6;

  // Hasta 200 intentos de encontrar un par con dificultad objetivo.
  for (let i = 0; i < 200; i++) {
    const a = names[Math.floor(rand() * names.length)];
    const b = names[Math.floor(rand() * names.length)];
    if (a === b) continue;
    const path = shortestPath(a, b);
    if (!path) continue;
    const optimal = path.length - 2; // intermedios = total - origen - destino
    if (optimal >= MIN_OPT && optimal <= MAX_OPT) {
      return { start: a, end: b, optimal, path };
    }
  }

  // Fallback garantizado: Colombia → Argentina
  const fallback = shortestPath("Colombia", "Argentina")!;
  return { start: "Colombia", end: "Argentina", optimal: fallback.length - 2, path: fallback };
}

// --- Semáforo: qué tan buena es una jugada ---
export type Quality = "green" | "yellow" | "red";
export type Status = "start" | "end" | Quality;

// Distancia (en saltos) de un país al destino. Infinity si no hay ruta.
export function distanceTo(country: string, end: string): number {
  const p = shortestPath(country, end);
  return p ? p.length - 1 : Infinity;
}

// Evalúa el paso prev → country respecto al destino:
//  - verde:    acerca al destino (distancia baja)
//  - amarillo: lateral (distancia igual)
//  - rojo:     aleja del destino (distancia sube)
export function stepQuality(prev: string, country: string, end: string): Quality {
  const dPrev = distanceTo(prev, end);
  const dNew = distanceTo(country, end);
  if (dNew < dPrev) return "green";
  if (dNew === dPrev) return "yellow";
  return "red";
}

// --- Estado de una partida ---
export interface ChainItem {
  country: string;
  quality: Quality;
}

export interface PlayState {
  challenge: DailyChallenge;
  chain: ChainItem[]; // países jugados (sin incluir start/end)
  solved: boolean;
}

export interface GuessResult {
  ok: boolean;
  solved: boolean;
  country?: string;
  quality?: Quality;
  message: string;
}

// Intenta agregar un país a la cadena.
// REGLA DE VICTORIA: el juego termina apenas se ingresa un país que
// limita con el destino (no hay que escribir el destino mismo).
export function tryGuess(state: PlayState, input: string): GuessResult {
  const { start, end } = state.challenge;
  const country = resolveCountry(input);

  if (!country) {
    return { ok: false, solved: false, message: `No reconozco "${input}".` };
  }
  if (country === start) {
    return { ok: false, solved: false, message: "Ese es el país de origen." };
  }
  if (country === end) {
    return { ok: false, solved: false, message: `Llega a un país que limite con ${end}, no a ${end} directo.` };
  }
  if (state.chain.some((c) => c.country === country)) {
    return { ok: false, solved: false, message: `${country} ya está en tu ruta.` };
  }

  // El último país de la cadena (o el origen si está vacía)
  const last = state.chain.length > 0 ? state.chain[state.chain.length - 1].country : start;

  // Debe limitar con el país anterior para ser una jugada válida
  if (!areNeighbors(last, country)) {
    return { ok: false, solved: false, message: `${country} no limita con ${last}.` };
  }

  const quality = stepQuality(last, country, end);
  const solved = areNeighbors(country, end);
  const message = solved
    ? `¡${country} limita con ${end}! 🎉`
    : quality === "green"
      ? `${country} ✓`
      : quality === "yellow"
        ? `${country} — vas de lado`
        : `${country} — te alejaste`;

  return { ok: true, solved, country, quality, message };
}
