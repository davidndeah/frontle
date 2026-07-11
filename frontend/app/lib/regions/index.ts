// ============================================================
//  Frontle — Registro de regiones jugables + grafo derivado.
//  Espejo de countries.ts pero parametrizado por región.
// ============================================================

import type { RegionDef } from "./types";
import { COLOMBIA } from "./colombia";
import { USA } from "./usa";
import { ARGENTINA } from "./ar";
import { NIGERIA } from "./ng";
import { BRASIL } from "./br";

export type { RegionDef, RegionEntity } from "./types";

export const REGIONS: Record<string, RegionDef> = {
  co: COLOMBIA,
  us: USA,
  ar: ARGENTINA,
  ng: NIGERIA,
  br: BRASIL,
};
export const REGION_IDS = Object.keys(REGIONS) as (keyof typeof REGIONS)[];

// --- Grafo normalizado por región (simétrico, vecinos ordenados) --------
export interface RegionGraph {
  names: string[]; // orden alfabético (determinismo del reto)
  neighbors: Record<string, string[]>;
  codeOf: Record<string, string>;
  /** índice de resolución: nombre/alias normalizado → canónico */
  index: Record<string, string>;
}

// misma normalización que game.ts: minúsculas y sin tildes
export function normalizeName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s.]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const graphCache: Record<string, RegionGraph> = {};

export function regionGraph(regionId: string): RegionGraph {
  if (graphCache[regionId]) return graphCache[regionId];
  const def = REGIONS[regionId];
  if (!def) throw new Error(`región desconocida: ${regionId}`);

  const neighbors: Record<string, string[]> = {};
  const codeOf: Record<string, string> = {};
  const index: Record<string, string> = {};

  for (const e of def.entities) {
    neighbors[e.name] = [...e.neighbors];
    codeOf[e.name] = e.code;
    index[normalizeName(e.name)] = e.name;
    for (const a of e.aliases ?? []) index[normalizeName(a)] = e.name;
  }
  // simetría defensiva (los datos ya vienen simétricos, validado por script)
  for (const [a, nbs] of Object.entries(neighbors)) {
    for (const b of nbs) {
      if (neighbors[b] && !neighbors[b].includes(a)) neighbors[b].push(a);
    }
  }
  for (const k of Object.keys(neighbors)) neighbors[k].sort();

  const g: RegionGraph = {
    names: Object.keys(neighbors).sort(),
    neighbors,
    codeOf,
    index,
  };
  graphCache[regionId] = g;
  return g;
}

export function resolveRegionEntity(regionId: string, input: string): string | null {
  return regionGraph(regionId).index[normalizeName(input)] ?? null;
}

export function suggestRegionEntities(regionId: string, input: string, limit = 6): string[] {
  const q = normalizeName(input);
  if (!q) return [];
  const g = regionGraph(regionId);
  const starts: string[] = [];
  const contains: string[] = [];
  for (const name of g.names) {
    const n = normalizeName(name);
    if (n.startsWith(q)) starts.push(name);
    else if (n.includes(q)) contains.push(name);
  }
  return [...starts, ...contains].slice(0, limit);
}
