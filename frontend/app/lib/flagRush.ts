// ============================================================
//  Frontle — Flag Rush en el cliente
//
//  Flag Rush lo decide el servidor (supabase/functions/game/rush.ts): elige
//  las banderas, lleva el reloj y califica. Aquí solo se habla con él y se
//  traduce lo que devuelve.
//
//  Tres piezas:
//   · `serverRush` — las tres acciones reales de la función `game`.
//   · `mockRush`   — un servidor de mentira que vive en el navegador, con
//                    las MISMAS respuestas y reglas. Sirve para probar la
//                    pantalla sin Supabase. Se activa con ?rushmock=1 o con
//                    NEXT_PUBLIC_RUSH_MOCK=1. Ojo: entrega la imagen como
//                    enlace de flagcdn (con el código del país): es solo para
//                    probar, nunca para jugar de verdad.
//   · `practiceQuestions` — la práctica libre tras el intento. Va en el
//                    navegador porque no da XP: no hay nada que proteger.
//
//  `pickQuestions` es copia de supabase/functions/game/rush-core.ts (misma
//  mezcla, mismos señuelos, mismas gemelas). Si cambia allá, cambia aquí.
// ============================================================

import { COUNTRIES, COUNTRY_NAMES } from "./countries";
import { ISLANDS } from "./islands";
import { tierOf } from "./game";
import { CONTINENT_OF } from "./continents";
import { localSecret, ensureSecret } from "./secret";
import { xpPlayerId } from "./xp";

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPA_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// --- Reglas (las mismas del servidor) --------------------------------------
export const RUSH_QUESTIONS = 10;
export const RUSH_ANSWER_MS = 10_000;
export const RUSH_SLOT_HOURS = 8;
export const RUSH_MAX_XP_DAY = 12;
/** Lo máximo que da una partida (9 o 10 aciertos). Lo muestra la ficha de Modos. */
export const RUSH_XP_PER_GAME = 6;
/** Pausa del veredicto antes de la siguiente bandera (VERDICT_MS del servidor). */
export const RUSH_VERDICT_MS = 600;
const MIX: readonly (readonly ["easy" | "medium" | "hard", number])[] = [["easy", 3], ["medium", 4], ["hard", 3]];
const TWINS: readonly (readonly [string, string])[] = [["ID", "MC"], ["TD", "RO"], ["LU", "NL"]];

export function rushXpFor(correct: number): number {
  if (correct >= 9) return 6;
  if (correct >= 7) return 4;
  if (correct >= 5) return 2;
  return 0;
}

// --- Tipos de las respuestas -------------------------------------------------
export interface RushQuestion {
  index: number;
  total: number;
  /** Códigos ISO alpha-2 de las 4 opciones. El nombre lo pone el cliente. */
  options: string[];
  /** La bandera lista para un <img> (data URL en el servidor real). */
  image: string;
  answerMs: number;
  /** Lo que le queda a esta bandera según el reloj del servidor. */
  leftMs: number;
}
export interface RushAttempt {
  slot: number;
  correct: number;
  timeMs: number;
  xp: number;
}
export interface RushDay {
  attempts: RushAttempt[];
  xpToday: number;
  maxXpToday: number;
}
export interface RushResult extends RushDay {
  correct: number;
  total: number;
  timeMs: number;
  /** XP de este intento según aciertos (0 si la cuenta está sancionada). */
  xp: number;
  /** XP que de verdad sumó hoy (los 2 mejores, con tope). */
  gained: number;
}
export interface RushStatus extends RushDay {
  day: number;
  slot: number;
  nextSlotAt: string;
  /** none = puede jugar · open = intento a medias · played = ya jugó esta ventana */
  state: "none" | "open" | "played";
  total: number;
  answerMs: number;
}
export type RushStart =
  | { sessionId: string; question: RushQuestion; nextSlotAt: string; done?: false;
      /** Acierto o fallo de las banderas ya contestadas (al retomar). */
      results?: boolean[];
      /** Salió con una bandera en pantalla y esa bandera contó como fallo. */
      left?: boolean }
  | { sessionId: string; done: true; result: RushResult; nextSlotAt: string; left?: boolean };
