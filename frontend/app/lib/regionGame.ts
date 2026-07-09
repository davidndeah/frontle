// ============================================================
//  Frontle — Motor de retos REGIONALES (departamentos/estados).
//  Espejo fiel de game.ts pero parametrizado por región:
//   - mismo semáforo (desvío 0=verde, 1-2=amarillo, ≥3=rojo)
//   - misma regla de jugada válida (limita con cualquier conocido)
//   - misma victoria (origen↔destino conectados por conocidos)
//  El modo regional es GRATIS (sin pot); ranking aparte por región.
// ============================================================

import { dateSeed, type Quality, type GuessReason } from "./game";
import { regionGraph } from "./regions";

export interface RegionChallenge {
  regionId: string;
  start: string;
  end: string;
  optimal: number; // nº de intermedios de una ruta óptima
}

export interface RegionChainItem {
  entity: string;
  quality: Quality;
}

export interface RegionPlayState {
  challenge: RegionChallenge;
  chain: RegionChainItem[];
  solved: boolean;
}

export interface RegionGuessResult {
  ok: boolean;
  solved: boolean;
  reason: GuessReason;
  entity?: string;
  quality?: Quality;
  input: string;
}

// --- BFS sobre el grafo de la región ---
export function regionShortestPath(regionId: string, start: string, end: string): string[] | null {
  if (start === end) return [start];
  const g = regionGraph(regionId);
  const prev: Record<string, string | null> = { [start]: null };
  const queue = [start];
  while (queue.length) {
    const cur = queue.shift()!;
    if (cur === end) break;
    for (const nb of g.neighbors[cur] ?? []) {
      if (!(nb in prev)) {
        prev[nb] = cur;
        queue.push(nb);
      }
    }
  }
  if (!(end in prev)) return null;
  const path: string[] = [];
  let node: string | null = end;
  while (node !== null) {
    path.unshift(node);
    node = prev[node];
  }
  return path;
}

export function regionDistance(regionId: string, a: string, b: string): number {
  const p = regionShortestPath(regionId, a, b);
  return p ? p.length - 1 : Infinity;
}

export function regionQuality(regionId: string, entity: string, start: string, end: string): Quality {
  const detour =
    regionDistance(regionId, start, entity) +
    regionDistance(regionId, entity, end) -
    regionDistance(regionId, start, end);
  if (detour <= 0) return "green";
  if (detour <= 2) return "yellow";
  return "red";
}

// --- Reto diario determinista por región ---
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Mezcla el seed del día con el id de la región (reto distinto por región).
function seedForRegion(seed: number, regionId: string): number {
  let h = seed | 0;
  for (let i = 0; i < regionId.length; i++) {
    h = (Math.imul(h ^ regionId.charCodeAt(i), 2654435761) + 0x9e3779b9) | 0;
  }
  return h >>> 0;
}

// Banda de intermedios: retos ni triviales ni eternos.
const MIN_MID = 2;
const MAX_MID = 6;

export function dailyRegionChallenge(regionId: string, seed = dateSeed()): RegionChallenge {
  const g = regionGraph(regionId);
  const rand = mulberry32(seedForRegion(seed, regionId));
  const names = g.names;

  for (let i = 0; i < 300; i++) {
    const a = names[Math.floor(rand() * names.length)];
    const b = names[Math.floor(rand() * names.length)];
    if (a === b) continue;
    const p = regionShortestPath(regionId, a, b);
    if (!p) continue;
    const mids = p.length - 2;
    if (mids >= MIN_MID && mids <= MAX_MID) {
      return { regionId, start: a, end: b, optimal: mids };
    }
  }
  // Fallback (grafos chicos/mala suerte): relaja la banda
  for (let i = 0; i < 300; i++) {
    const a = names[Math.floor(rand() * names.length)];
    const b = names[Math.floor(rand() * names.length)];
    if (a === b) continue;
    const p = regionShortestPath(regionId, a, b);
    if (p && p.length - 2 >= 1) {
      return { regionId, start: a, end: b, optimal: p.length - 2 };
    }
  }
  // Último recurso: par fijo garantizado por región
  const fixed: Record<string, [string, string]> = {
    co: ["La Guajira", "Nariño"],
    us: ["Maine", "Florida"],
  };
  const [a, b] = fixed[regionId] ?? [names[0], names[names.length - 1]];
  const p = regionShortestPath(regionId, a, b)!;
  return { regionId, start: a, end: b, optimal: p.length - 2 };
}

export function randomRegionChallenge(regionId: string): RegionChallenge {
  return dailyRegionChallenge(regionId, Math.floor(Math.random() * 1_000_000_000));
}

// --- Jugada (misma regla Travle que el modo mundial) ---
export function regionKnownSet(state: RegionPlayState): Set<string> {
  const s = new Set<string>([state.challenge.start, state.challenge.end]);
  for (const c of state.chain) s.add(c.entity);
  return s;
}

export function regionConnects(regionId: string, start: string, end: string, known: Set<string>): boolean {
  if (!known.has(start) || !known.has(end)) return false;
  const g = regionGraph(regionId);
  const visited = new Set<string>([start]);
  const queue = [start];
  while (queue.length) {
    const cur = queue.shift()!;
    if (cur === end) return true;
    for (const nb of g.neighbors[cur] ?? []) {
      if (known.has(nb) && !visited.has(nb)) {
        visited.add(nb);
        queue.push(nb);
      }
    }
  }
  return false;
}

export function tryRegionGuess(
  state: RegionPlayState,
  rawInput: string,
  entity: string | null
): RegionGuessResult {
  const { regionId, start, end } = state.challenge;
  const g = regionGraph(regionId);

  if (!entity) {
    return { ok: false, solved: false, reason: "unknown", input: rawInput };
  }
  if (entity === start || entity === end) {
    return { ok: false, solved: false, reason: "revealed", entity, input: rawInput };
  }
  if (state.chain.some((c) => c.entity === entity)) {
    return { ok: false, solved: false, reason: "duplicate", entity, input: rawInput };
  }

  const known = regionKnownSet(state);
  const bordersKnown = [...known].some((k) => (g.neighbors[k] ?? []).includes(entity));
  if (!bordersKnown) {
    return { ok: false, solved: false, reason: "not_adjacent", entity, input: rawInput };
  }

  const quality = regionQuality(regionId, entity, start, end);
  known.add(entity);
  const solved = regionConnects(regionId, start, end, known);
  return { ok: true, solved, reason: "ok", entity, quality, input: rawInput };
}

// --- Pista gratuita del modo regional (siguiente intermedio óptimo) ---
export function nextRegionHint(state: RegionPlayState): string | null {
  const { regionId, start, end } = state.challenge;
  const path = regionShortestPath(regionId, start, end);
  if (!path) return null;
  const known = regionKnownSet(state);
  for (const e of path) {
    if (e !== start && e !== end && !known.has(e)) return e;
  }
  return null;
}
