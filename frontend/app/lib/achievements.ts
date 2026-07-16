// ============================================================
//  Logros (GAM-3) — calculados 100% desde las partidas que ya se
//  guardan en localStorage (frontle-game-* / frontle-best-*).
//  Sin backend: la sincronización cross-device llegará con Supabase;
//  este módulo es el único punto que habrá que reemplazar entonces.
// ============================================================

import { dailyChallenge, type Difficulty } from "./game";
import { getCountry } from "./countries";
import { continentOf } from "./continents";

export type AchievementId =
  | "firstWin" // resolver el primer reto
  | "optimalRoute" // resolver con la ruta mínima
  | "twoContinents" // una ruta que toca 2 continentes
  | "streak3" // racha de 3 días
  | "streak7" // racha de 7 días
  | "hardSolved"; // resolver el nivel difícil

export const ACHIEVEMENT_IDS: AchievementId[] = [
  "firstWin",
  "optimalRoute",
  "twoContinents",
  "streak3",
  "streak7",
  "hardSolved",
];

export const ACHIEVEMENT_ICONS: Record<AchievementId, string> = {
  firstWin: "🎯",
  optimalRoute: "🏆",
  twoContinents: "🌉",
  streak3: "🔥",
  streak7: "🌋",
  hardSolved: "🧠",
};

type SavedGame = { solved?: boolean; chain?: { country: string }[] };
const GAME_KEY = /^frontle-game-(\d{8})-(easy|medium|hard)$/;
const SEEN_KEY = "frontle-achievements-seen";

// Continentes que toca una ruta completa (origen + intermedios + destino).
function continentsOfRoute(start: string, chain: string[], end: string): Set<string> {
  const set = new Set<string>();
  for (const name of [start, ...chain, end]) {
    const iso = getCountry(name)?.code;
    const cont = iso ? continentOf(iso) : null;
    if (cont) set.add(cont);
  }
  return set;
}

export function computeAchievements(): Record<AchievementId, boolean> {
  const u: Record<AchievementId, boolean> = {
    firstWin: false,
    optimalRoute: false,
    twoContinents: false,
    streak3: false,
    streak7: false,
    hardSolved: false,
  };
  try {
    // Racha: el mismo conteo de frontle-best-* que muestra el strip del home.
    let bestKeys = 0;
    const games: { day: number; level: Difficulty; game: SavedGame }[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (key.startsWith("frontle-best-")) bestKeys++;
      const m = GAME_KEY.exec(key);
      if (!m) continue;
      try {
        const game = JSON.parse(localStorage.getItem(key) ?? "") as SavedGame;
        if (game?.solved) games.push({ day: Number(m[1]), level: m[2] as Difficulty, game });
      } catch {}
    }
    u.streak3 = bestKeys >= 3;
    u.streak7 = bestKeys >= 7;
    u.firstWin = games.length > 0;
    u.hardSolved = games.some((g) => g.level === "hard");

    // Ruta óptima y 2 continentes exigen recomputar el reto de ese día
    // (dailyChallenge es determinístico por fecha). Es lo más caro del
    // escaneo, así que se corta en cuanto ambos están desbloqueados.
    for (const { day, level, game } of games) {
      if (u.optimalRoute && u.twoContinents) break;
      const chain = (game.chain ?? []).map((c) => c.country);
      const challenge = dailyChallenge(day, level);
      if (chain.length <= challenge.optimal) u.optimalRoute = true;
      if (continentsOfRoute(challenge.start, chain, challenge.end).size >= 2) u.twoContinents = true;
    }
  } catch {}
  return u;
}

// Logros ya vistos (para la micro-celebración de los recién desbloqueados).
export function loadSeenAchievements(): AchievementId[] {
  try {
    const raw = JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]");
    return Array.isArray(raw) ? raw.filter((id): id is AchievementId => ACHIEVEMENT_IDS.includes(id)) : [];
  } catch {
    return [];
  }
}

export function saveSeenAchievements(ids: AchievementId[]) {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(ids));
  } catch {}
}