export type RushAnswer =
  | { correct: boolean; answer: string; done: false; question: RushQuestion }
  | { correct: boolean; answer: string; done: true; result: RushResult; nextSlotAt: string };

/** Errores que la pantalla sabe explicar. El resto cae en "network". */
export type RushError = "no_player" | "identity" | "played" | "image_unavailable" | "stale" | "finished" | "network";
type R<T> = { ok: true; data: T } | { ok: false; error: RushError; nextSlotAt?: string };

export interface RushClient {
  mock: boolean;
  status(): Promise<R<RushStatus>>;
  start(): Promise<R<RushStart>>;
  answer(sessionId: string, choice: string | null): Promise<R<RushAnswer>>;
}

const KNOWN: RushError[] = ["identity", "played", "image_unavailable", "stale", "finished"];

// --- Servidor real -----------------------------------------------------------
async function call<T>(body: Record<string, unknown>): Promise<R<T>> {
  if (!SUPA_URL || !SUPA_KEY) return { ok: false, error: "network" };
  try {
    const r = await fetch(`${SUPA_URL}/functions/v1/game`, {
      method: "POST",
      headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      // Que llegue aunque la página se esté yendo a segundo plano (la
      // respuesta vacía que se manda al salir con una bandera a la vista).
      keepalive: true,
    });
    const j = await r.json().catch(() => null);
    if (j?.ok) return { ok: true, data: j as T };
    const e = String(j?.error ?? "network") as RushError;
    return { ok: false, error: KNOWN.includes(e) ? e : "network", nextSlotAt: j?.nextSlotAt };
  } catch {
    return { ok: false, error: "network" };
  }
}

export const serverRush: RushClient = {
  mock: false,
  async status() {
    const player = xpPlayerId();
    if (!player) return { ok: false, error: "no_player" };
    return call<RushStatus>({ action: "rush_status", player });
  },
  async start() {
    const player = xpPlayerId();
    if (!player) return { ok: false, error: "no_player" };
    // El servidor exige el secret de gasto: primero se liga a esta wallet.
    if (!(await ensureSecret())) return { ok: false, error: "identity" };
    return call<RushStart>({ action: "rush_start", player, secret: localSecret() });
  },
  async answer(sessionId, choice) {
    return call<RushAnswer>({ action: "rush_answer", sessionId, choice });
  },
};

// --- Banco de banderas (el mismo de scripts/export-flags-data.mts) -----------
interface BankFlag { code: string; tier: "easy" | "medium" | "hard"; continent: string }
let bank: BankFlag[] | null = null;
let nameOf: Map<string, string> | null = null;

function flagBank(): BankFlag[] {
  if (bank) return bank;
  const out: BankFlag[] = [];
  const names = new Map<string, string>();
  for (const name of COUNTRY_NAMES) {
    const code = COUNTRIES[name].code;
    const continent = CONTINENT_OF[code];
    if (!continent || names.has(code)) continue;
    out.push({ code, tier: tierOf(name) ?? "medium", continent });
    names.set(code, name);
  }
  for (const i of ISLANDS) {
    const continent = CONTINENT_OF[i.code];
    if (!continent || names.has(i.code)) continue;
    out.push({ code: i.code, tier: i.tier, continent });
    names.set(i.code, i.name);
  }
  bank = out;
  nameOf = names;
  return out;
}

/** Nombre canónico (el del grafo) de un código, para pasarlo a countryName. */
export function rushCanonical(code: string): string {
  flagBank();
  return nameOf!.get(code) ?? code;
}

/** Bandera como enlace. Solo para la práctica y el simulador. */
export function flagUrl(code: string): string {
  return `https://flagcdn.com/w320/${code.toLowerCase()}.webp`;
}

// --- Elegir preguntas (copia de rush-core.ts) --------------------------------
const rand = () => crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296;

