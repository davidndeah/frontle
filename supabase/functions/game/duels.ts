// ============================================================
//  Frontle — Duelos (1 contra 1), acciones de la función `game`
//
//  Mismo principio que el reto diario en el servidor: el reto lo genera el
//  servidor y no se revela hasta que cada jugador empieza, el reloj es el del
//  servidor y la cadena se revalida contra el grafo. Ver la migración 0033.
//
//  Todas las acciones exigen {player, secret}: el secret de gasto
//  (lib/secret.ts) prueba que la petición viene del dispositivo del jugador,
//  así nadie juega ni reclama duelos con la wallet de otro.
//
//   · duel_players {q?}          → jugadores para retar (búsqueda por alias
//                                   o, sin búsqueda, los activos recientes)
//   · duel_create {level, rival?, name?} → crea el duelo y revela el reto al
//                                   retador; su reloj arranca aquí
//   · duel_start {id}            → revela el reto (retador que retoma, o
//                                   rival que empieza; su reloj arranca aquí)
//   · duel_finish {id, chain, hints} → marca del retador (envía el duelo) o
//                                   del rival (cierra el duelo con ganador)
//   · duel_claim {code, name?}   → el rival entra con el código del duelo
//   · duel_shared {id}           → el retador compartió el link (embudo)
//   · duel_list                  → mis duelos de los últimos 30 días
// ============================================================

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { LEVELS, type Level } from "../_shared/engine.ts";

type Engine = {
  generate: (level: Level, rand: () => number) => { start: string; end: string; optimal: number; path: string[] };
  replay: (start: string, end: string, chain: string[]) => { ok: true; countries: number } | { ok: false; reason: string };
};

const DUEL_TTL_MS = 24 * 3600 * 1000; // plazo del rival desde que se envía
const DUEL_PLAY_MS = 3600 * 1000; // quien empezó antes del vencimiento tiene 1 h para terminar
const DUEL_HINT_MS = 15_000; // cada pista suma 15 s a la marca
const DUEL_MAX_HINTS = 10;
const DUELS_PER_DAY = 20; // duelos creados por jugador en 24 h
const MIN_TIME_MS = 2000;
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sin 0/O/1/I
const WALLET = /^0x[0-9a-f]{40}$/;

type Row = Record<string, unknown> & {
  id: string;
  code: string;
  level: Level;
  start_country: string;
  end_country: string;
  optimal: number;
  challenger_id: string;
  challenger_name: string | null;
  challenger_started_at: string;
  challenger_countries: number | null;
  challenger_time_ms: number | null;
  challenger_hints: number;
  sent_at: string | null;
  expires_at: string | null;
  rival_id: string | null;
  rival_name: string | null;
  claimed_at: string | null;
  rival_started_at: string | null;
  rival_countries: number | null;
  rival_time_ms: number | null;
  rival_hints: number;
  finished_at: string | null;
  winner: "challenger" | "rival" | "tie" | null;
  created_at: string;
};

export type DuelStatus = "playing" | "open" | "started" | "finished" | "expired";

function cleanName(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim().slice(0, 16) : null;
}

function newCode(): string {
  const b = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(b, (x) => CODE_ALPHABET[x % CODE_ALPHABET.length]).join("");
}

// Mismo orden que el ranking diario: menos países gana; a igualdad, menos tiempo.
function winnerOf(c: { countries: number; timeMs: number }, r: { countries: number; timeMs: number }) {
  if (c.countries !== r.countries) return c.countries < r.countries ? "challenger" : "rival";
  if (c.timeMs !== r.timeMs) return c.timeMs < r.timeMs ? "challenger" : "rival";
  return "tie";
}

// ¿El rival todavía puede jugar/terminar? Hasta el vencimiento; y si empezó
// antes de vencer, 1 h desde que empezó (no se le corta la partida).
function rivalDeadline(d: Row): number {
  const exp = d.expires_at ? new Date(d.expires_at).getTime() : 0;
  if (!d.rival_started_at) return exp;
  const started = new Date(d.rival_started_at).getTime();
  return started <= exp ? Math.max(exp, started + DUEL_PLAY_MS) : exp;
}

function statusOf(d: Row, now = Date.now()): DuelStatus {
  if (d.finished_at) return "finished";
  if (!d.sent_at) return "playing";
  if (now > rivalDeadline(d)) return "expired";
  return d.rival_started_at ? "started" : "open";
}

