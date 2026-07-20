// ============================================================
//  Frontle v2 — XP y liga semanal (Fase 1, PLAN-FRONTLE-V2 §4)
//
//  · Los eventos se insertan en `xp_events` (migración 0008) con la anon
//    key — mismo modelo de confianza que `scores`. El VALOR y el TOPE de
//    cada fuente los valida el servidor (check + primary key), no este
//    archivo: aquí solo evitamos requests que sabemos que rebotarían.
//  · Identidad: la wallet si existe; si no, el id anónimo del navegador.
//    Un jugador sin wallet acumula XP y solo necesita conectarse si queda
//    en el podio (el puente no-cripto del plan). `bindXpIdentity` fija la
//    wallet como identidad al conectar.
//  · Todo degrada en silencio: sin Supabase, el juego sigue.
// ============================================================

import { getPlayerId } from "./ranking";
import type { Difficulty } from "./game";

// Valores de XP por fuente. Deben coincidir con el check `xp_shape` de la
// migración 0008 — el servidor rechaza cualquier otro valor.
export const XP = {
  daily: { easy: 10, medium: 20, hard: 30 } as Record<Difficulty, number>,
  stars3: 10,
  stars2: 5,
  noHints: 5,
  streakDay: 5,
  streakMilestone: 20,
  region: 10,
  quiz: 2,
  practice: 5,
} as const;

// Topes diarios de las fuentes con seq (el servidor los impone vía PK+check).
const CAPS = { quiz_flag: 5, quiz_outline: 5, practice: 3, region: 1 } as const;

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPA_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const useSupabase = Boolean(SUPA_URL && SUPA_KEY);

const HEADERS = () => ({
  apikey: SUPA_KEY!,
  Authorization: `Bearer ${SUPA_KEY}`,
});

// --- Identidad de la liga ----------------------------------------------------

const XP_ID_KEY = "frontle-xp-id";

// Al conectar wallet/correo, esa dirección pasa a ser la identidad de la liga.
export function bindXpIdentity(walletId: string): void {
  try {
    if (walletId) localStorage.setItem(XP_ID_KEY, walletId.toLowerCase());
  } catch {}
}

export function xpPlayerId(): string {
  try {
    const bound = localStorage.getItem(XP_ID_KEY);
    if (bound) return bound;
  } catch {}
  return getPlayerId();
}

// --- Inserción de eventos ----------------------------------------------------

interface XpEvent {
  source: string;
  level?: string;
  seq?: number;
  xp: number;
}

// Inserta un lote de eventos. `ignore-duplicates`: lo ya otorgado (misma PK)
// se descarta en el servidor sin error — reenviar es seguro e idempotente.
async function postEvents(day: number, events: XpEvent[]): Promise<void> {
  if (!useSupabase || events.length === 0) return;
  const player = xpPlayerId();
  if (!player) return;
  try {
    await fetch(`${SUPA_URL}/rest/v1/xp_events?on_conflict=player_id,day,source,level,seq`, {
      method: "POST",
      headers: {
        ...HEADERS(),
        "Content-Type": "application/json",
        Prefer: "return=minimal,resolution=ignore-duplicates",
      },
      body: JSON.stringify(
        events.map((e) => ({
          player_id: player,
          day,
          source: e.source,
          level: e.level ?? "-",
          seq: e.seq ?? 1,
          xp: e.xp,
        }))
      ),
    });
  } catch {
    /* silencioso: el XP nunca bloquea el juego */
  }
}

// Contador local por (día, fuente) para elegir el `seq` siguiente. Es solo
// una optimización: el techo real lo impone el servidor. Devuelve null si el
// tope del día ya se alcanzó.
function nextSeq(day: number, source: keyof typeof CAPS): number | null {
  const key = `frontle-xp-seq-${day}-${source}`;
  let n = 0;
  try {
    n = Number(localStorage.getItem(key) || "0");
  } catch {}
  if (n >= CAPS[source]) return null;
  try {
    localStorage.setItem(key, String(n + 1));
  } catch {}
  return n + 1;
}

// Día UTC actual en formato YYYYMMDD (el mismo de `scores.day`).
export function todayUTC(): number {
  const d = new Date();
  return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
}

// --- Otorgamiento por modo ---------------------------------------------------

