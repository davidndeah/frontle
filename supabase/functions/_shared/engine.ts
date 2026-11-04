// ============================================================
//  Frontle — Motor del reto diario (lado servidor)
//
//  Desde que el reto diario lo genera el servidor, nadie puede saber el
//  origen y el destino antes de empezar a jugar: el reto ya no sale de una
//  semilla pública (la fecha) sino de números aleatorios del servidor, y se
//  revela solo al abrir la partida (función `game`, acción start).
//
//  Las REGLAS son las mismas que app/lib/game.ts (dailyChallenge, versión
//  "rebalanceada" vigente desde el 20-jul-2026) y el grafo es el mismo
//  (engine-data.json, exportado de app/lib/countries.ts con
//  frontend/scripts/export-engine-data.mts):
//    · cada nivel usa los países de su dificultad (fama + conectividad);
//    · intermedios de la ruta óptima: fácil 2–3, medio 2–5, difícil 2–7;
//    · fácil: sin aristas exóticas y origen/destino en la misma región.
//
//  Sin dependencias de Deno: también lo importa la prueba de paridad en Node.
// ============================================================

export type Level = "easy" | "medium" | "hard";
export const LEVELS: Level[] = ["easy", "medium", "hard"];

export interface EngineData {
  countries: Record<string, { code: string; neighbors: string[]; tier: string; continent: string }>;
  exotic: [string, string][];
}

export interface Challenge {
  start: string;
  end: string;
  optimal: number; // intermedios de la ruta más corta
  path: string[]; // una ruta óptima (start … end)
}

export function makeEngine(data: EngineData) {
  const C = data.countries;
  const NAMES = Object.keys(C).sort();
  const edgeKey = (a: string, b: string) => (a < b ? `${a} ${b}` : `${b} ${a}`);
  const EXOTIC = new Set(data.exotic.map(([a, b]) => edgeKey(a, b)));
  const neighborSet: Record<string, Set<string>> = {};
  for (const n of NAMES) neighborSet[n] = new Set(C[n].neighbors);

  const areNeighbors = (a: string, b: string) => neighborSet[a]?.has(b) ?? false;
  const usesExoticEdge = (path: string[]) => {
    for (let i = 1; i < path.length; i++) if (EXOTIC.has(edgeKey(path[i - 1], path[i]))) return true;
    return false;
  };
  // Norteamérica y Sudamérica cuentan como una región (igual que el cliente).
  const regionOf = (n: string) => {
    const c = C[n]?.continent ?? "";
    return c === "NA" || c === "SA" ? "AM" : c;
  };

  function shortestPath(start: string, end: string): string[] | null {
    if (start === end) return [start];
    if (!C[start] || !C[end]) return null;
    const queue = [start];
    const prev: Record<string, string | null> = { [start]: null };
    while (queue.length) {
      const cur = queue.shift()!;
      if (cur === end) break;
      for (const nb of C[cur].neighbors) {
        if (!(nb in prev)) {
          prev[nb] = cur;
          queue.push(nb);
        }
      }
    }
    if (!(end in prev)) return null;
    const path: string[] = [];
    for (let node: string | null = end; node !== null; node = prev[node]) path.unshift(node);
    return path;
  }

  // Genera el reto de un nivel con la fuente aleatoria dada (en el servidor:
  // crypto.getRandomValues). Mismas tres pasadas que el cliente.
  function generate(level: Level, rand: () => number): Challenge {
    const pool = NAMES.filter((n) => C[n].tier === level);
    const MIN_OPT = 2;
    const MAX_OPT = level === "easy" ? 3 : level === "medium" ? 5 : 7;
    const rejects = (path: string[]) =>
      level === "easy" && (usesExoticEdge(path) || regionOf(path[0]) !== regionOf(path[path.length - 1]));
    const pick = (list: string[]) => list[Math.floor(rand() * list.length)];

    for (let i = 0; i < 400; i++) {
      const a = pick(pool);
      const b = pick(pool);
      if (a === b) continue;
      const path = shortestPath(a, b);
      if (!path || rejects(path)) continue;
      const optimal = path.length - 2;
      if (optimal >= MIN_OPT && optimal <= MAX_OPT) return { start: a, end: b, optimal, path };
    }
    for (let i = 0; i < 400; i++) {
      const a = pick(pool);
      const b = pick(NAMES);
      if (a === b) continue;
      const path = shortestPath(a, b);
      if (!path || rejects(path)) continue;
      const optimal = path.length - 2;
      if (optimal >= MIN_OPT && optimal <= MAX_OPT) return { start: a, end: b, optimal, path };
    }
    for (const a of pool) {
      for (const b of pool) {
        if (a === b) continue;
        const path = shortestPath(a, b);
        if (path && path.length >= 3 && !rejects(path)) return { start: a, end: b, optimal: path.length - 2, path };
      }
    }
    const fb = shortestPath("Colombia", "Argentina")!;
    return { start: "Colombia", end: "Argentina", optimal: fb.length - 2, path: fb };
  }

  // Revalida una partida jugada: misma regla que tryGuess del cliente (cada
  // país debe limitar con alguno ya conocido) y la victoria debe llegar
  // justo con el último país. Devuelve el puntaje (países jugados) o el motivo.
  function replay(start: string, end: string, chain: string[]):
    | { ok: true; countries: number }
    | { ok: false; reason: string } {
    if (!Array.isArray(chain) || chain.length === 0 || chain.length > 60) return { ok: false, reason: "bad_chain" };
    const known = new Set([start, end]);
    const connected = () => {
      const seen = new Set([start]);
      const q = [start];
      while (q.length) {
        const cur = q.shift()!;
        if (cur === end) return true;
        for (const nb of C[cur]?.neighbors ?? []) {
          if (known.has(nb) && !seen.has(nb)) {
            seen.add(nb);
            q.push(nb);
          }
        }
      }
      return false;
    };
    for (let i = 0; i < chain.length; i++) {
      const c = chain[i];
      if (typeof c !== "string" || !C[c]) return { ok: false, reason: "unknown_country" };
      if (known.has(c)) return { ok: false, reason: "duplicate" };
      if (![...known].some((k) => areNeighbors(k, c))) return { ok: false, reason: "not_adjacent" };
      known.add(c);
      const solved = connected();
      if (solved && i < chain.length - 1) return { ok: false, reason: "extra_after_solve" };
      if (!solved && i === chain.length - 1) return { ok: false, reason: "not_solved" };
    }
    return { ok: true, countries: chain.length };
  }

  const continentOf = (n: string) => C[n]?.continent ?? "";

  return { NAMES, shortestPath, generate, replay, continentOf, areNeighbors };
}
