// Pruebas del flujo de Flag Rush con datos en memoria (sin Supabase ni red).
// Uso (desde supabase/functions/game/):  deno test rush_test.ts

import data from "../_shared/flags-data.json" with { type: "json" };
import { type Answer, ANSWER_MS, type Flag, type Question, VERDICT_MS } from "./rush-core.ts";
import { flagcdnImages, makeRush, type RushRow, type RushStore } from "./rush.ts";

const FLAGS = (data as { flags: Flag[] }).flags;
const ANA = "0x" + "a".repeat(40);
const BETO = "0x" + "b".repeat(40);
const SECRET = "secreto-de-ana-1234567890";

function assert(cond: unknown, msg: string): void {
  if (!cond) throw new Error(msg);
}
function eq<T>(got: T, want: T, msg: string): void {
  if (JSON.stringify(got) !== JSON.stringify(want)) throw new Error(`${msg}: ${JSON.stringify(got)} ≠ ${JSON.stringify(want)}`);
}

function seeded(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Mundo de prueba: tablas en memoria, reloj que se mueve a mano e imágenes falsas.
function world(opts: { sanctioned?: string[]; imageFails?: () => boolean } = {}) {
  const rows: (RushRow & { suspect?: boolean })[] = [];
  const xp = new Set<string>(); // "player|day|seq"
  const secrets: Record<string, string> = { [ANA]: SECRET, [BETO]: "secreto-de-beto-0987654321" };
  let t = Date.UTC(2026, 10, 16, 9, 0, 0); // 16-nov-2026 09:00 UTC → ventana 1
  let n = 0;
  const copy = <T>(x: T): T => JSON.parse(JSON.stringify(x));
  const store: RushStore = {
    checkSecret: async (p, s) => secrets[p] === s,
    isSanctioned: async (p) => (opts.sanctioned ?? []).includes(p),
    bySlot: async (p, d, s) => copy(rows.find((r) => r.player_id === p && r.day === d && r.slot === s) ?? null),
    byId: async (id) => copy(rows.find((r) => r.id === id) ?? null),
    staleOpen: async (p, d, s) => copy(rows.filter((r) => r.player_id === p && !r.finished_at && (r.day !== d || r.slot !== s))),
    create: async (p, d, s, questions: Question[], servedAt) => {
      if (rows.some((r) => r.player_id === p && r.day === d && r.slot === s)) return null;
      const id = `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
      rows.push({ id, player_id: p, day: d, slot: s, questions, answers: [], idx: 0, served_at: servedAt, finished_at: null, correct: null, time_ms: null, xp: 0 });
      return copy(rows.at(-1)!);
    },
    saveAnswer: async (id, idx, answers: Answer[], servedAt) => {
      const r = rows.find((x) => x.id === id);
      if (!r || r.idx !== idx || r.finished_at) return false;
      Object.assign(r, { answers, idx: idx + 1, served_at: servedAt });
      return true;
    },
    finish: async (id, f) => {
      const r = rows.find((x) => x.id === id);
      if (!r || r.finished_at) return false;
      Object.assign(r, f);
      return true;
    },
    dayAttempts: async (p, d) => copy(rows.filter((r) => r.player_id === p && r.day === d)),
    xpUnits: async (p, d) => [...xp].filter((k) => k.startsWith(`${p}|${d}|`)).length,
    grantUnits: async (p, d, from, to) => {
      let added = 0;
      for (let seq = from; seq <= to; seq++) {
        if (seq > 6) throw new Error("xp_shape: seq fuera del tope"); // lo que haría el check de la base
        const k = `${p}|${d}|${seq}`;
        if (!xp.has(k)) { xp.add(k); added++; }
      }
      return added;
    },
  };
  const handle = makeRush({
    store,
    flags: FLAGS,
    rand: seeded(42),
    image: async () => (opts.imageFails?.() ? null : "IMG"),
    now: () => new Date(t),
  });
  const call = async (action: string, body: Record<string, unknown>) => (await handle(action, body))!;
  // Juega un intento completo acertando las primeras `hits` banderas.
  async function play(player: string, secret: string, hits: number, msEach = 1500) {
    const s = await call("rush_start", { player, secret });
    if (!s.body.ok) return s;
    const id = s.body.sessionId as string;
    let last = s;
    for (let i = 0; i < 10; i++) {
      const row = rows.find((r) => r.id === id)!;
      const q = row.questions[i];
      t += msEach;
      last = await call("rush_answer", { sessionId: id, choice: i < hits ? q.a : q.o.find((o) => o !== q.a) });
    }
    return last;
  }
  return { rows, call, play, advance: (ms: number) => { t += ms; }, at: (iso: string) => { t = Date.parse(iso); } };
}

Deno.test("acciones que no son de Flag Rush se dejan pasar", async () => {
  const w = world();
  const handle = makeRush({ store: {} as RushStore, flags: FLAGS, rand: Math.random, image: async () => "IMG" });
  eq(await handle("xp_start", {}), null, "debe devolver null");
  eq((await w.call("rush_nada", {})).body.error, "bad_action", "acción desconocida");
});

Deno.test("empezar exige wallet válida y el secret del dispositivo", async () => {
  const w = world();
  eq((await w.call("rush_start", { player: "0x123", secret: SECRET })).body.error, "bad_player", "wallet inválida");
  const r = await w.call("rush_start", { player: BETO, secret: SECRET });
  eq([r.status, r.body.error], [403, "identity"], "secret de otro jugador");
  eq(w.rows.length, 0, "no debe crear intento");
});

Deno.test("la respuesta nunca viaja antes de contestar", async () => {
  const w = world();
  const s = await w.call("rush_start", { player: ANA, secret: SECRET });
  const q = s.body.question as Record<string, unknown>;
  eq(Object.keys(q).sort(), ["answerMs", "image", "index", "leftMs", "options", "total"], "campos de la pregunta");
  eq(Object.keys(s.body).sort(), ["nextSlotAt", "ok", "question", "results", "sessionId"], "campos de la respuesta");
  eq(s.body.results, [], "intento nuevo: nada contestado");
  eq(q.image, "IMG", "la imagen va como dato, no como dirección con el código");
  const row = w.rows[0];
  const a = await w.call("rush_answer", { sessionId: row.id, choice: row.questions[0].a });
  eq([a.body.correct, a.body.answer, a.body.done], [true, row.questions[0].a, false], "tras contestar sí se revela");
  eq(Object.keys(a.body.question as object).sort(), ["answerMs", "image", "index", "leftMs", "options", "total"], "siguiente pregunta sin respuesta");
});

Deno.test("intento perfecto: 10 de 10, 6 XP y la ventana queda usada", async () => {
  const w = world();
  const r = await w.play(ANA, SECRET, 10);
  const res = r.body.result as Record<string, unknown>;
  // La 1a bandera cuenta 1500 ms; las demás 1500 menos los 600 del veredicto.
  eq([r.body.done, res.correct, res.total, res.timeMs, res.xp, res.gained, res.xpToday, res.maxXpToday], [true, 10, 10, 1500 + 9 * (1500 - VERDICT_MS), 6, 6, 6, 12], "resultado");
  const again = await w.call("rush_start", { player: ANA, secret: SECRET });
  eq([again.status, again.body.error, again.body.nextSlotAt], [409, "played", "2026-11-16T16:00:00.000Z"], "segundo intento en la misma ventana");
  const extra = await w.call("rush_answer", { sessionId: w.rows[0].id, choice: "CO" });
  eq([extra.status, extra.body.error], [409, "finished"], "respuesta de más");
  const st = await w.call("rush_status", { player: ANA });
  eq([st.body.state, st.body.slot, st.body.xpToday], ["played", 1, 6], "estado");
});

Deno.test("tope diario: el tercer intento perfecto no suma", async () => {
  const w = world();
  w.at("2026-11-16T01:00:00Z");
  eq(((await w.play(ANA, SECRET, 10)).body.result as { gained: number }).gained, 6, "ventana 0");
  w.at("2026-11-16T09:00:00Z");
  eq(((await w.play(ANA, SECRET, 10)).body.result as { gained: number }).gained, 6, "ventana 1");
  w.at("2026-11-16T17:00:00Z");
  const third = (await w.play(ANA, SECRET, 10)).body.result as { gained: number; xpToday: number };
  eq([third.gained, third.xpToday], [0, 12], "ventana 2");
  w.at("2026-11-17T01:00:00Z");
  eq(((await w.play(ANA, SECRET, 10)).body.result as { gained: number }).gained, 6, "al día siguiente vuelve a sumar");
});

Deno.test("cuentan los dos mejores: un intento mejor reemplaza al peor", async () => {
  const w = world();
  w.at("2026-11-16T01:00:00Z");
  const a = (await w.play(ANA, SECRET, 5)).body.result as { xp: number; gained: number; xpToday: number };
  eq([a.xp, a.gained, a.xpToday], [2, 2, 2], "5 aciertos");
  w.at("2026-11-16T09:00:00Z");
  const b = (await w.play(ANA, SECRET, 10)).body.result as { xp: number; gained: number; xpToday: number };
  eq([b.xp, b.gained, b.xpToday], [6, 6, 8], "10 aciertos");
  w.at("2026-11-16T17:00:00Z");
  const c = (await w.play(ANA, SECRET, 7)).body.result as { xp: number; gained: number; xpToday: number };
  eq([c.xp, c.gained, c.xpToday], [4, 2, 10], "7 aciertos reemplazan al de 5: solo suma la diferencia");
});

Deno.test("pocos aciertos no dan XP", async () => {
  const w = world();
  const r = (await w.play(ANA, SECRET, 4)).body.result as { correct: number; xp: number; gained: number };
  eq([r.correct, r.xp, r.gained], [4, 0, 0], "4 aciertos");
});

Deno.test("una respuesta tardía cuenta como fallo aunque sea la correcta", async () => {
  const w = world();
  await w.call("rush_start", { player: ANA, secret: SECRET });
  const row = w.rows[0];
  w.advance(ANSWER_MS + 2001);
  const a = await w.call("rush_answer", { sessionId: row.id, choice: row.questions[0].a });
  eq([a.body.correct, a.body.answer], [false, row.questions[0].a], "tarde");
});

Deno.test("salir con una bandera en pantalla la cuenta como fallo", async () => {
  const w = world();
  const first = await w.call("rush_start", { player: ANA, secret: SECRET });
  // Mira la bandera 4 s, sale a buscarla y vuelve con tiempo de sobra.
  w.advance(4000);
  const back = await w.call("rush_start", { player: ANA, secret: SECRET });
  const q = back.body.question as { index: number; leftMs: number };
  eq([back.body.sessionId, back.body.left, q.index, q.leftMs], [first.body.sessionId, true, 1, ANSWER_MS], "pasa a la siguiente");
  eq([back.body.results, w.rows[0].answers[0]], [[false], { c: null, ok: false, ms: 4000 }], "la que vio quedó como fallo");
  // Igual si tarda más que el plazo.
  w.advance(20_000);
  const late = await w.call("rush_start", { player: ANA, secret: SECRET });
  const q2 = late.body.question as { index: number };
  eq([late.body.left, q2.index, late.body.results], [true, 2, [false, false]], "otra salida, otro fallo");
});

Deno.test("un reintento de red inmediato no cuenta como salida", async () => {
  const w = world();
  const first = await w.call("rush_start", { player: ANA, secret: SECRET });
  w.advance(1000); // la respuesta se perdió y la pantalla vuelve a pedir
  const again = await w.call("rush_start", { player: ANA, secret: SECRET });
  const q = again.body.question as { index: number; leftMs: number };
  eq([again.body.sessionId, again.body.left, q.index, q.leftMs, again.body.results], [first.body.sessionId, false, 0, 9000, []], "misma bandera, con su tiempo");
});

Deno.test("un intento abandonado se cierra solo en la ventana siguiente", async () => {
  const w = world();
  w.at("2026-11-16T01:00:00Z");
  await w.call("rush_start", { player: ANA, secret: SECRET });
  const row = w.rows[0];
  for (let i = 0; i < 6; i++) { w.advance(1500); await w.call("rush_answer", { sessionId: row.id, choice: row.questions[i].a }); }
  w.at("2026-11-16T09:00:00Z");
  const st = await w.call("rush_status", { player: ANA });
  eq([st.body.state, st.body.attempts, st.body.xpToday], ["none", [{ slot: 0, correct: 6, timeMs: 1500 + 5 * (1500 - VERDICT_MS), xp: 2 }], 2], "cerrado con lo que llevaba");
});

Deno.test("una cuenta sancionada juega pero no suma XP", async () => {
  const w = world({ sanctioned: [ANA] });
  const r = (await w.play(ANA, SECRET, 10)).body.result as { correct: number; xp: number; gained: number };
  eq([r.correct, r.xp, r.gained], [10, 0, 0], "sancionada");
});

Deno.test("si la imagen falla no se pierde el intento ni la respuesta", async () => {
  let fails = true;
  const w = world({ imageFails: () => fails });
  const s = await w.call("rush_start", { player: ANA, secret: SECRET });
  eq([s.status, s.body.error, w.rows.length], [503, "image_unavailable", 0], "sin imagen no se abre el intento");
  fails = false;
  await w.call("rush_start", { player: ANA, secret: SECRET });
  const row = w.rows[0];
  fails = true;
  const a = await w.call("rush_answer", { sessionId: row.id, choice: row.questions[0].a });
  eq([a.status, w.rows[0].idx], [503, 0], "la respuesta no se registra");
  fails = false;
  const b = await w.call("rush_answer", { sessionId: row.id, choice: row.questions[0].a });
  eq([b.body.correct, w.rows[0].idx], [true, 1], "al reintentar sí");
});

Deno.test("dos jugadores reciben sets distintos", async () => {
  const w = world();
  await w.call("rush_start", { player: ANA, secret: SECRET });
  await w.call("rush_start", { player: BETO, secret: "secreto-de-beto-0987654321" });
  assert(w.rows[0].questions.map((q) => q.a).join() !== w.rows[1].questions.map((q) => q.a).join(), "mismo set");
});

Deno.test("el veredicto en pantalla no le resta tiempo al jugador", async () => {
  const w = world();
  await w.call("rush_start", { player: ANA, secret: SECRET });
  const row = w.rows[0];
  w.advance(1000);
  const a = await w.call("rush_answer", { sessionId: row.id, choice: row.questions[0].a });
  const q = a.body.question as { leftMs: number };
  eq(q.leftMs, ANSWER_MS + VERDICT_MS, "la siguiente trae sus 10 s más la pausa");
  // La ve al terminar el veredicto y contesta a los 10 s exactos: vale.
  w.advance(VERDICT_MS + ANSWER_MS);
  const b = await w.call("rush_answer", { sessionId: row.id, choice: row.questions[1].a });
  eq([b.body.correct, w.rows[0].answers[1].ms], [true, ANSWER_MS], "a tiempo, contado desde que la vio");
});

Deno.test("la misma bandera nunca llega con los mismos bytes", async () => {
  const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 6, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 1, 2]);
  const fakeFetch = (() => Promise.resolve(new Response(webp))) as unknown as typeof fetch;
  const img = flagcdnImages(fakeFetch);
  const a = await img("co");
  const b = await img("co");
  if (!a || !b) throw new Error("sin imagen");
  if (a === b) throw new Error("misma imagen dos veces");
  const bytes = Uint8Array.from(atob(a.split(",")[1]), (c) => c.charCodeAt(0));
  const riff = new DataView(bytes.buffer).getUint32(4, true);
  if (riff !== bytes.length - 8) throw new Error("tamaño RIFF mal corregido");
  // Lo original sigue intacto al principio (salvo el tamaño del RIFF).
  if (bytes.subarray(8, 14).join() !== webp.subarray(8).join()) throw new Error("contenido alterado");
});
