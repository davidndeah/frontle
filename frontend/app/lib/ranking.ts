// ============================================================
//  Frontle — Ranking diario
//  Orden: menos países primero; a igualdad de países, menor tiempo.
//  Usa Supabase (REST) si hay credenciales; si no, cae a localStorage
//  (solo este navegador) para poder probar en local desde ya.
//  Privacidad: guardamos SOLO el código de país de la IP (para la
//  bandera), nunca la IP en sí.
// ============================================================

import type { Difficulty } from "./game";

export interface ScoreEntry {
  day: number;
  countries: number;
  timeMs: number;
  countryCode: string; // ISO-2 (bandera de la IP)
  playerId: string; // identifica a cada jugador (anónimo, por navegador)
  level?: Difficulty; // nivel del reto; si falta, se asume "medium"
  name?: string; // nombre de perfil elegido por el jugador (opcional)
  createdAt?: string;
}

// --- Nombre de perfil (alias) -------------------------------------------
// Se guarda local y viaja con cada score para mostrarse en el ranking.
const ALIAS_KEY = "frontle-alias";
export function getAlias(): string {
  try {
    return (localStorage.getItem(ALIAS_KEY) || "").trim().slice(0, 16);
  } catch {
    return "";
  }
}
export function setAlias(name: string): void {
  const clean = name.trim().slice(0, 16);
  try {
    if (clean) localStorage.setItem(ALIAS_KEY, clean);
    else localStorage.removeItem(ALIAS_KEY);
  } catch {}
}

// ID anónimo y estable por navegador (se guarda en localStorage).
export function getPlayerId(): string {
  if (typeof localStorage === "undefined") return "";
  let id = localStorage.getItem("frontle-player-id");
  if (!id) {
    id = (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)).replace(/-/g, "");
    localStorage.setItem("frontle-player-id", id);
  }
  return id;
}

// Versión corta estilo wallet (ej. "1fc1…508c") para mostrar en el ranking.
// La identidad es la dirección de la wallet; mostramos prefijo…sufijo sin "0x".
export function shortId(id: string): string {
  if (!id) return "—";
  const s = id.startsWith("0x") || id.startsWith("0X") ? id.slice(2) : id;
  if (s.length <= 8) return s.toLowerCase();
  return `${s.slice(0, 4)}…${s.slice(-4)}`.toLowerCase();
}

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPA_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const useSupabase = Boolean(SUPA_URL && SUPA_KEY);

// País de la IP del visitante (para la bandera del ranking). Sin API key.
export async function getIpCountry(): Promise<string> {
  try {
    const r = await fetch("https://get.geojs.io/v1/ip/country.json");
    const j = await r.json();
    return String(j.country || "").toUpperCase();
  } catch {
    return "";
  }
}

export async function submitScore(e: ScoreEntry): Promise<void> {
  const level: Difficulty = e.level ?? "medium";
  if (useSupabase) {
    try {
      const post = (withName: boolean) =>
        fetch(`${SUPA_URL}/rest/v1/scores`, {
          method: "POST",
          headers: {
            apikey: SUPA_KEY!,
            Authorization: `Bearer ${SUPA_KEY}`,
            "Content-Type": "application/json",
            Prefer: "return=minimal",
          },
          body: JSON.stringify({
            day: e.day,
            countries: e.countries,
            time_ms: e.timeMs,
            country_code: e.countryCode,
            player_id: e.playerId,
            level,
            ...(withName && e.name ? { name: e.name } : {}),
          }),
        });
      const r = await post(true);
      // Reintento sin `name`. La columna ya existe en prod (migración 0005,
      // aplicada 2026-07-09), así que esto ya no es un parche de despliegue:
      // ahora cubre que el nombre viole el `check` de la columna (1..16
      // caracteres). Perder el nombre es mejor que perder la marca entera.
      if (!r.ok && e.name) await post(false);
    } catch {
      /* silencioso: no bloquear el juego por el ranking */
    }
  } else {
    try {
      const k = `frontle-ranking-${e.day}-${level}`;
      const arr: ScoreEntry[] = JSON.parse(localStorage.getItem(k) || "[]");
      arr.push({ ...e, level, createdAt: new Date().toISOString() });
      localStorage.setItem(k, JSON.stringify(arr));
    } catch {}
  }
}

