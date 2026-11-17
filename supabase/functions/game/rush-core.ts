// ============================================================
//  Frontle — Flag Rush, lógica pura (sin base de datos ni red)
//
//  10 banderas con 4 opciones cada una, un intento por ventana de 8 h (UTC).
//  Todo lo que decide el resultado vive aquí para poder probarlo solo
//  (rush-core_test.ts); rush.ts solo guarda y lee.
//
//  Reglas (decisiones de David, 16-nov-2026):
//   · Set DISTINTO por jugador, con la misma mezcla de dificultad: no hay
//     respuestas que copiar entre cuentas.
//   · XP con tope: cuentan los 2 mejores intentos del día, hasta 6 XP cada
//     uno (12 al día). Se guarda en unidades de 2 XP (ver xp_shape, 0034).
//   · Sin ranking ni premio propio.
// ============================================================

export type Tier = "easy" | "medium" | "hard";

export interface Flag {
  code: string; // ISO alpha-2 en mayúsculas
  tier: Tier;
  continent: string;
}

// Una pregunta guardada en el servidor: `a` es la respuesta y NUNCA sale al
// cliente antes de que conteste; `o` son las 4 opciones ya mezcladas.
export interface Question {
  a: string;
  o: string[];
}

export interface Answer {
  c: string | null; // lo que eligió (null = se le acabó el tiempo o mandó algo inválido)
  ok: boolean;
  ms: number;
}

export const QUESTIONS = 10;
export const OPTIONS = 4;
// De fácil a difícil, para que el intento vaya subiendo.
export const MIX: readonly (readonly [Tier, number])[] = [["easy", 3], ["medium", 4], ["hard", 3]];
export const SLOT_HOURS = 8;
export const ANSWER_MS = 10_000; // tiempo por bandera
export const GRACE_MS = 2_000; // margen de red antes de dar la respuesta por tardía
// Lo que la pantalla muestra el veredicto (verde/rojo) antes de la siguiente
// bandera. El reloj de la siguiente arranca DESPUÉS: si no, esa pausa saldría
// de los 10 s del jugador.
export const VERDICT_MS = 600;
export const XP_UNIT = 2;
export const XP_UNITS_PER_DAY = 6; // 12 XP: el seq máximo de 'flag_rush' en xp_shape
export const COUNTED_ATTEMPTS = 2;
// Señal para revisar (no sanciona): casi perfecto y más rápido de lo que
// tarda una persona en mirar la bandera y tocar.
export const SUSPECT_MEDIAN_MS = 600;
export const SUSPECT_MIN_CORRECT = 8;

// Banderas que no se distinguen a simple vista: nunca van juntas como
// respuesta y señuelo (sería una moneda al aire, no una pregunta).
const TWINS: readonly (readonly [string, string])[] = [
  ["ID", "MC"], // Indonesia / Mónaco
  ["TD", "RO"], // Chad / Rumania
  ["LU", "NL"], // Luxemburgo / Países Bajos
];

function areTwins(a: string, b: string): boolean {
  return TWINS.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
}

// Día UTC como YYYYMMDD (el formato de xp_events.day y scores.day).
export function utcDay(d: Date): number {
  return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
}

// Ventana del día: 0 (00–08 UTC), 1 (08–16) o 2 (16–24).
export function slotOf(d: Date): number {
  return Math.floor(d.getUTCHours() / SLOT_HOURS);
}

// Cuándo termina la ventana en curso (= cuándo abre la siguiente).
export function slotEnd(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), (slotOf(d) + 1) * SLOT_HOURS));
}

export function shuffle<T>(items: readonly T[], rand: () => number): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Tres señuelos para una bandera: primero del mismo continente (los que de
// verdad hacen dudar), y si no alcanzan, del resto.
function decoys(answer: Flag, flags: readonly Flag[], rand: () => number): string[] {
  const others = flags.filter((f) => f.code !== answer.code && !areTwins(f.code, answer.code));
  const near = shuffle(others.filter((f) => f.continent === answer.continent), rand);
  const far = shuffle(others.filter((f) => f.continent !== answer.continent), rand);
  return [...near, ...far].slice(0, OPTIONS - 1).map((f) => f.code);
}

// El set de un intento: 3 fáciles, 4 medias y 3 difíciles, sin repetir.
export function pickQuestions(flags: readonly Flag[], rand: () => number): Question[] {
  const chosen: Flag[] = [];
  for (const [tier, n] of MIX) {
    const pool = shuffle(flags.filter((f) => f.tier === tier), rand);
    if (pool.length < n) throw new Error(`faltan banderas de nivel ${tier}`);
    chosen.push(...pool.slice(0, n));
  }
  return chosen.map((f) => ({ a: f.code, o: shuffle([f.code, ...decoys(f, flags, rand)], rand) }));
}

// Lo único de una pregunta que puede ver el cliente antes de contestar.
export function publicQuestion(questions: readonly Question[], index: number): { index: number; total: number; options: string[] } {
  return { index, total: questions.length, options: [...questions[index].o] };
}

// Aplica la respuesta a la pregunta en curso. `elapsedMs` lo mide el servidor
// (desde que entregó la bandera). Tarde o inválida cuenta como fallo.
export function applyAnswer(
  questions: readonly Question[],
  answers: readonly Answer[],
  choice: unknown,
  elapsedMs: number,
): { answers: Answer[]; ok: boolean; answer: string; done: boolean } {
  const index = answers.length;
  if (index >= questions.length) throw new Error("el intento ya terminó");
  const q = questions[index];
  const valid = typeof choice === "string" && q.o.includes(choice);
  const inTime = elapsedMs <= ANSWER_MS + GRACE_MS;
  const ok = valid && inTime && choice === q.a;
  const ms = Math.max(0, Math.min(ANSWER_MS, Math.round(elapsedMs)));
  const next = [...answers, { c: valid ? (choice as string) : null, ok, ms }];
  return { answers: next, ok, answer: q.a, done: next.length >= questions.length };
}

export function summarize(answers: readonly Answer[]): { correct: number; timeMs: number; suspect: boolean } {
  const right = answers.filter((a) => a.ok);
  const times = right.map((a) => a.ms).sort((x, y) => x - y);
  const median = times.length ? times[Math.floor(times.length / 2)] : ANSWER_MS;
  return {
    correct: right.length,
    timeMs: answers.reduce((s, a) => s + a.ms, 0),
    suspect: right.length >= SUSPECT_MIN_CORRECT && median < SUSPECT_MEDIAN_MS,
  };
}

// XP de un intento según aciertos. Adivinar al azar da 2 o 3 aciertos: 0 XP.
export function xpFor(correct: number): number {
  if (correct >= 9) return 6;
  if (correct >= 7) return 4;
  if (correct >= 5) return 2;
  return 0;
}

// XP del día: los 2 mejores intentos, nunca más que el tope.
export function dailyXp(attemptXps: readonly number[]): number {
  const best = [...attemptXps].sort((a, b) => b - a).slice(0, COUNTED_ATTEMPTS);
  return Math.min(XP_UNIT * XP_UNITS_PER_DAY, best.reduce((s, x) => s + x, 0));
}
