// ============================================================
//  Frontle — Progreso persistente del jugador (Supabase, migración 0007)
//  · Racha y puntos: vista `player_progress`, DERIVADA de `scores` en el
//    servidor — el cliente nunca los asevera (no se pueden inflar).
//  · Logros: tabla `achievements`, insert-only con la anon key (el mismo
//    modelo de confianza de `scores`) para los que el servidor no puede
//    derivar (usan la cadena jugada, que no viaja en la marca).
//  Todo degrada en silencio: sin credenciales o sin la migración aplicada,
//  el juego sigue con los datos locales (nunca bloquear por el progreso).
// ============================================================

import type { AchievementId } from "./achievements";
import { ACHIEVEMENT_IDS } from "./achievements";

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPA_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const useSupabase = Boolean(SUPA_URL && SUPA_KEY);

const HEADERS = () => ({
  apikey: SUPA_KEY!,
  Authorization: `Bearer ${SUPA_KEY}`,
});

export interface PlayerProgress {
  daysPlayed: number;
  points: number;
  streak: number;
}

// Racha/puntos del jugador según el servidor. null = sin datos o sin backend.
export async function getPlayerProgress(playerId: string): Promise<PlayerProgress | null> {
  if (!useSupabase || !playerId) return null;
  try {
    const r = await fetch(
      `${SUPA_URL}/rest/v1/player_progress?player_id=eq.${encodeURIComponent(playerId.toLowerCase())}&select=days_played,points,streak`,
      { headers: HEADERS() }
    );
    const j = await r.json();
    const row = Array.isArray(j) ? j[0] : null;
    if (!row) return null;
    return {
      daysPlayed: Number(row.days_played ?? 0),
      points: Number(row.points ?? 0),
      streak: Number(row.streak ?? 0),
    };
  } catch {
    return null;
  }
}

// Logros ya registrados en el servidor (para fusionar cross-device).
export async function getRemoteAchievements(playerId: string): Promise<AchievementId[]> {
  if (!useSupabase || !playerId) return [];
  try {
    const r = await fetch(
      `${SUPA_URL}/rest/v1/achievements?player_id=eq.${encodeURIComponent(playerId.toLowerCase())}&select=id`,
      { headers: HEADERS() }
    );
    const j = await r.json();
    if (!Array.isArray(j)) return [];
    return j
      .map((x: { id?: string }) => x.id)
      .filter((id): id is AchievementId => ACHIEVEMENT_IDS.includes(id as AchievementId));
  } catch {
    return [];
  }
}

// Registra logros nuevos. Idempotente: los duplicados se ignoran en el
// servidor (on_conflict + ignore-duplicates), así que se puede reenviar
// la lista completa sin miedo.
export async function pushAchievements(playerId: string, ids: AchievementId[]): Promise<void> {
  if (!useSupabase || !playerId || ids.length === 0) return;
  try {
    await fetch(`${SUPA_URL}/rest/v1/achievements?on_conflict=player_id,id`, {
      method: "POST",
      headers: {
        ...HEADERS(),
        "Content-Type": "application/json",
        Prefer: "return=minimal,resolution=ignore-duplicates",
      },
      body: JSON.stringify(ids.map((id) => ({ player_id: playerId.toLowerCase(), id }))),
    });
  } catch {
    /* silencioso: el progreso nunca bloquea el juego */
  }
}