// Ordena por (menos países, menor tiempo) y deja UNA fila por jugador
// (su mejor marca). Las filas sin playerId se tratan como únicas.
function bestPerPlayer(entries: ScoreEntry[], limit: number): ScoreEntry[] {
  const sorted = entries
    .slice()
    .sort((a, b) => a.countries - b.countries || a.timeMs - b.timeMs);
  const seen = new Set<string>();
  const out: ScoreEntry[] = [];
  for (const e of sorted) {
    const key = e.playerId || `anon-${out.length}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
    if (out.length >= limit) break;
  }
  return out;
}

export async function getRanking(
  day: number,
  level: Difficulty = "medium",
  limit = 10
): Promise<ScoreEntry[]> {
  if (useSupabase) {
    try {
      const r = await fetch(
        `${SUPA_URL}/rest/v1/scores?day=eq.${day}&level=eq.${level}&order=countries.asc,time_ms.asc&limit=500`,
        { headers: { apikey: SUPA_KEY!, Authorization: `Bearer ${SUPA_KEY}` } }
      );
      const j = await r.json();
      const all: ScoreEntry[] = (Array.isArray(j) ? j : []).map((x: Record<string, unknown>) => ({
        day: Number(x.day),
        countries: Number(x.countries),
        timeMs: Number(x.time_ms),
        countryCode: String(x.country_code ?? ""),
        playerId: String(x.player_id ?? ""),
        level: (x.level as Difficulty) ?? "medium",
        name: (x.name as string) || undefined,
        createdAt: x.created_at as string | undefined,
      }));
      return bestPerPlayer(all, limit);
    } catch {
      return [];
    }
  }
  try {
    const arr: ScoreEntry[] = JSON.parse(
      localStorage.getItem(`frontle-ranking-${day}-${level}`) || "[]"
    );
    return bestPerPlayer(arr, limit);
  } catch {
    return [];
  }
}

// Mejor marca de UN jugador en (día, nivel). Sirve para recuperar el tiempo
// real de una partida auto-reparada (el finalMs local se perdió, pero la
// marca enviada al ganar sigue en el ranking).
export async function getMyScore(day: number, level: Difficulty, playerId: string): Promise<ScoreEntry | null> {
  if (!playerId) return null;
  if (useSupabase) {
    try {
      // time_ms=gt.0: ignora marcas imposibles (filas basura con tiempo 0 que
      // dejó el bug de partidas corrompidas — justo lo que se quiere reparar).
      const r = await fetch(
        `${SUPA_URL}/rest/v1/scores?day=eq.${day}&level=eq.${level}&player_id=eq.${encodeURIComponent(playerId)}&time_ms=gt.0&order=countries.asc,time_ms.asc&limit=1`,
        { headers: { apikey: SUPA_KEY!, Authorization: `Bearer ${SUPA_KEY}` } }
      );
      const j = await r.json();
      const x = Array.isArray(j) ? (j[0] as Record<string, unknown>) : null;
      if (!x) return null;
      return {
        day: Number(x.day),
        countries: Number(x.countries),
        timeMs: Number(x.time_ms),
        countryCode: String(x.country_code ?? ""),
        playerId: String(x.player_id ?? ""),
        level: (x.level as Difficulty) ?? "medium",
        createdAt: x.created_at as string | undefined,
      };
    } catch {
      return null;
    }
  }
  try {
    const arr: ScoreEntry[] = JSON.parse(localStorage.getItem(`frontle-ranking-${day}-${level}`) || "[]");
    const mine = arr
      .filter((e) => e.playerId === playerId && e.timeMs > 0)
      .sort((a, b) => a.countries - b.countries || a.timeMs - b.timeMs);
    return mine[0] ?? null;
  } catch {
    return null;
  }
}

// --- Premios: (día, nivel) que esta wallet ganó (tabla `winners`) --------
// Devuelve los pares (día, nivel). La verificación real de si se puede cobrar
// (y el cobro) la hace el contrato vía payments.getClaimablePrizes/claimPrize.
// Sin Supabase no hay tabla compartida de ganadores → array vacío.
export async function getMyWinDays(address: string): Promise<{ day: number; level: Difficulty }[]> {
  if (!useSupabase || !address) return [];
  try {
    const r = await fetch(
      `${SUPA_URL}/rest/v1/winners?winner_address=eq.${address.toLowerCase()}&select=day,level&order=day.desc&limit=60`,
      { headers: { apikey: SUPA_KEY!, Authorization: `Bearer ${SUPA_KEY}` } }
    );
    const j = await r.json();
    return (Array.isArray(j) ? j : []).map((x: { day: number; level?: string }) => ({
      day: Number(x.day),
      level: (x.level === "easy" || x.level === "hard" ? x.level : "medium") as Difficulty,
    }));
  } catch {
    return [];
  }
}

// --- Agregados públicos para /stats ------------------------------------
// Lee la vista `public_stats` (una fila). Sin datos personales: la vista solo
// cuenta, no expone player_id ni correos. En local, sin credenciales de
// Supabase, no hay nada que contar → null.
export interface CommunityStats {
  plays: number;
  players: number;
  daysPlayed: number;
  countriesReached: number;
  playsToday: number;
  playersToday: number; // DAU
  players30d: number; // MAU
  firstPlay: string; // YYYY-MM-DD
}

export async function getCommunityStats(): Promise<CommunityStats | null> {
  if (!useSupabase) return null;
  try {
    const r = await fetch(`${SUPA_URL}/rest/v1/public_stats?select=*`, {
      headers: { apikey: SUPA_KEY!, Authorization: `Bearer ${SUPA_KEY}` },
    });
    const j = await r.json();
    const row = Array.isArray(j) ? j[0] : null;
    if (!row) return null;
    return {
      plays: Number(row.plays ?? 0),
      players: Number(row.players ?? 0),
      daysPlayed: Number(row.days_played ?? 0),
      countriesReached: Number(row.countries_reached ?? 0),
      playsToday: Number(row.plays_today ?? 0),
      playersToday: Number(row.players_today ?? 0),
      players30d: Number(row.players_30d ?? 0),
      firstPlay: String(row.first_play ?? ""),
    };
  } catch {
    return null;
  }
}

// Retención por cohorte (vista `retention_cohorts`). `cohort` es el número de
// jugadores que YA tuvieron N días para volver; si es 0, la ventana aún no
// tiene cohorte madura y no se debe mostrar porcentaje.
export interface RetentionWindow {
  windowDays: number; // 1, 7, 30
  cohort: number;
  retained: number;
}

export async function getRetention(): Promise<RetentionWindow[]> {
  if (!useSupabase) return [];
  try {
    const r = await fetch(`${SUPA_URL}/rest/v1/retention_cohorts?select=*&order=window_days.asc`, {
      headers: { apikey: SUPA_KEY!, Authorization: `Bearer ${SUPA_KEY}` },
    });
    const j = await r.json();
    if (!Array.isArray(j)) return [];
    return j.map((x: { window_days: number; cohort: number; retained: number }) => ({
      windowDays: Number(x.window_days),
      cohort: Number(x.cohort ?? 0),
      retained: Number(x.retained ?? 0),
    }));
  } catch {
    return [];
  }
}

// Top de países de los últimos 30 días (vista `top_countries_30d`).
// El código ISO viene de la IP; nunca se guardó la IP en sí.
export interface CountryStat {
  code: string; // ISO alpha-2
  plays: number;
  players: number;
}

export async function getTopCountries(limit = 6): Promise<CountryStat[]> {
  if (!useSupabase) return [];
  try {
    // El orden se pide explícito: el ORDER BY de la vista no sobrevive al limit.
    const r = await fetch(`${SUPA_URL}/rest/v1/top_countries_30d?select=*&order=plays.desc&limit=${limit}`, {
      headers: { apikey: SUPA_KEY!, Authorization: `Bearer ${SUPA_KEY}` },
    });
    const j = await r.json();
    if (!Array.isArray(j)) return [];
    return j.map((x: { country_code: string; plays: number; players: number }) => ({
      code: String(x.country_code || "").toUpperCase(),
      plays: Number(x.plays ?? 0),
      players: Number(x.players ?? 0),
    }));
  } catch {
    return [];
  }
}

// Nombres de perfil de un puñado de direcciones (los ganadores del ciclo).
// Devuelve un mapa dirección→nombre; las que no tengan nombre no aparecen.
// `player_id` es la dirección de la wallet en minúsculas.
export async function getNamesFor(addresses: string[]): Promise<Record<string, string>> {
  const ids = addresses.filter(Boolean).map((a) => a.toLowerCase());
  if (!useSupabase || ids.length === 0) return {};
  try {
    const list = ids.map((a) => `"${a}"`).join(",");
    const r = await fetch(
      `${SUPA_URL}/rest/v1/scores?player_id=in.(${list})&name=not.is.null&select=player_id,name`,
      { headers: { apikey: SUPA_KEY!, Authorization: `Bearer ${SUPA_KEY}` } }
    );
    const j = await r.json();
    if (!Array.isArray(j)) return {};
    const out: Record<string, string> = {};
    for (const row of j as { player_id: string; name: string }[]) {
      const id = String(row.player_id || "").toLowerCase();
      if (id && row.name && !out[id]) out[id] = row.name;
    }
    return out;
  } catch {
    return {};
  }
}

export function formatTime(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
