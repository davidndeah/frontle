// ============================================================
//  Frontle — Edge Function "game": el reto diario corre en el servidor
//
//  Acciones (POST JSON, con la clave pública como el resto de la app):
//
//   · {action:"preview"}
//       Lo que el inicio enseña ANTES de jugar, sin revelar países: por
//       nivel, cuántos intermedios pide y el continente de origen/destino.
//
//   · {action:"start", player, level, paymentTx?}
//       Abre (o retoma) la partida del jugador en ese nivel y le revela el
//       reto. La hora de inicio la fija el SERVIDOR. Reglas:
//         - partida abierta en ese nivel → se retoma (mismo inicio);
//         - primer nivel del día → gratis;
//         - otro nivel o un reintento → exige `paymentTx`: un USDT.transfer
//           de ESA wallet a la tesorería de al menos 0.10, de las últimas 2 h
//           y no usado antes.
//
//   · {action:"finish", sessionId, chain, pauses?, countryCode?, name?}
//       Revalida la cadena contra el grafo (misma regla que el cliente),
//       calcula el tiempo con su reloj (fin − inicio − pausas) y escribe la
//       marca en `scores`. Rechaza < 2 s (igual que el check scores_min_time).
//       `pauses` = [{tx, ms}]: el reloj se para mientras se confirma el pago
//       de una pista; solo se descuenta si `tx` es un pago real de esa wallet
//       hecho DURANTE la partida, y como mucho PAUSE_MAX_MS por pago.
//
//  El reto sale de crypto.getRandomValues: ya no hay semilla pública con la
//  que conocerlo de antemano. Ver _shared/engine.ts y la migración 0023.
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createPublicClient, http, parseAbiItem, decodeEventLog } from "https://esm.sh/viem@2.21.0";
import { celo } from "https://esm.sh/viem@2.21.0/chains";
import data from "../_shared/engine-data.json" with { type: "json" };
import { makeEngine, LEVELS, type Level, type EngineData } from "../_shared/engine.ts";

const E = makeEngine(data as EngineData);

const USDT = "0x48065fbbe25f71c9282ddf5e1cd6d6a887483d5e";
const TREASURY = "0x54e83c8d7b7a77cbf0a2842c1a82d51be8814dd0";
const EXTRA_PRICE = 100_000n; // 0.10 USDT (6 dec)
const PAYMENT_MAX_AGE_S = 2 * 3600;
const MIN_TIME_MS = 2000;
const MAX_SESSIONS_PER_DAY = 40;
const HINT_MIN_PRICE = 50_000n; // 0.05 USDT: la pista más barata
const PAUSE_MAX_MS = 90_000;
const transferEvent = parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 value)");

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

function utcDay(d = new Date()): number {
  return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
}

function rand(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296;
}

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const chain = createPublicClient({ chain: celo, transport: http(Deno.env.get("CELO_RPC_URL") || "https://forno.celo.org") });

// Reto del (día, nivel): lo crea la primera petición; las demás leen el mismo.
async function getChallenge(day: number, level: Level) {
  const sel = () =>
    supabase.from("daily_challenges").select("start_country, end_country, optimal").eq("day", day).eq("level", level).maybeSingle();
  let { data: row, error } = await sel();
  if (error) throw error;
  if (!row) {
    const c = E.generate(level, rand);
    const ins = await supabase
      .from("daily_challenges")
      .upsert(
        { day, level, start_country: c.start, end_country: c.end, optimal: c.optimal, path: c.path },
        { onConflict: "day,level", ignoreDuplicates: true },
      );
    if (ins.error) throw ins.error;
    ({ data: row, error } = await sel());
    if (error || !row) throw error ?? new Error("reto no disponible");
  }
  return { start: row.start_country as string, end: row.end_country as string, optimal: row.optimal as number };
}