// Lo que ve `me` de un duelo. El reto (países) NO va aquí: solo sale al
// empezar, para que nadie lo prepare antes de que corra su reloj.
function view(d: Row, me: string) {
  const role = d.challenger_id === me ? "challenger" : "rival";
  const status = statusOf(d);
  const challenger = d.challenger_countries != null
    ? { countries: d.challenger_countries, timeMs: d.challenger_time_ms, hints: d.challenger_hints }
    : null;
  const rival = d.finished_at
    ? { countries: d.rival_countries, timeMs: d.rival_time_ms, hints: d.rival_hints }
    : null;
  const w = d.winner;
  return {
    id: d.id,
    level: d.level,
    role,
    status,
    // El código solo lo ve quien retó (es la llave para entrar al duelo).
    code: role === "challenger" ? d.code : null,
    opponentName: role === "challenger" ? d.rival_name : d.challenger_name,
    // Para la revancha. La wallet ya es pública en el ranking.
    opponentId: role === "challenger" ? d.rival_id : d.challenger_id,
    hasOpponent: role === "challenger" ? Boolean(d.rival_id) : true,
    mine: role === "challenger" ? challenger : rival,
    theirs: role === "challenger" ? rival : challenger,
    result: !w ? null : w === "tie" ? "tie" : w === role ? "win" : "lose",
    optimal: status === "finished" || status === "expired" ? d.optimal : null,
    createdAt: d.created_at,
    expiresAt: d.expires_at,
  };
}