// Reto diario resuelto: XP del nivel + calidad (estrellas) + sin pistas +
// racha mantenida. `stars` es la misma métrica de la win card (3 óptima,
// 2 = +1 país, 1 = más). Todo idempotente por (día, nivel).
export function awardDailySolve(day: number, level: Difficulty, stars: 1 | 2 | 3, usedHints: boolean): void {
  const events: XpEvent[] = [
    { source: "daily", level, xp: XP.daily[level] },
    { source: "streak_day", xp: XP.streakDay },
  ];
  if (stars === 3) events.push({ source: "stars", level, xp: XP.stars3 });
  if (stars === 2) events.push({ source: "stars", level, xp: XP.stars2 });
  if (!usedHints) events.push({ source: "nohints", level, xp: XP.noHints });
  void postEvents(day, events);
}

// Hito de racha (7/30/100) al alcanzarlo. Re-alcanzarlo tras perder la racha
// vuelve a pagar — reconstruirla entera es el mérito (diseño Duolingo).
export function awardStreakMilestone(day: number, streak: number): void {
  if (streak !== 7 && streak !== 30 && streak !== 100) return;
  void postEvents(day, [{ source: "streak_milestone", level: String(streak), xp: XP.streakMilestone }]);
}

// Regiones: completar un país (máx 1 país con XP por día).
export function awardRegionWin(day = todayUTC()): void {
  const seq = nextSeq(day, "region");
  if (seq === null) return;
  void postEvents(day, [{ source: "region", seq, xp: XP.region }]);
}

// Quiz: acierto (máx 5 con XP por día y por modo).
export function awardQuizCorrect(mode: "flag" | "outline", day = todayUTC()): void {
  const source = mode === "flag" ? "quiz_flag" : "quiz_outline";
  const seq = nextSeq(day, source);
  if (seq === null) return;
  void postEvents(day, [{ source, seq, xp: XP.quiz }]);
}

// Práctica: reto resuelto (máx 3 con XP por día).
export function awardPracticeSolve(day = todayUTC()): void {
  const seq = nextSeq(day, "practice");
  if (seq === null) return;
  void postEvents(day, [{ source: "practice", seq, xp: XP.practice }]);
}

// --- Lectura de la liga ------------------------------------------------------

export interface WeeklyEntry {
  playerId: string;
  xp: number;
}

// Lunes (UTC) de la semana de `d`, como 'YYYY-MM-DD' — la clave de `weekly_xp`.
export function weekStartUTC(d = new Date()): string {
  const dow = (d.getUTCDay() + 6) % 7; // 0 = lunes
  const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - dow));
  return monday.toISOString().slice(0, 10);
}

// Milisegundos hasta el cierre (próximo lunes 00:00 UTC).
export function msToWeekClose(now = new Date()): number {
  const dow = (now.getUTCDay() + 6) % 7;
  const close = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + (7 - dow));
  return close - now.getTime();
}

// Top de la semana en curso, ya ordenado por el criterio del plan (§3.2):
// XP desc, y a igualdad gana quien llegó antes.
export async function getWeeklyRanking(limit = 20): Promise<WeeklyEntry[]> {
  if (!useSupabase) return [];
  try {
    const r = await fetch(
      `${SUPA_URL}/rest/v1/weekly_xp?week=eq.${weekStartUTC()}&select=player_id,xp&order=xp.desc,last_event.asc&limit=${limit}`,
      { headers: HEADERS() }
    );
    const j = await r.json();
    if (!Array.isArray(j)) return [];
    return j.map((row: { player_id: string; xp: number }) => ({
      playerId: String(row.player_id),
      xp: Number(row.xp ?? 0),
    }));
  } catch {
    return [];
  }
}

// XP semanal del propio jugador (0 si aún no tiene eventos esta semana).
export async function getMyWeeklyXp(): Promise<number> {
  if (!useSupabase) return 0;
  try {
    const r = await fetch(
      `${SUPA_URL}/rest/v1/weekly_xp?week=eq.${weekStartUTC()}&player_id=eq.${encodeURIComponent(xpPlayerId())}&select=xp`,
      { headers: HEADERS() }
    );
    const j = await r.json();
    return Number((Array.isArray(j) && j[0]?.xp) || 0);
  } catch {
    return 0;
  }
}