// ¿`tx` es un pago de `player` a la tesorería por al menos `minValue`, hecho
// después de `notBeforeS` (segundos unix)? null = válido; si no, el motivo.
async function verifyPayment(tx: string, player: string, minValue: bigint, notBeforeS: number): Promise<string | null> {
  if (!/^0x[0-9a-fA-F]{64}$/.test(tx)) return "bad_tx";
  try {
    const receipt = await chain.getTransactionReceipt({ hash: tx as `0x${string}` });
    if (receipt.status !== "success") return "tx_failed";
    const block = await chain.getBlock({ blockNumber: receipt.blockNumber });
    if (Number(block.timestamp) < notBeforeS) return "tx_too_old";
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== USDT) continue;
      try {
        const ev = decodeEventLog({ abi: [transferEvent], data: log.data, topics: log.topics });
        const { from, to, value } = ev.args as { from: string; to: string; value: bigint };
        if (from.toLowerCase() === player && to.toLowerCase() === TREASURY && value >= minValue) return null;
      } catch { /* otro evento */ }
    }
    return "tx_not_a_payment";
  } catch {
    return "tx_not_found";
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? "");

    if (action === "preview") {
      const day = utcDay();
      const levels: Record<string, unknown> = {};
      for (const lv of LEVELS) {
        const c = await getChallenge(day, lv);
        levels[lv] = { optimal: c.optimal, startContinent: E.continentOf(c.start), endContinent: E.continentOf(c.end) };
      }
      return json({ ok: true, day, levels });
    }

    if (action === "start") {
      const player = String(body.player ?? "").toLowerCase();
      const level = String(body.level ?? "") as Level;
      if (!/^0x[0-9a-f]{40}$/.test(player)) return json({ ok: false, error: "bad_player" }, 400);
      if (!LEVELS.includes(level)) return json({ ok: false, error: "bad_level" }, 400);
      const day = utcDay();

      const { data: sessions, error } = await supabase
        .from("game_sessions")
        .select("id, level, started_at, finished_at")
        .eq("player_id", player)
        .eq("day", day)
        .order("started_at", { ascending: true });
      if (error) throw error;
      const challenge = await getChallenge(day, level);
      const reveal = (id: string, startedAt: string) =>
        json({ ok: true, sessionId: id, day, level, challenge, startedAt, serverNow: new Date().toISOString() });

      const open = (sessions ?? []).find((s) => s.level === level && !s.finished_at);
      if (open) return reveal(open.id, open.started_at);
      if ((sessions ?? []).length >= MAX_SESSIONS_PER_DAY) return json({ ok: false, error: "too_many_sessions" }, 429);

      // Gratis solo la primera partida del día; el resto (otro nivel o
      // reintento) necesita un pago propio y sin usar.
      const needsPayment = (sessions ?? []).length > 0;
      let paidTx: string | null = null;
      if (needsPayment) {
        const tx = String(body.paymentTx ?? "").toLowerCase();
        if (!tx) return json({ ok: false, error: "payment_required" }, 402);
        const why = await verifyPayment(tx, player, EXTRA_PRICE, Date.now() / 1000 - PAYMENT_MAX_AGE_S);
        if (why) return json({ ok: false, error: why }, 402);
        paidTx = tx;
      }
      const { data: created, error: insErr } = await supabase
        .from("game_sessions")
        .insert({ player_id: player, day, level, paid_tx: paidTx })
        .select("id, started_at")
        .single();
      if (insErr) {
        // unique(paid_tx): ese pago ya habilitó otra partida.
        if (String(insErr.code) === "23505") return json({ ok: false, error: "payment_used" }, 402);
        throw insErr;
      }
      return reveal(created.id, created.started_at);
    }

    if (action === "finish") {
      const id = String(body.sessionId ?? "");
      if (!/^[0-9a-f-]{36}$/.test(id)) return json({ ok: false, error: "bad_session" }, 400);
      const { data: s, error } = await supabase
        .from("game_sessions")
        .select("id, player_id, day, level, started_at, finished_at, countries, time_ms")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      if (!s) return json({ ok: false, error: "bad_session" }, 404);
      // Idempotente: reenviar el cierre devuelve el mismo resultado.
      if (s.finished_at) return json({ ok: true, countries: s.countries, timeMs: s.time_ms, already: true });

      const c = await getChallenge(s.day, s.level as Level);
      const chainIn: string[] = Array.isArray(body.chain) ? body.chain.map(String) : [];
      const r = E.replay(c.start, c.end, chainIn);
      if (!r.ok) return json({ ok: false, error: r.reason }, 422);
      // Pausas por pago de pistas: solo pagos reales de esta wallet hechos
      // durante la partida, cada uno una vez y con tope.
      const startedMs = new Date(s.started_at).getTime();
      let pausedMs = 0;
      const seenTx = new Set<string>();
      for (const p of Array.isArray(body.pauses) ? body.pauses.slice(0, 5) : []) {
        const tx = String(p?.tx ?? "").toLowerCase();
        const ms = Math.max(0, Math.min(Number(p?.ms) || 0, PAUSE_MAX_MS));
        if (!tx || seenTx.has(tx) || ms === 0) continue;
        seenTx.add(tx);
        if (!(await verifyPayment(tx, s.player_id, HINT_MIN_PRICE, startedMs / 1000 - 5))) pausedMs += ms;
      }
      const timeMs = Date.now() - startedMs - pausedMs;
      if (timeMs < MIN_TIME_MS) return json({ ok: false, error: "too_fast" }, 422);

      // Cerrar primero (si dos cierres llegan a la vez, solo uno escribe).
      const { data: closed, error: upErr } = await supabase
        .from("game_sessions")
        .update({ finished_at: new Date().toISOString(), chain: chainIn, countries: r.countries, time_ms: timeMs })
        .eq("id", id)
        .is("finished_at", null)
        .select("id");
      if (upErr) throw upErr;
      if (!closed || closed.length === 0) return json({ ok: true, countries: r.countries, timeMs, already: true });

      const name = typeof body.name === "string" && body.name.trim() ? body.name.trim().slice(0, 16) : null;
      const cc = typeof body.countryCode === "string" && /^[A-Z]{2}$/.test(body.countryCode) ? body.countryCode : "";
      const { error: scErr } = await supabase.from("scores").insert({
        day: s.day,
        countries: r.countries,
        time_ms: timeMs,
        country_code: cc,
        player_id: s.player_id,
        level: s.level,
        name,
      });
      if (scErr) throw scErr;
      return json({ ok: true, countries: r.countries, timeMs, optimal: c.optimal });
    }

    return json({ ok: false, error: "bad_action" }, 400);
  } catch (err) {
    return json({ ok: false, error: String((err as Error)?.message ?? err) }, 500);
  }
});
