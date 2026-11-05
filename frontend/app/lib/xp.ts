// ============================================================
//  Frontle v2 — XP y liga semanal (Fase 1, PLAN-FRONTLE-V2 §4)
//
//  · Los eventos de `xp_events` (migración 0008) los escribe el SERVIDOR
//    (función `game`, migración 0025): el del diario al cerrar la partida y
//    el de los modos libres al cerrar cada ronda abierta en el servidor.
//    Aquí solo se abren/cierran rondas y se lee la liga.
//  · Identidad: SIEMPRE la wallet. Igual que el ranking diario, la liga
//    exige wallet — sin ella no se emite XP (el servidor además lo impone
//    con un check de formato de dirección). `bindXpIdentity` la fija al
//    conectar; jugar sigue siendo libre, lo que requiere wallet es competir.
//  · Todo degrada en silencio: sin Supabase, el juego sigue.
// ============================================================

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

// Fuente con tope diario. Las rondas dentro del tope son las que dan XP —y por
// eso son las GRATIS. Pasado el tope se puede seguir jugando pagando monedas,
// pero ya no otorga XP: si lo hiciera, las monedas comprarían posición en la
// liga (y premio), que es justo lo que FrontleWeekly prohíbe por diseño.
export type CappedSource = keyof typeof CAPS;

// Fuente de XP de cada modo de quiz.
export function quizSource(mode: "flag" | "outline"): CappedSource {
  return mode === "flag" ? "quiz_flag" : "quiz_outline";
}

// Rondas gratis (= con XP) que le quedan hoy al jugador en esa fuente. El
// contador local espeja el del servidor; el techo real lo impone la PK.
export function freeRoundsLeft(source: CappedSource, day = todayUTC()): number {
  let n = 0;
  try {
    n = Number(localStorage.getItem(`frontle-xp-seq-${day}-${source}`) || "0");
  } catch {}
  return Math.max(0, CAPS[source] - n);
}

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

// Dirección con la que se compite. Cadena vacía = sin wallet: no hay XP ni
// monedas (misma regla que el ranking diario).
export function xpPlayerId(): string {
  try {
    return localStorage.getItem(XP_ID_KEY) ?? "";
  } catch {
    return "";
  }
}

export function hasLeagueIdentity(): boolean {
  return /^0x[0-9a-f]{40}$/.test(xpPlayerId());
}

// Día UTC actual en formato YYYYMMDD (el mismo de `scores.day`).
export function todayUTC(): number {
  const d = new Date();
  return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
}

// --- Otorgamiento por modo ---------------------------------------------------

// Los tres modos libres: cada ronda se ABRE en el servidor al empezar
// (`beginXpRound`) y se cierra al resolverla (`award*`). El servidor cuenta el
// tope del día, exige un tiempo mínimo de juego y escribe el XP — el cliente
// ya no inserta eventos (migración 0025). Devuelven el XP realmente otorgado
// (0 si se agotó el tope o la ronda no se pudo abrir).

const openRounds: Partial<Record<CappedSource, Promise<string | null>>> = {};

