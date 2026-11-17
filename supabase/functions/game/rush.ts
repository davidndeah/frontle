// ============================================================
//  Frontle — Flag Rush, acciones de la función `game`
//
//  10 banderas con 4 opciones, un intento por ventana de 8 h (UTC). Mismo
//  principio que el reto diario en el servidor: aquí se eligen las banderas,
//  aquí corre el reloj y aquí se decide si la respuesta es correcta. El
//  cliente recibe UNA bandera a la vez, como imagen sin el código del país,
//  y solo se entera de la respuesta después de contestar. Ver rush-core.ts
//  (reglas) y la migración 0034.
//
//   · rush_status {player}
//       Ventana en curso, intentos de hoy y XP del día. No pide secret:
//       solo devuelve conteos.
//   · rush_start {player, secret}
//       Abre el intento de la ventana (o lo retoma si quedó a medias) y
//       entrega la bandera en curso, más `results` (acierto o fallo de las
//       ya contestadas, para pintar el progreso al retomar). Exige el secret de gasto
//       (lib/secret.ts): nadie le gasta la ventana a otra wallet.
//   · rush_answer {sessionId, choice}
//       Califica la bandera en curso con el reloj del servidor y entrega la
//       siguiente, o el resultado al terminar. El sessionId solo lo conoce
//       quien abrió el intento.
//
//  XP (suma a la liga semanal, que paga USDT, así que va con tope): los 2
//  mejores intentos del día, hasta 6 XP cada uno. Nada para sancionados.
//  Sin ranking ni premio propio.
//
//  Pendiente (PLAN-FLAG-RUSH.md, S4): comprobar aquí el teléfono verificado.
//  Hoy lo comprueban los cierres antes de pagar.
// ============================================================

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  type Answer,
  ANSWER_MS,
  applyAnswer,
  dailyXp,
  type Flag,
  GRACE_MS,
  VERDICT_MS,
  pickQuestions,
  publicQuestion,
  type Question,
  QUESTIONS,
  slotEnd,
  slotOf,
  summarize,
  utcDay,
  XP_UNIT,
  XP_UNITS_PER_DAY,
  xpFor,
} from "./rush-core.ts";

const WALLET = /^0x[0-9a-f]{40}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export interface RushRow {
  id: string;
  player_id: string;
  day: number;
  slot: number;
  questions: Question[];
  answers: Answer[];
  idx: number; // respuestas ya dadas (= índice de la bandera en curso)
  served_at: string; // cuándo se entregó la bandera en curso
  finished_at: string | null;
  correct: number | null;
  time_ms: number | null;
  xp: number;
}

// Todo el acceso a datos de Flag Rush. En producción lo implementa
// supabaseStore; las pruebas (rush_test.ts) usan una versión en memoria.
export interface RushStore {
  checkSecret(player: string, secret: string): Promise<boolean>;
  isSanctioned(player: string): Promise<boolean>;
  bySlot(player: string, day: number, slot: number): Promise<RushRow | null>;
  byId(id: string): Promise<RushRow | null>;
  // Intentos sin cerrar de ventanas anteriores (el jugador se fue a medias).
  staleOpen(player: string, day: number, slot: number): Promise<RushRow[]>;
  // null si ya existía un intento en esa ventana (lo impide un índice único).
  create(player: string, day: number, slot: number, questions: Question[], servedAt: string): Promise<RushRow | null>;
  // false si otra petición ya avanzó el intento (se compara `idx`).
  saveAnswer(id: string, idx: number, answers: Answer[], servedAt: string): Promise<boolean>;
  // false si ya estaba cerrado.
  finish(id: string, r: { correct: number; time_ms: number; xp: number; suspect: boolean; finished_at: string }): Promise<boolean>;
  dayAttempts(player: string, day: number): Promise<RushRow[]>;
  xpUnits(player: string, day: number): Promise<number>;
  // Otorga las unidades [from, to] del día; devuelve cuántas eran nuevas.
  grantUnits(player: string, day: number, from: number, to: number): Promise<number>;
}

