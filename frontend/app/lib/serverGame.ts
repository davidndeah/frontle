// ============================================================
//  Frontle — Cliente de la función `game` (reto diario en el servidor)
//
//  Desde SERVER_GAME_FROM el reto del día no se calcula en el navegador:
//  lo genera Supabase en secreto y lo revela al abrir la partida, y la marca
//  la escribe el servidor con su propio reloj tras revalidar la cadena.
//  Ver supabase/functions/game/index.ts y la migración 0023.
// ============================================================

import type { Difficulty } from "./game";

// Primer día (YYYYMMDD UTC) servido por el servidor. Los días anteriores se
// jugaron con el reto determinista y siguen así (ranking y pot ya cerrados).
export const SERVER_GAME_FROM = 20261105;

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPA_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export interface LevelPreview {
  optimal: number;
  startContinent: string;
  endContinent: string;
}
export interface ServerChallenge {
  start: string;
  end: string;
  optimal: number;
}
export interface StartedGame {
  sessionId: string;
  challenge: ServerChallenge;
  /** ms de juego ya transcurridos según el servidor (al retomar > 0). */
  elapsedMs: number;
}
export type StartError =
  | "payment_required"
  | "payment_used"
  | "too_many_sessions"
  | "network"
  | string;

async function call<T>(body: Record<string, unknown>): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  if (!SUPA_URL || !SUPA_KEY) return { ok: false, error: "network" };
  try {
    const r = await fetch(`${SUPA_URL}/functions/v1/game`, {
      method: "POST",
      headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = await r.json().catch(() => null);
    if (j?.ok) return { ok: true, data: j as T };
    return { ok: false, error: String(j?.error ?? "network") };
  } catch {
    return { ok: false, error: "network" };
  }
}

export function isServerDay(day: number): boolean {
  return day >= SERVER_GAME_FROM;
}

export async function getPreview(): Promise<Record<Difficulty, LevelPreview> | null> {
  const r = await call<{ levels: Record<Difficulty, LevelPreview> }>({ action: "preview" });
  return r.ok ? r.data.levels : null;
}

export async function startServerGame(
  player: string,
  level: Difficulty,
  paymentTx?: string | null
): Promise<{ ok: true; game: StartedGame } | { ok: false; error: StartError }> {
  const r = await call<{ sessionId: string; challenge: ServerChallenge; startedAt: string; serverNow: string }>({
    action: "start",
    player,
    level,
    ...(paymentTx ? { paymentTx } : {}),
  });
  if (!r.ok) return r;
  const elapsedMs = Math.max(0, new Date(r.data.serverNow).getTime() - new Date(r.data.startedAt).getTime());
  return { ok: true, game: { sessionId: r.data.sessionId, challenge: r.data.challenge, elapsedMs } };
}

export interface Pause {
  tx: string;
  ms: number;
}

export async function finishServerGame(
  sessionId: string,
  chain: string[],
  pauses: Pause[],
  countryCode: string,
  name: string | undefined,
  usedHints: boolean
): Promise<{ ok: true; countries: number; timeMs: number; xp: number } | { ok: false; error: string }> {
  const r = await call<{ countries: number; timeMs: number; xp?: number }>({
    action: "finish",
    sessionId,
    chain,
    pauses,
    countryCode,
    usedHints,
    ...(name ? { name } : {}),
  });
  // `xp`: XP del diario que el servidor otorgó al cerrar (0 si ya lo tenía).
  return r.ok ? { ok: true, countries: r.data.countries, timeMs: r.data.timeMs, xp: Number(r.data.xp) || 0 } : r;
}