function shuffle<T>(items: readonly T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const areTwins = (a: string, b: string) => TWINS.some(([x, y]) => (x === a && y === b) || (x === b && y === a));

export interface LocalQuestion { a: string; o: string[] }

export function practiceQuestions(): LocalQuestion[] {
  const flags = flagBank();
  const chosen: BankFlag[] = [];
  for (const [tier, n] of MIX) chosen.push(...shuffle(flags.filter((f) => f.tier === tier)).slice(0, n));
  return chosen.map((f) => {
    const others = flags.filter((x) => x.code !== f.code && !areTwins(x.code, f.code));
    const near = shuffle(others.filter((x) => x.continent === f.continent));
    const far = shuffle(others.filter((x) => x.continent !== f.continent));
    const decoys = [...near, ...far].slice(0, 3).map((x) => x.code);
    return { a: f.code, o: shuffle([f.code, ...decoys]) };
  });
}

// --- Ventanas de 8 h (UTC) ----------------------------------------------------
export function utcDay(d: Date): number {
  return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
}
export function slotOf(d: Date): number {
  return Math.floor(d.getUTCHours() / RUSH_SLOT_HOURS);
}
/** Inicio de cada ventana de hoy, como fecha (para mostrarla en hora local). */
export function slotStarts(now: Date): Date[] {
  return [0, 1, 2].map((s) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), s * RUSH_SLOT_HOURS)));
}

// --- Simulador ---------------------------------------------------------------
//  Guarda los intentos en localStorage para que recargar la página se
//  comporte como el servidor (retomar, ventana ya jugada). `mockShiftSlot`
//  adelanta el reloj una ventana para probar varios intentos en un día.
const MOCK_KEY = "frontle-rush-mock";
interface MockSession { id: string; day: number; slot: number; q: LocalQuestion[]; answers: { c: string | null; ok: boolean; ms: number }[]; servedAt: number; finished: boolean; xp: number }
interface MockState { offsetMs: number; sessions: MockSession[] }

function mockLoad(): MockState {
  try {
    const s = JSON.parse(localStorage.getItem(MOCK_KEY) ?? "null");
    if (s && Array.isArray(s.sessions)) return s;
  } catch { /* vacío */ }
  return { offsetMs: 0, sessions: [] };
}
function mockSave(s: MockState) {
  try { localStorage.setItem(MOCK_KEY, JSON.stringify(s)); } catch { /* sin almacenamiento */ }
}
const mockNow = (s: MockState) => new Date(Date.now() + s.offsetMs);
const nextSlotIso = (d: Date) =>
  new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), (slotOf(d) + 1) * RUSH_SLOT_HOURS)).toISOString();

export function mockReset() {
  mockSave({ offsetMs: 0, sessions: [] });
}
/** Adelanta el reloj del simulador hasta la próxima ventana. */
export function mockShiftSlot() {
  const s = mockLoad();
  const now = mockNow(s);
  s.offsetMs += new Date(nextSlotIso(now)).getTime() - now.getTime() + 1000;
  mockSave(s);
}