export interface RushDeps {
  store: RushStore;
  flags: readonly Flag[];
  rand: () => number;
  // Imagen de la bandera lista para un <img> (data URL), o null si falló.
  image: (code: string) => Promise<string | null>;
  now?: () => Date;
}

type Reply = { status: number; body: Record<string, unknown> };

export function makeRush({ store, flags, rand, image, now = () => new Date() }: RushDeps) {
  const ok = (body: Record<string, unknown>): Reply => ({ status: 200, body: { ok: true, ...body } });
  const fail = (error: string, status = 400, extra: Record<string, unknown> = {}): Reply => ({ status, body: { ok: false, error, ...extra } });

  // XP del día según los intentos cerrados; otorga lo que falte. Devuelve
  // el XP nuevo. El tope lo garantiza además la clave de xp_events.
  async function settleXp(player: string, day: number): Promise<number> {
    const attempts = await store.dayAttempts(player, day);
    const target = Math.min(XP_UNITS_PER_DAY, dailyXp(attempts.filter((a) => a.finished_at).map((a) => a.xp)) / XP_UNIT);
    const have = await store.xpUnits(player, day);
    if (target <= have) return 0;
    return (await store.grantUnits(player, day, have + 1, target)) * XP_UNIT;
  }

  // Cierra un intento con las respuestas que tenga (las que falten son fallos).
  async function finalize(row: RushRow, answers: Answer[]) {
    const s = summarize(answers);
    const xp = (await store.isSanctioned(row.player_id)) ? 0 : xpFor(s.correct);
    const closed = await store.finish(row.id, { correct: s.correct, time_ms: s.timeMs, xp, suspect: s.suspect, finished_at: now().toISOString() });
    const gained = closed ? await settleXp(row.player_id, row.day) : 0;
    return { correct: s.correct, total: row.questions.length, timeMs: s.timeMs, xp, gained };
  }

  async function closeStale(player: string, day: number, slot: number) {
    for (const row of await store.staleOpen(player, day, slot)) await finalize(row, row.answers);
  }

  async function dayState(player: string, day: number) {
    const attempts = (await store.dayAttempts(player, day)).filter((a) => a.finished_at);
    return {
      attempts: attempts.map((a) => ({ slot: a.slot, correct: a.correct ?? 0, timeMs: a.time_ms ?? 0, xp: a.xp })),
      xpToday: (await store.xpUnits(player, day)) * XP_UNIT,
      maxXpToday: XP_UNIT * XP_UNITS_PER_DAY,
    };
  }

  return async function handle(action: string, body: Record<string, unknown>): Promise<Reply | null> {
    if (!action.startsWith("rush_")) return null;
    const at = now();
    const day = utcDay(at);
    const slot = slotOf(at);
    const nextSlotAt = slotEnd(at).toISOString();

    if (action === "rush_status") {
      const player = String(body.player ?? "").toLowerCase();
      if (!WALLET.test(player)) return fail("bad_player");
      await closeStale(player, day, slot);
      const current = await store.bySlot(player, day, slot);
      return ok({
        day,
        slot,
        nextSlotAt,
        // "none" = puede jugar · "open" = intento a medias · "played" = ya jugó esta ventana
        state: !current ? "none" : current.finished_at ? "played" : "open",
        total: QUESTIONS,
        answerMs: ANSWER_MS,
        ...(await dayState(player, day)),
      });
    }

    if (action === "rush_start") {
      const player = String(body.player ?? "").toLowerCase();
      if (!WALLET.test(player)) return fail("bad_player");
      if (!(await store.checkSecret(player, String(body.secret ?? "")))) return fail("identity", 403);
      await closeStale(player, day, slot);

      let row = await store.bySlot(player, day, slot);
      if (row?.finished_at) return fail("played", 409, { nextSlotAt });

      if (!row) {
        const questions = pickQuestions(flags, rand);
        const img = await image(questions[0].a);
        if (!img) return fail("image_unavailable", 503);
        row = await store.create(player, day, slot, questions, now().toISOString());
        // Dos peticiones a la vez: la segunda retoma el intento de la primera.
        if (!row) row = await store.bySlot(player, day, slot);
        if (!row) return fail("try_again", 409);
        if (row.finished_at) return fail("played", 409, { nextSlotAt });
        if (row.idx === 0 && row.questions[0].a === questions[0].a) {
          return ok({ sessionId: row.id, question: { ...publicQuestion(row.questions, 0), image: img, answerMs: ANSWER_MS, leftMs: ANSWER_MS }, results: [], nextSlotAt });
        }
      }

      // Retoma. Si la bandera en curso ya venció mientras no estaba, cuenta
      // como fallo y sigue con la siguiente: salir no congela el reloj.
      let elapsed = now().getTime() - new Date(row.served_at).getTime();
      if (elapsed > ANSWER_MS + GRACE_MS) {
        const r = applyAnswer(row.questions, row.answers, null, elapsed);
        const servedAt = now().toISOString();
        if (!(await store.saveAnswer(row.id, row.idx, r.answers, servedAt))) return fail("try_again", 409);
        row = { ...row, answers: r.answers, idx: row.idx + 1, served_at: servedAt };
        if (r.done) return ok({ sessionId: row.id, done: true, result: { ...(await finalize(row, r.answers)), ...(await dayState(player, day)) }, nextSlotAt });
        elapsed = 0;
      }
      const img = await image(row.questions[row.idx].a);
      if (!img) return fail("image_unavailable", 503);
      return ok({
        sessionId: row.id,
        question: { ...publicQuestion(row.questions, row.idx), image: img, answerMs: ANSWER_MS, leftMs: Math.max(0, ANSWER_MS - elapsed) },
        // Al retomar, cómo le fue en las banderas ya contestadas (solo
        // acierto o fallo: el jugador ya vio esos veredictos).
        results: row.answers.map((a) => a.ok),
        nextSlotAt,
      });
    }

    if (action === "rush_answer") {
      const id = String(body.sessionId ?? "");
      if (!UUID.test(id)) return fail("bad_session");
      const row = await store.byId(id);
      if (!row) return fail("bad_session", 404);
      if (row.finished_at) return fail("finished", 409);

      const elapsed = now().getTime() - new Date(row.served_at).getTime();
      const r = applyAnswer(row.questions, row.answers, body.choice, elapsed);
      // La imagen siguiente se busca ANTES de guardar: si falla, la respuesta
      // no queda registrada y el cliente puede reintentar.
      const nextImg = r.done ? null : await image(row.questions[row.idx + 1].a);
      if (!r.done && !nextImg) return fail("image_unavailable", 503);
      // La siguiente bandera se da por entregada cuando termina el veredicto
      // en pantalla, no ahora: así la pausa no le resta tiempo al jugador.
      const nextServedAt = new Date(now().getTime() + (r.done ? 0 : VERDICT_MS)).toISOString();
      if (!(await store.saveAnswer(id, row.idx, r.answers, nextServedAt))) return fail("stale", 409);

      const verdict = { correct: r.ok, answer: r.answer };
      if (r.done) {
        const result = await finalize({ ...row, answers: r.answers, idx: row.idx + 1 }, r.answers);
        return ok({ ...verdict, done: true, result: { ...result, ...(await dayState(row.player_id, row.day)) }, nextSlotAt });
      }
      return ok({
        ...verdict,
        done: false,
        // leftMs se cuenta desde ahora e incluye la pausa del veredicto.
        question: { ...publicQuestion(row.questions, row.idx + 1), image: nextImg, answerMs: ANSWER_MS, leftMs: ANSWER_MS + VERDICT_MS },
      });
    }

    return fail("bad_action");
  };
}