export function makeDuels(supabase: SupabaseClient, E: Engine, rand: () => number) {
  const ok = (body: Record<string, unknown>) => ({ status: 200, body: { ok: true, ...body } });
  const fail = (error: string, status = 400) => ({ status, body: { ok: false, error } });

  async function identity(body: Record<string, unknown>): Promise<string | null> {
    const player = String(body.player ?? "").toLowerCase();
    if (!WALLET.test(player)) return null;
    const { data, error } = await supabase.rpc("check_secret", { p_player: player, p_secret: String(body.secret ?? "") });
    return !error && data === true ? player : null;
  }

  // Deja el alias del jugador en player_names si aún no tiene (no pisa uno
  // existente: el plazo de cambio de nombre de 0022 sigue mandando).
  async function rememberName(player: string, name: string | null) {
    if (!name) return;
    await supabase.from("player_names").upsert({ player_id: player, name }, { onConflict: "player_id", ignoreDuplicates: true });
  }

  async function nameOf(player: string): Promise<string | null> {
    const { data } = await supabase.from("player_names").select("name").eq("player_id", player).maybeSingle();
    return (data?.name as string | undefined) ?? null;
  }

  async function load(id: string): Promise<Row | null> {
    if (!/^[0-9a-f-]{36}$/.test(id)) return null;
    const { data, error } = await supabase.from("duels").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return (data as Row | null) ?? null;
  }

  async function sanctioned(ids: string[]): Promise<Set<string>> {
    if (ids.length === 0) return new Set();
    const { data } = await supabase
      .from("account_reviews")
      .select("player_id, until")
      .in("player_id", ids)
      .eq("block_prizes", true);
    const now = Date.now();
    return new Set((data ?? []).filter((a) => !a.until || new Date(a.until).getTime() > now).map((a) => a.player_id as string));
  }

  const reveal = (d: Row, me: string, startedAt: string) => ({
    duel: view(d, me),
    challenge: { start: d.start_country, end: d.end_country, optimal: d.optimal },
    startedAt,
    serverNow: new Date().toISOString(),
  });

  // Devuelve null si la acción no es de duelos.
  return async function handle(action: string, body: Record<string, unknown>) {
    if (!action.startsWith("duel_")) return null;
    const me = await identity(body);
    if (!me) return fail("identity", 403);

    if (action === "duel_players") {
      const q = String(body.q ?? "").trim().slice(0, 16);
      let rows: { player_id: string; name: string }[] = [];
      if (q.length >= 2) {
        const pattern = `${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
        const { data, error } = await supabase.from("player_names").select("player_id, name").ilike("name", pattern).limit(25);
        if (error) throw error;
        rows = (data ?? []) as typeof rows;
      } else {
        // Sin búsqueda: quienes jugaron el diario en la última semana, con nombre.
        const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
        const { data, error } = await supabase
          .from("scores")
          .select("player_id, name, created_at")
          .gte("created_at", since)
          .not("name", "is", null)
          .order("created_at", { ascending: false })
          .limit(300);
        if (error) throw error;
        const seen = new Set<string>();
        for (const s of data ?? []) {
          const id = String(s.player_id ?? "").toLowerCase();
          if (!WALLET.test(id) || seen.has(id)) continue;
          seen.add(id);
          rows.push({ player_id: id, name: String(s.name) });
          if (rows.length >= 40) break;
        }
      }
      rows = rows.filter((r) => r.player_id !== me);
      const hidden = await sanctioned(rows.map((r) => r.player_id));
      const players = rows.filter((r) => !hidden.has(r.player_id)).slice(0, 20).map((r) => ({ id: r.player_id, name: r.name }));
      return ok({ players });
    }

    if (action === "duel_create") {
      const level = String(body.level ?? "") as Level;
      if (!LEVELS.includes(level)) return fail("bad_level");
      const rivalIn = body.rival == null || body.rival === "" ? null : String(body.rival).toLowerCase();
      if (rivalIn !== null && (!WALLET.test(rivalIn) || rivalIn === me)) return fail("bad_rival");
      // El rival tiene que ser un jugador real de la app: con nombre, o con
      // identidad ligada (p. ej. alguien sin alias que entró por código y
      // ahora recibe la revancha).
      const rivalName = rivalIn ? await nameOf(rivalIn) : null;
      if (rivalIn && !rivalName) {
        const { data: known } = await supabase.from("player_secrets").select("player_id").eq("player_id", rivalIn).maybeSingle();
        if (!known) return fail("bad_rival");
      }
      const since = new Date(Date.now() - 86_400_000).toISOString();
      const { count } = await supabase
        .from("duels")
        .select("id", { count: "exact", head: true })
        .eq("challenger_id", me)
        .gte("created_at", since);
      if ((count ?? 0) >= DUELS_PER_DAY) return fail("too_many_duels", 429);

      const name = cleanName(body.name);
      await rememberName(me, name);
      const c = E.generate(level, rand);
      for (let attempt = 0; attempt < 4; attempt++) {
        const { data, error } = await supabase
          .from("duels")
          .insert({
            code: newCode(),
            level,
            start_country: c.start,
            end_country: c.end,
            optimal: c.optimal,
            challenger_id: me,
            challenger_name: name ?? (await nameOf(me)),
            rival_id: rivalIn,
            rival_name: rivalName,
          })
          .select("*")
          .single();
        if (!error) return ok(reveal(data as Row, me, (data as Row).challenger_started_at));
        if (String(error.code) !== "23505") throw error; // choque de código: otro intento
      }
      throw new Error("duel_code");
    }

    if (action === "duel_claim") {
      const code = String(body.code ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
      if (!/^[A-HJ-NP-Z2-9]{6}$/.test(code)) return fail("bad_code");
      const { data, error } = await supabase.from("duels").select("*").eq("code", code).maybeSingle();
      if (error) throw error;
      let d = data as Row | null;
      if (!d || !d.sent_at) return fail("bad_code", 404);
      if (d.challenger_id === me) return fail("own_duel", 409);
      const st = statusOf(d);
      if (st === "expired") return fail("expired", 410);
      if (d.rival_id && d.rival_id !== me) return fail("taken", 409);
      if (!d.rival_id) {
        const name = cleanName(body.name);
        await rememberName(me, name);
        const { data: up, error: upErr } = await supabase
          .from("duels")
          .update({ rival_id: me, rival_name: name ?? (await nameOf(me)), claimed_at: new Date().toISOString() })
          .eq("id", d.id)
          .is("rival_id", null)
          .select("*");
        if (upErr) throw upErr;
        if (!up || up.length === 0) return fail("taken", 409); // otro entró primero
        d = up[0] as Row;
      }
      return ok({ duel: view(d, me) });
    }

    if (action === "duel_start") {
      const d = await load(String(body.id ?? ""));
      if (!d || (d.challenger_id !== me && d.rival_id !== me)) return fail("bad_duel", 404);
      if (d.challenger_id === me) {
        if (d.sent_at) return fail("already_sent", 409);
        return ok(reveal(d, me, d.challenger_started_at));
      }
      if (!d.sent_at) return fail("not_ready", 409);
      if (d.finished_at) return fail("finished", 409);
      if (statusOf(d) === "expired") return fail("expired", 410);
      if (d.rival_started_at) return ok(reveal(d, me, d.rival_started_at));
      const now = new Date().toISOString();
      const { data: up, error } = await supabase
        .from("duels")
        .update({ rival_started_at: now, claimed_at: d.claimed_at ?? now })
        .eq("id", d.id)
        .is("rival_started_at", null)
        .select("*");
      if (error) throw error;
      const row = (up && up[0] ? up[0] : await load(d.id)) as Row;
      return ok(reveal(row, me, row.rival_started_at ?? now));
    }

    if (action === "duel_finish") {
      const d = await load(String(body.id ?? ""));
      if (!d || (d.challenger_id !== me && d.rival_id !== me)) return fail("bad_duel", 404);
      const chain: string[] = Array.isArray(body.chain) ? body.chain.map(String) : [];
      const hints = Math.max(0, Math.min(DUEL_MAX_HINTS, Math.floor(Number(body.hints) || 0)));
      const isChallenger = d.challenger_id === me;
      // Idempotente: reenviar el cierre devuelve el duelo como quedó.
      if (isChallenger ? d.sent_at : d.finished_at) return ok({ duel: view(d, me), already: true });
      const startedAt = isChallenger ? d.challenger_started_at : d.rival_started_at;
      if (!startedAt) return fail("not_started", 409);
      if (!isChallenger && Date.now() > rivalDeadline(d)) return fail("expired", 410);

      const r = E.replay(d.start_country, d.end_country, chain);
      if (!r.ok) return fail(r.reason, 422);
      const playedMs = Date.now() - new Date(startedAt).getTime();
      if (playedMs < MIN_TIME_MS) return fail("too_fast", 422);
      const timeMs = playedMs + hints * DUEL_HINT_MS;
      const nowIso = new Date().toISOString();

      const patch = isChallenger
        ? {
            challenger_countries: r.countries,
            challenger_time_ms: timeMs,
            challenger_hints: hints,
            sent_at: nowIso,
            expires_at: new Date(Date.now() + DUEL_TTL_MS).toISOString(),
          }
        : {
            rival_countries: r.countries,
            rival_time_ms: timeMs,
            rival_hints: hints,
            finished_at: nowIso,
            winner: winnerOf(
              { countries: d.challenger_countries ?? 0, timeMs: d.challenger_time_ms ?? 0 },
              { countries: r.countries, timeMs },
            ),
          };
      const { data: up, error } = await supabase
        .from("duels")
        .update(patch)
        .eq("id", d.id)
        .is(isChallenger ? "sent_at" : "finished_at", null)
        .select("*");
      if (error) throw error;
      const row = (up && up[0] ? up[0] : await load(d.id)) as Row;
      return ok({ duel: view(row, me) });
    }

    if (action === "duel_shared") {
      const id = String(body.id ?? "");
      if (!/^[0-9a-f-]{36}$/.test(id)) return fail("bad_duel");
      await supabase.from("duels").update({ shared_at: new Date().toISOString() })
        .eq("id", id).eq("challenger_id", me).is("shared_at", null);
      return ok({});
    }

    if (action === "duel_list") {
      const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
      const [mine, theirs] = await Promise.all([
        supabase.from("duels").select("*").eq("challenger_id", me).gte("created_at", since)
          .order("created_at", { ascending: false }).limit(50),
        supabase.from("duels").select("*").eq("rival_id", me).not("sent_at", "is", null).gte("created_at", since)
          .order("created_at", { ascending: false }).limit(50),
      ]);
      if (mine.error) throw mine.error;
      if (theirs.error) throw theirs.error;
      const now = Date.now();
      const duels = [...(mine.data ?? []), ...(theirs.data ?? [])]
        .map((d) => d as Row)
        // Un duelo que el retador dejó a medias más de 1 h ya no se envía.
        .filter((d) => d.sent_at || now - new Date(d.challenger_started_at).getTime() < DUEL_PLAY_MS)
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .map((d) => view(d, me));
      return ok({ duels });
    }

    return fail("bad_action");
  };
}
