// ============================================================
//  Frontle — Lógica del juego
//  - BFS para la ruta más corta entre dos países (el "par")
//  - Reto diario determinístico (misma semilla = mismo reto)
//  - Normalización de nombres para el input del usuario
// ============================================================

import { COUNTRIES, COUNTRY_NAMES, getCountry, areNeighbors } from "./countries";

export type Difficulty = "easy" | "medium" | "hard";
export const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard"];

export interface DailyChallenge {
  start: string;
  end: string;
  optimal: number; // # de países intermedios en la ruta más corta
  path: string[]; // una ruta óptima (start ... end)
  level: Difficulty; // nivel de dificultad (por rareza de los países)
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

// --- Dificultad por fama y conectividad ---
// La dificultad de un nivel viene de qué tan CONOCIDOS son sus países:
//  - fácil  → países muy reconocidos mundialmente (fama pura, set curado)
//  - medio  → el resto, más conectado en el grafo
//  - difícil→ el resto, menos conectado (países aislados / dead-ends / oscuros)
// La fama la define el set curado (no el grado); la conectividad solo separa
// medio de difícil entre los NO famosos.

// Grado (nº de vecinos) = conectividad de un país en el grafo.
function degreeOf(name: string): number {
  return COUNTRIES[name]?.neighbors.length ?? 0;
}

// Países muy reconocidos mundialmente → nivel "fácil". La pertenencia a este
// set (no el grado) es lo que hace fácil a un país. Los que no existan en el
// grafo se ignoran automáticamente.
const FAMOUS_ANCHORS = new Set<string>([
  // América
  "United States", "Canada", "Mexico", "Brazil", "Argentina", "Colombia",
  "Chile", "Peru", "Venezuela", "Ecuador", "Bolivia", "Uruguay", "Cuba",
  "Costa Rica", "Panama",
  // Europa
  "France", "Germany", "Spain", "Italy", "Portugal", "Netherlands", "Belgium",
  "Switzerland", "Austria", "Poland", "Greece", "Sweden", "Norway", "Denmark",
  "Finland", "Ireland", "Ukraine", "Russia", "United Kingdom", "Croatia",
  "Hungary", "Czech Republic", "Romania",
  // Asia
  "China", "India", "Japan", "South Korea", "North Korea", "Thailand",
  "Vietnam", "Indonesia", "Pakistan", "Afghanistan", "Turkey", "Iran", "Iraq",
  "Israel", "Saudi Arabia", "Qatar", "United Arab Emirates", "Syria", "Lebanon",
  "Jordan",
  // África
  "Egypt", "Morocco", "Algeria", "Tunisia", "Libya", "South Africa", "Nigeria",
  "Kenya", "Ethiopia", "Ghana", "Sudan", "Somalia",
]);

// Nivel de cada país: fácil = famoso (set curado); el resto se parte por
// conectividad (mitad superior → medio, mitad inferior → difícil).
// Determinístico y estable (mismo resultado en todo build/cliente).
const COUNTRY_TIER: Record<string, Difficulty> = (() => {
  const tier: Record<string, Difficulty> = {};
  const rest: string[] = [];
  for (const name of COUNTRY_NAMES) {
    if (FAMOUS_ANCHORS.has(name)) tier[name] = "easy";
    else rest.push(name);
  }
  // Los NO famosos: más conectados → medio; menos conectados → difícil.
  rest.sort((a, b) => degreeOf(b) - degreeOf(a) || (a < b ? -1 : 1));
  const half = Math.ceil(rest.length / 2);
  rest.forEach((name, i) => {
    tier[name] = i < half ? "medium" : "hard";
  });
  return tier;
})();

// Nivel al que pertenece un país (por su fama). Útil para UI/depuración.
export function tierOf(name: string): Difficulty | undefined {
  return COUNTRY_TIER[name];
}

// Mezcla la semilla del día con el nivel → cada nivel tiene su propio reto,
// pero sigue siendo determinístico por fecha (todos ven lo mismo).
function seedForLevel(seed: number, level: Difficulty): number {
  const idx = DIFFICULTIES.indexOf(level);
  return (seed * 31 + (idx + 1) * 0x9e37) | 0;
}

// Genera el reto de un NIVEL para un día: un par de países del pool de ese
// nivel cuya ruta más corta caiga en una banda jugable de intermedios.
export function dailyChallenge(seed = dateSeed(), level: Difficulty = "medium"): DailyChallenge {
  const rand = mulberry32(seedForLevel(seed, level));
  const pool = COUNTRY_NAMES.filter((n) => COUNTRY_TIER[n] === level);
  const MIN_OPT = 2;
  const MAX_OPT = 7;

  // 1) Estricto: AMBOS extremos del nivel, cadena dentro de la banda.
  for (let i = 0; i < 400; i++) {
    const a = pool[Math.floor(rand() * pool.length)];
    const b = pool[Math.floor(rand() * pool.length)];
    if (a === b) continue;
    const path = shortestPath(a, b);
    if (!path) continue;
    const optimal = path.length - 2; // intermedios = total - origen - destino
    if (optimal >= MIN_OPT && optimal <= MAX_OPT) {
      return { start: a, end: b, optimal, path, level };
    }
  }

  // 2) Relajado: un extremo del nivel (mantiene la rareza), el otro de cualquier
  //    lado, para asegurar una cadena conectable en la banda.
  for (let i = 0; i < 400; i++) {
    const a = pool[Math.floor(rand() * pool.length)];
    const b = COUNTRY_NAMES[Math.floor(rand() * COUNTRY_NAMES.length)];
    if (a === b) continue;
    const path = shortestPath(a, b);
    if (!path) continue;
    const optimal = path.length - 2;
    if (optimal >= MIN_OPT && optimal <= MAX_OPT) {
      return { start: a, end: b, optimal, path, level };
    }
  }

  // 3) Fallback garantizado: primer par conectable dentro del pool.
  for (const a of pool) {
    for (const b of pool) {
      if (a === b) continue;
      const path = shortestPath(a, b);
      if (path && path.length >= 3) {
        return { start: a, end: b, optimal: path.length - 2, path, level };
      }
    }
  }

  // 4) Último recurso: Colombia → Argentina.
  const fb = shortestPath("Colombia", "Argentina")!;
  return { start: "Colombia", end: "Argentina", optimal: fb.length - 2, path: fb, level };
}

// Los 3 retos del día (uno por nivel). Lo que consumirá la UI del selector.
export function dailyChallenges(seed = dateSeed()): Record<Difficulty, DailyChallenge> {
  return {
    easy: dailyChallenge(seed, "easy"),
    medium: dailyChallenge(seed, "medium"),
    hard: dailyChallenge(seed, "hard"),
  };
}

// --- Semáforo: qué tan buena es una jugada ---
export type Quality = "green" | "yellow" | "red";
export type Status = "start" | "end" | Quality;

// Distancia (en saltos) entre dos países. Infinity si no hay ruta.
export function distance(a: string, b: string): number {
  const p = shortestPath(a, b);
  return p ? p.length - 1 : Infinity;
}

// Evalúa un país según su DESVÍO respecto a la ruta óptima start→end:
//   desvío = d(start, país) + d(país, end) − d(start, end)
//  - verde (0):    el país está sobre una ruta óptima
//  - amarillo (1-2): desvío pequeño
//  - rojo (≥3):    desvío grande
// Así el # de verdes nunca excede el óptimo, y los amarillos aparecen
// cuando el jugador se aparta un poco de la mejor ruta.
export function countryQuality(country: string, start: string, end: string): Quality {
  const detour = distance(start, country) + distance(country, end) - distance(start, end);
  if (detour <= 0) return "green";
  if (detour <= 2) return "yellow";
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

export type GuessReason =
  | "unknown"
  | "revealed"
  | "duplicate"
  | "not_adjacent"
  | "ok";

export interface GuessResult {
  ok: boolean;
  solved: boolean;
  reason: GuessReason;
  country?: string;
  quality?: Quality;
  input: string;
}

// Conjunto de países "conocidos": origen, destino y los revelados.
export function knownSet(state: PlayState): Set<string> {
  const s = new Set<string>([state.challenge.start, state.challenge.end]);
  for (const c of state.chain) s.add(c.country);
  return s;
}

// ¿Origen y destino quedan conectados pasando SOLO por países conocidos?
export function connectsThroughKnown(start: string, end: string, known: Set<string>): boolean {
  if (!known.has(start) || !known.has(end)) return false;
  const visited = new Set<string>([start]);
  const queue = [start];
  while (queue.length) {
    const cur = queue.shift()!;
    if (cur === end) return true;
    for (const nb of COUNTRIES[cur]?.neighbors ?? []) {
      if (known.has(nb) && !visited.has(nb)) {
        visited.add(nb);
        queue.push(nb);
      }
    }
  }
  return false;
}

// Intenta agregar un país a la cadena.
// REGLA (estilo Travle): la jugada es válida si el país limita con
// CUALQUIER país conocido (origen, destino o revelados) — no solo con el
// último. Así un desvío no bloquea ni castiga toda la ruta.
// VICTORIA: cuando origen y destino quedan conectados por países conocidos.
// No genera texto — devuelve un `reason` que la UI traduce.
export function tryGuess(state: PlayState, rawInput: string, country: string | null): GuessResult {
  const { start, end } = state.challenge;

  if (!country) {
    return { ok: false, solved: false, reason: "unknown", input: rawInput };
  }
  if (country === start || country === end) {
    return { ok: false, solved: false, reason: "revealed", country, input: rawInput };
  }
  if (state.chain.some((c) => c.country === country)) {
    return { ok: false, solved: false, reason: "duplicate", country, input: rawInput };
  }

  // Debe limitar con algún país conocido para ser una jugada válida
  const known = knownSet(state);
  const bordersKnown = [...known].some((k) => areNeighbors(k, country));
  if (!bordersKnown) {
    return { ok: false, solved: false, reason: "not_adjacent", country, input: rawInput };
  }

  const quality = countryQuality(country, start, end);
  known.add(country);
  const solved = connectsThroughKnown(start, end, known);
  return { ok: true, solved, reason: "ok", country, quality, input: rawInput };
}

// --- Pistas ---
// Próximo país sugerido: el primer intermedio sin revelar sobre una ruta óptima.
export function nextHintCountry(state: PlayState): string | null {
  const { start, end } = state.challenge;
  const path = shortestPath(start, end);
  if (!path) return null;
  const known = knownSet(state);
  for (const c of path) {
    if (c !== start && c !== end && !known.has(c)) return c;
  }
  return null;
}

// --- Reto aleatorio (para "Jugar de nuevo") ---
export function randomChallenge(level: Difficulty = "medium"): DailyChallenge {
  return dailyChallenge(Math.floor(Math.random() * 1_000_000_000), level);
}

// --- Cuenta regresiva al próximo reto diario (medianoche UTC) ---
export function msUntilNextDailyUTC(now = new Date()): number {
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0);
  return next - now.getTime();
}