function mockDay(s: MockState, day: number): RushDay {
  const done = s.sessions.filter((x) => x.day === day && x.finished);
  const xps = done.map((x) => x.xp).sort((a, b) => b - a).slice(0, 2);
  return {
    attempts: done.map((x) => ({ slot: x.slot, correct: x.answers.filter((a) => a.ok).length, timeMs: x.answers.reduce((t, a) => t + a.ms, 0), xp: x.xp })),
    xpToday: Math.min(RUSH_MAX_XP_DAY, xps.reduce((t, x) => t + x, 0)),
    maxXpToday: RUSH_MAX_XP_DAY,
  };
}
function mockQuestion(x: MockSession, leftMs: number): RushQuestion {
  return { index: x.answers.length, total: x.q.length, options: [...x.q[x.answers.length].o], image: flagUrl(x.q[x.answers.length].a), answerMs: RUSH_ANSWER_MS, leftMs };
}
function mockFinish(s: MockState, x: MockSession): RushResult {
  const before = mockDay(s, x.day).xpToday;
  x.finished = true;
  const correct = x.answers.filter((a) => a.ok).length;
  x.xp = rushXpFor(correct);
  const day = mockDay(s, x.day);
  return { correct, total: x.q.length, timeMs: x.answers.reduce((t, a) => t + a.ms, 0), xp: x.xp, gained: day.xpToday - before, ...day };
}
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const mockRush: RushClient = {
  mock: true,
  async status() {
    await wait(250);
    const s = mockLoad();
    const now = mockNow(s);
    const day = utcDay(now), slot = slotOf(now);
    const cur = s.sessions.find((x) => x.day === day && x.slot === slot);
    return { ok: true, data: { day, slot, nextSlotAt: nextSlotIso(now), state: !cur ? "none" : cur.finished ? "played" : "open", total: RUSH_QUESTIONS, answerMs: RUSH_ANSWER_MS, ...mockDay(s, day) } };
  },
  async start() {
    await wait(350);
    const s = mockLoad();
    const now = mockNow(s);
    const day = utcDay(now), slot = slotOf(now);
    let x = s.sessions.find((y) => y.day === day && y.slot === slot);
    if (x?.finished) return { ok: false, error: "played", nextSlotAt: nextSlotIso(now) };
    if (!x) {
      x = { id: crypto.randomUUID(), day, slot, q: practiceQuestions(), answers: [], servedAt: now.getTime(), finished: false, xp: 0 };
      s.sessions.push(x);
      mockSave(s);
      return { ok: true, data: { sessionId: x.id, question: mockQuestion(x, RUSH_ANSWER_MS), results: [], nextSlotAt: nextSlotIso(now) } };
    }
    // Retomar: salir con una bandera en pantalla la cuenta como fallo
    // (RESUME_GRACE_MS del servidor: 1,5 s para un reintento de red).
    const elapsed = now.getTime() - x.servedAt;
    if (elapsed > 1500) {
      x.answers.push({ c: null, ok: false, ms: RUSH_ANSWER_MS });
      x.servedAt = now.getTime();
      if (x.answers.length >= x.q.length) {
        const result = mockFinish(s, x);
        mockSave(s);
        return { ok: true, data: { sessionId: x.id, done: true, left: true, result, nextSlotAt: nextSlotIso(now) } };
      }
      mockSave(s);
      return { ok: true, data: { sessionId: x.id, question: mockQuestion(x, RUSH_ANSWER_MS), results: x.answers.map((a) => a.ok), left: true, nextSlotAt: nextSlotIso(now) } };
    }
    return { ok: true, data: { sessionId: x.id, question: mockQuestion(x, Math.max(0, RUSH_ANSWER_MS - elapsed)), results: x.answers.map((a) => a.ok), left: false, nextSlotAt: nextSlotIso(now) } };
  },
  async answer(sessionId, choice) {
    await wait(180);
    const s = mockLoad();
    const x = s.sessions.find((y) => y.id === sessionId);
    if (!x) return { ok: false, error: "network" };
    if (x.finished) return { ok: false, error: "finished" };
    const now = mockNow(s);
    const q = x.q[x.answers.length];
    const elapsed = now.getTime() - x.servedAt;
    const valid = typeof choice === "string" && q.o.includes(choice);
    const ok = valid && elapsed <= RUSH_ANSWER_MS + 2000 && choice === q.a;
    x.answers.push({ c: valid ? choice : null, ok, ms: Math.max(0, Math.min(RUSH_ANSWER_MS, elapsed)) });
    x.servedAt = now.getTime() + RUSH_VERDICT_MS;
    if (x.answers.length >= x.q.length) {
      const result = mockFinish(s, x);
      mockSave(s);
      return { ok: true, data: { correct: ok, answer: q.a, done: true, result, nextSlotAt: nextSlotIso(now) } };
    }
    mockSave(s);
    return { ok: true, data: { correct: ok, answer: q.a, done: false, question: mockQuestion(x, RUSH_ANSWER_MS + RUSH_VERDICT_MS) } };
  },
};

/** El cliente que toca: el simulador si se pidió, si no el servidor real. */
export function rushClient(): RushClient {
  if (process.env.NEXT_PUBLIC_RUSH_MOCK === "1") return mockRush;
  try {
    if (new URLSearchParams(window.location.search).get("rushmock") === "1") return mockRush;
  } catch { /* sin window (SSR) */ }
  return serverRush;
}

/** "2 h 14 min" · "14 min" · "menos de 1 min". */
export function formatWait(ms: number, lessThanMinute: string): string {
  const min = Math.floor(ms / 60_000);
  if (min < 1) return lessThanMinute;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h} h ${m} min` : `${m} min`;
}