async function gameCall(body: Record<string, unknown>): Promise<Record<string, unknown> | null> {
  if (!useSupabase) return null;
  try {
    const r = await fetch(`${SUPA_URL}/functions/v1/game`, {
      method: "POST",
      headers: { ...HEADERS(), "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = await r.json().catch(() => null);
    return j && typeof j === "object" ? (j as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

// Espeja en local cuántas rondas con XP quedan (lo que enseña la UI).
function syncLocalSeq(source: CappedSource, remaining: unknown, day = todayUTC()): void {
  if (typeof remaining !== "number") return;
  try {
    localStorage.setItem(`frontle-xp-seq-${day}-${source}`, String(Math.max(0, CAPS[source] - remaining)));
  } catch {}
}

// Abre la ronda de una fuente al empezar a jugarla. Sin wallet o con el tope
// agotado no abre nada (la ronda se juega igual, sin XP).
export function beginXpRound(source: CappedSource): void {
  const player = xpPlayerId();
  if (!/^0x[0-9a-f]{40}$/.test(player) || freeRoundsLeft(source) === 0) {
    delete openRounds[source];
    return;
  }
  openRounds[source] = gameCall({ action: "xp_start", player, source }).then((j) => {
    if (!j?.ok) return null;
    syncLocalSeq(source, j.remaining);
    return typeof j.roundId === "string" ? j.roundId : null;
  });
}

async function finishXpRound(source: CappedSource, proof?: Record<string, unknown>): Promise<number> {
  const pending = openRounds[source];
  delete openRounds[source];
  const roundId = pending ? await pending : null;
  if (!roundId) return 0;
  const j = await gameCall({ action: "xp_finish", roundId, ...(proof ? { proof } : {}) });
  if (!j?.ok) return 0;
  syncLocalSeq(source, j.remaining);
  return Number(j.xp) || 0;
}

// Regiones: completar un país (máx 1 país con XP por día).
export function awardRegionWin(): Promise<number> {
  return finishXpRound("region");
}

// Quiz: acierto (máx 5 con XP por día y por modo).
export function awardQuizCorrect(mode: "flag" | "outline"): Promise<number> {
  return finishXpRound(quizSource(mode));
}

// Práctica: reto resuelto (máx 3 con XP por día). El servidor revalida la
// cadena contra el reto jugado.
export function awardPracticeSolve(proof: { start: string; end: string; chain: string[] }): Promise<number> {
  return finishXpRound("practice", proof);
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

// Tiempo al cierre en corto ("3d 5h", "7h"). Lo comparten la liga y las
// tarjetas Diario/Semanal de la pestaña Ranking.
export function fmtWeekClose(ms: number): string {
  const totalH = Math.max(0, Math.floor(ms / 3_600_000));
  const d = Math.floor(totalH / 24);
  const h = totalH % 24;
  return d > 0 ? `${d}d ${h}h` : `${h}h`;
}

// Tabla de la semana: UN SOLO ranking global que se reinicia cada lunes.
// Orden de `weekly_leaderboard` (0027): XP desc y, a igualdad, la marca del
// reto diario (niveles, países de más, tiempo); al final, quien llegó antes.
export async function getWeeklyRanking(limit = 20): Promise<WeeklyEntry[]> {
  if (!useSupabase) return [];
  try {
    const r = await fetch(
      `${SUPA_URL}/rest/v1/rpc/weekly_leaderboard?p_week=${weekStartUTC()}&p_limit=${limit}&select=player_id,xp`,
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

export interface LastWeekBoard {
  /** Lunes UTC (YYYY-MM-DD) de la semana cerrada. */
  weekStart: string;
  /** Top de la semana, mismo orden que el cierre (`weekly_leaderboard`). */
  entries: WeeklyEntry[];
  /** Puesto (1-3) y pot crudo de cada ganador, de `weekly_winners`. */
  winners: Record<string, { place: number; potRaw: string }>;
}

// Clasificación final de la semana ANTERIOR, con su podio pagado. El orden es
// el de `weekly_leaderboard` (lo que usa close-week), así que el 1.º de esta tabla
// es el 1.º que cobró. Los ganadores salen de `weekly_winners` y no de "los 3
// primeros": close-week se salta los ids que no son wallet, y entre las 00:00 y
// el cierre (00:20 UTC) aún no hay podio registrado.
export async function getLastWeekBoard(limit = 10): Promise<LastWeekBoard | null> {
  if (!useSupabase) return null;
  const weekStart = weekStartUTC(new Date(Date.now() - 7 * 86_400_000));
  try {
    const [r, w] = await Promise.all([
      fetch(
        `${SUPA_URL}/rest/v1/rpc/weekly_leaderboard?p_week=${weekStart}&p_limit=${limit}&select=player_id,xp`,
        { headers: HEADERS() }
      ),
      fetch(`${SUPA_URL}/rest/v1/weekly_winners?week_start=eq.${weekStart}&select=winner_address,place,pot_raw`, {
        headers: HEADERS(),
      }),
    ]);
    const rows = await r.json();
    const wins = await w.json();
    if (!Array.isArray(rows) || rows.length === 0) return null;
    const winners: LastWeekBoard["winners"] = {};
    for (const x of Array.isArray(wins) ? wins : []) {
      winners[String(x.winner_address).toLowerCase()] = { place: Number(x.place), potRaw: String(x.pot_raw ?? "0") };
    }
    return {
      weekStart,
      entries: rows.map((row: { player_id: string; xp: number }) => ({
        playerId: String(row.player_id),
        xp: Number(row.xp ?? 0),
      })),
      winners,
    };
  } catch {
    return null;
  }
}

// Cuántas filas de `weekly_xp` cumplen el filtro, sin traérselas: PostgREST
// devuelve el total en la cabecera Content-Range ("0-0/42") cuando se le pide
// count=exact. Así la posición no depende de descargar la tabla entera.
async function countWeekly(filter: string): Promise<number | null> {
  try {
    const r = await fetch(`${SUPA_URL}/rest/v1/weekly_xp?${filter}&select=player_id`, {
      headers: { ...HEADERS(), Prefer: "count=exact", Range: "0-0" },
    });
    const total = r.headers.get("content-range")?.split("/")[1];
    return total && total !== "*" ? Number(total) : null;
  } catch {
    return null;
  }
}

export interface WeeklyStanding {
  xp: number;
  /** Puesto (1 = primero). Empates: comparten el mejor puesto posible. */
  rank: number;
  /** Cuántos jugadores compiten esta semana. */
  players: number;
}

// Posición del jugador en la liga de la semana. null si no hay backend o el
// jugador aún no tiene identidad de liga (sin wallet no se compite).
export async function getWeeklyStanding(): Promise<WeeklyStanding | null> {
  if (!useSupabase || !hasLeagueIdentity()) return null;
  const week = weekStartUTC();
  const xp = await getMyWeeklyXp();
  const [ahead, players] = await Promise.all([
    countWeekly(`week=eq.${week}&xp=gt.${xp}`),
    countWeekly(`week=eq.${week}`),
  ]);
  if (ahead === null || players === null) return null;
  const rank = ahead + 1;
  // Con 0 XP el jugador aún no tiene fila propia: no estaría contado en
  // `players` y el puesto quedaría por encima del total.
  return { xp, rank, players: Math.max(players, rank) };
}

// Cuántos jugadores compiten en la liga esta semana (para /stats).
export async function getWeeklyPlayers(): Promise<number | null> {
  if (!useSupabase) return null;
  return countWeekly(`week=eq.${weekStartUTC()}`);
}

// XP semanal del propio jugador (0 si aún no tiene eventos esta semana).
export async function getMyWeeklyXp(): Promise<number> {
  if (!useSupabase || !hasLeagueIdentity()) return 0;
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