// --- Producción: datos en Supabase (service role) e imágenes de flagcdn ------

export function supabaseStore(supabase: SupabaseClient): RushStore {
  const COLS = "id, player_id, day, slot, questions, answers, idx, served_at, finished_at, correct, time_ms, xp";
  return {
    async checkSecret(player, secret) {
      const { data, error } = await supabase.rpc("check_secret", { p_player: player, p_secret: secret });
      return !error && data === true;
    },
    async isSanctioned(player) {
      const { data, error } = await supabase.from("account_reviews").select("until").eq("player_id", player).eq("block_prizes", true);
      if (error) throw error;
      const t = Date.now();
      return (data ?? []).some((a) => !a.until || new Date(a.until as string).getTime() > t);
    },
    async bySlot(player, day, slot) {
      const { data, error } = await supabase.from("rush_sessions").select(COLS).eq("player_id", player).eq("day", day).eq("slot", slot).maybeSingle();
      if (error) throw error;
      return (data as RushRow | null) ?? null;
    },
    async byId(id) {
      const { data, error } = await supabase.from("rush_sessions").select(COLS).eq("id", id).maybeSingle();
      if (error) throw error;
      return (data as RushRow | null) ?? null;
    },
    async staleOpen(player, day, slot) {
      const { data, error } = await supabase.from("rush_sessions").select(COLS).eq("player_id", player).is("finished_at", null);
      if (error) throw error;
      return ((data ?? []) as RushRow[]).filter((r) => r.day !== day || r.slot !== slot);
    },
    async create(player, day, slot, questions, servedAt) {
      const { data, error } = await supabase
        .from("rush_sessions")
        .insert({ player_id: player, day, slot, questions, served_at: servedAt })
        .select(COLS)
        .maybeSingle();
      if (error) {
        if (error.code === "23505") return null; // ya había intento en esta ventana
        throw error;
      }
      return (data as RushRow | null) ?? null;
    },
    async saveAnswer(id, idx, answers, servedAt) {
      const { data, error } = await supabase
        .from("rush_sessions")
        .update({ answers, idx: idx + 1, served_at: servedAt })
        .eq("id", id)
        .eq("idx", idx)
        .is("finished_at", null)
        .select("id");
      if (error) throw error;
      return (data ?? []).length === 1;
    },
    async finish(id, r) {
      const { data, error } = await supabase.from("rush_sessions").update(r).eq("id", id).is("finished_at", null).select("id");
      if (error) throw error;
      return (data ?? []).length === 1;
    },
    async dayAttempts(player, day) {
      const { data, error } = await supabase.from("rush_sessions").select(COLS).eq("player_id", player).eq("day", day).order("slot");
      if (error) throw error;
      return (data ?? []) as RushRow[];
    },
    async xpUnits(player, day) {
      const { count, error } = await supabase
        .from("xp_events")
        .select("seq", { count: "exact", head: true })
        .eq("player_id", player).eq("day", day).eq("source", "flag_rush");
      if (error) throw error;
      return count ?? 0;
    },
    async grantUnits(player, day, from, to) {
      const rows = [];
      for (let seq = from; seq <= to; seq++) rows.push({ player_id: player, day, source: "flag_rush", level: "-", seq, xp: XP_UNIT });
      const { data, error } = await supabase
        .from("xp_events")
        .upsert(rows, { onConflict: "player_id,day,source,level,seq", ignoreDuplicates: true })
        .select("seq");
      if (error) throw error;
      return (data ?? []).length;
    },
  };
}

// Bandera como data URL. Se baja de flagcdn en el servidor y se guarda en
// memoria: así el cliente nunca ve una dirección con el código del país.
export function flagcdnImages(fetchImpl: typeof fetch = fetch): (code: string) => Promise<string | null> {
  const cache = new Map<string, string>();
  return async (code) => {
    const hit = cache.get(code);
    if (hit) return hit;
    try {
      const r = await fetchImpl(`https://flagcdn.com/w320/${code.toLowerCase()}.webp`);
      if (!r.ok) return null;
      const bytes = new Uint8Array(await r.arrayBuffer());
      let bin = "";
      for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      const url = `data:image/webp;base64,${btoa(bin)}`;
      cache.set(code, url);
      return url;
    } catch {
      return null;
    }
  };
}
