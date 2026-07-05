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
  createdAt?: string;
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
      await fetch(`${SUPA_URL}/rest/v1/scores`, {
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
        }),
      });
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

export function formatTime(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
