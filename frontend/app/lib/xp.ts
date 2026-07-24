// ============================================================
//  Frontle v2 — XP y liga semanal (Fase 1, PLAN-FRONTLE-V2 §4)
//
//  · Los eventos se insertan en `xp_events` (migración 0008) con la anon
//    key — mismo modelo de confianza que `scores`. El VALOR y el TOPE de
//    cada fuente los valida el servidor (check + primary key), no este
//    archivo: aquí solo evitamos requests que sabemos que rebotarían.
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

// Los tres modos libres devuelven el XP realmente otorgado (0 si ya se agotó
// el tope del día) y esperan a que el evento esté insertado: la pantalla de
// victoria lee la posición en la liga justo después y necesita ver este XP ya
// contado. El diario no lo necesita y sigue siendo fire-and-forget.

// Regiones: completar un país (máx 1 país con XP por día).
export async function awardRegionWin(day = todayUTC()): Promise<number> {
  const seq = nextSeq(day, "region");
  if (seq === null) return 0;
  await postEvents(day, [{ source: "region", seq, xp: XP.region }]);
  return XP.region;
}

// Quiz: acierto (máx 5 con XP por día y por modo).
export async function awardQuizCorrect(mode: "flag" | "outline", day = todayUTC()): Promise<number> {
  const seq = nextSeq(day, quizSource(mode));
  if (seq === null) return 0;
  await postEvents(day, [{ source: quizSource(mode), seq, xp: XP.quiz }]);
  return XP.quiz;
}

// Práctica: reto resuelto (máx 3 con XP por día).
export async function awardPracticeSolve(day = todayUTC()): Promise<number> {
  const seq = nextSeq(day, "practice");
  if (seq === null) return 0;
  await postEvents(day, [{ source: "practice", seq, xp: XP.practice }]);
  return XP.practice;
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

// Tabla de la semana: UN SOLO ranking global que se reinicia cada lunes.
// Orden del plan (§3.2): XP desc, y a igualdad gana quien llegó antes.
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
