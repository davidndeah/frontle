// Pruebas de la lógica pura de Flag Rush.
// Uso (desde supabase/functions/game/):  deno test rush-core_test.ts

import data from "../_shared/flags-data.json" with { type: "json" };
import {
  ANSWER_MS,
  applyAnswer,
  dailyXp,
  type Flag,
  GRACE_MS,
  pickQuestions,
  publicQuestion,
  QUESTIONS,
  slotEnd,
  slotOf,
  summarize,
  utcDay,
  xpFor,
  type Answer,
} from "./rush-core.ts";

const FLAGS = (data as { flags: Flag[] }).flags;
const TIER = new Map(FLAGS.map((f) => [f.code, f.tier]));

function assert(cond: unknown, msg: string): void {
  if (!cond) throw new Error(msg);
}
function eq<T>(got: T, want: T, msg: string): void {
  if (JSON.stringify(got) !== JSON.stringify(want)) throw new Error(`${msg}: ${JSON.stringify(got)} ≠ ${JSON.stringify(want)}`);
}

// Generador determinista para repetir los mismos sets en cada corrida.
function seeded(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

Deno.test("el banco trae banderas de los tres niveles, sin repetir", () => {
  assert(FLAGS.length >= 190, "banco demasiado chico");
  eq(new Set(FLAGS.map((f) => f.code)).size, FLAGS.length, "códigos repetidos");
  for (const t of ["easy", "medium", "hard"]) assert(FLAGS.filter((f) => f.tier === t).length >= 10, `pocas ${t}`);
});

Deno.test("cada set: 10 banderas distintas, mezcla 3/4/3 y 4 opciones válidas", () => {
  for (let s = 1; s <= 500; s++) {
    const qs = pickQuestions(FLAGS, seeded(s));
    eq(qs.length, QUESTIONS, "tamaño del set");
    eq(new Set(qs.map((q) => q.a)).size, QUESTIONS, "respuesta repetida");
    eq(qs.map((q) => TIER.get(q.a)), ["easy", "easy", "easy", "medium", "medium", "medium", "medium", "hard", "hard", "hard"], "mezcla");
    for (const q of qs) {
      eq(q.o.length, 4, "número de opciones");
      eq(new Set(q.o).size, 4, "opción repetida");
      assert(q.o.includes(q.a), "la respuesta no está entre las opciones");
      for (const o of q.o) assert(TIER.has(o), `opción fuera del banco: ${o}`);
    }
  }
});

Deno.test("la respuesta no queda siempre en la misma posición", () => {
  const pos = [0, 0, 0, 0];
  for (let s = 1; s <= 400; s++) for (const q of pickQuestions(FLAGS, seeded(s))) pos[q.o.indexOf(q.a)]++;
  for (const n of pos) assert(n > 700 && n < 1300, `posiciones desbalanceadas: ${pos}`);
});

Deno.test("banderas gemelas nunca van como respuesta y señuelo", () => {
  const twins = [["ID", "MC"], ["TD", "RO"], ["LU", "NL"]];
  for (let s = 1; s <= 3000; s++) {
    for (const q of pickQuestions(FLAGS, seeded(s))) {
      for (const [x, y] of twins) {
        assert(!(q.a === x && q.o.includes(y)) && !(q.a === y && q.o.includes(x)), `gemelas juntas: ${q.a} con ${q.o}`);
      }
    }
  }
});

Deno.test("dos jugadores no reciben el mismo set", () => {
  const a = pickQuestions(FLAGS, seeded(11)).map((q) => q.a).join();
  const b = pickQuestions(FLAGS, seeded(12)).map((q) => q.a).join();
  assert(a !== b, "sets idénticos con semillas distintas");
});

Deno.test("lo que ve el cliente antes de contestar no trae la respuesta", () => {
  const qs = pickQuestions(FLAGS, seeded(7));
  for (let i = 0; i < qs.length; i++) {
    const pub = publicQuestion(qs, i) as Record<string, unknown>;
    eq(Object.keys(pub).sort(), ["index", "options", "total"], "campos públicos");
    eq(pub.options, qs[i].o, "opciones");
  }
});

Deno.test("responder: acierto, fallo, tarde e inválido", () => {
  const qs = pickQuestions(FLAGS, seeded(3));
  const wrong = qs[0].o.find((o) => o !== qs[0].a)!;

  const hit = applyAnswer(qs, [], qs[0].a, 1500);
  eq([hit.ok, hit.answer, hit.done, hit.answers[0]], [true, qs[0].a, false, { c: qs[0].a, ok: true, ms: 1500 }], "acierto");

  const miss = applyAnswer(qs, [], wrong, 900);
  eq([miss.ok, miss.answer, miss.answers[0].c], [false, qs[0].a, wrong], "fallo: revela la correcta solo después");

  const edge = applyAnswer(qs, [], qs[0].a, ANSWER_MS + GRACE_MS);
  eq([edge.ok, edge.answers[0].ms], [true, ANSWER_MS], "dentro del margen cuenta y el tiempo se topa");

  const late = applyAnswer(qs, [], qs[0].a, ANSWER_MS + GRACE_MS + 1);
  eq(late.ok, false, "tarde no cuenta aunque sea la correcta");

  for (const bad of [null, undefined, 5, "", "ZZ", "co", { a: 1 }]) {
    const r = applyAnswer(qs, [], bad, 100);
    eq([r.ok, r.answers[0].c], [false, null], `inválido ${JSON.stringify(bad)}`);
  }
});

Deno.test("el intento termina en la décima respuesta y no acepta más", () => {
  const qs = pickQuestions(FLAGS, seeded(5));
  let answers: Answer[] = [];
  for (let i = 0; i < QUESTIONS; i++) {
    const r = applyAnswer(qs, answers, qs[i].a, 1000);
    answers = r.answers;
    eq(r.done, i === QUESTIONS - 1, `done en la ${i + 1}`);
  }
  eq(summarize(answers), { correct: 10, timeMs: 10_000, suspect: false }, "resumen");
  let threw = false;
  try { applyAnswer(qs, answers, qs[0].a, 1000); } catch { threw = true; }
  assert(threw, "aceptó una respuesta de más");
});

Deno.test("velocidad no humana se marca para revisión, la normal no", () => {
  const mk = (n: number, ms: number): Answer[] => Array.from({ length: 10 }, (_, i) => ({ c: "XX", ok: i < n, ms }));
  eq(summarize(mk(10, 300)).suspect, true, "10 aciertos a 0,3 s");
  eq(summarize(mk(10, 1200)).suspect, false, "10 aciertos a 1,2 s");
  eq(summarize(mk(4, 200)).suspect, false, "pocos aciertos rápidos = tocar al azar, no revisar");
});

Deno.test("XP por intento y tope diario con los 2 mejores", () => {
  eq([0, 4, 5, 6, 7, 8, 9, 10].map(xpFor), [0, 0, 2, 2, 4, 4, 6, 6], "escala de XP");
  eq(dailyXp([]), 0, "sin intentos");
  eq(dailyXp([4]), 4, "un intento");
  eq(dailyXp([2, 6, 4]), 10, "se quedan los dos mejores");
  eq(dailyXp([6, 6, 6]), 12, "tope: el tercero no suma");
  eq(dailyXp([6, 6, 6, 6, 6]), 12, "tope aunque hubiera más filas");
});

Deno.test("ventanas de 8 horas en UTC", () => {
  const at = (h: number, m = 0) => new Date(Date.UTC(2026, 10, 16, h, m));
  eq([0, 7, 8, 15, 16, 23].map((h) => slotOf(at(h, 59))), [0, 0, 1, 1, 2, 2], "ventana por hora");
  eq(slotEnd(at(7, 59)).toISOString(), "2026-11-16T08:00:00.000Z", "fin de la primera");
  eq(slotEnd(at(23, 59)).toISOString(), "2026-11-17T00:00:00.000Z", "la última cierra a medianoche");
  eq(utcDay(at(23, 59)), 20261116, "día UTC");
});
