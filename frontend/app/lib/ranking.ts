// ============================================================
//  Frontle — Ranking diario
//  Orden: menos países primero; a igualdad de países, menor tiempo.
//  Usa Supabase (REST) si hay credenciales; si no, cae a localStorage
//  (solo este navegador) para poder probar en local desde ya.
//  Privacidad: guardamos SOLO el código de país de la IP (para la
//  bandera), nunca la IP en sí.
// ============================================================

export interface ScoreEntry {
  day: number;
  countries: number;
  timeMs: number;
  countryCode: string; // ISO-2 (bandera de la IP)
  playerId: string; // identifica a cada jugador (anónimo, por navegador)
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

// Versión corta para mostrar en el ranking (ej. "#A1B2C3").
export function shortId(id: string): string {
  return id ? "#" + id.slice(0, 6).toUpperCase() : "—";
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
        }),
      });
    } catch {
      /* silencioso: no bloquear el juego por el ranking */
    }
  } else {
    try {
      const k = `frontle-ranking-${e.day}`;
      const arr: ScoreEntry[] = JSON.parse(localStorage.getItem(k) || "[]");
      arr.push({ ...e, createdAt: new Date().toISOString() });
      localStorage.setItem(k, JSON.stringify(arr));
    } catch {}
  }
}

export async function getRanking(day: number, limit = 10): Promise<ScoreEntry[]> {
  if (useSupabase) {
    try {
      const r = await fetch(
        `${SUPA_URL}/rest/v1/scores?day=eq.${day}&order=countries.asc,time_ms.asc&limit=${limit}`,
        { headers: { apikey: SUPA_KEY!, Authorization: `Bearer ${SUPA_KEY}` } }
      );
      const j = await r.json();
      return (Array.isArray(j) ? j : []).map((x: Record<string, unknown>) => ({
        day: Number(x.day),
        countries: Number(x.countries),
        timeMs: Number(x.time_ms),
        countryCode: String(x.country_code ?? ""),
        playerId: String(x.player_id ?? ""),
        createdAt: x.created_at as string | undefined,
      }));
    } catch {
      return [];
    }
  }
  try {
    const arr: ScoreEntry[] = JSON.parse(localStorage.getItem(`frontle-ranking-${day}`) || "[]");
    return arr
      .sort((a, b) => a.countries - b.countries || a.timeMs - b.timeMs)
      .slice(0, limit);
  } catch {
    return [];
  }
}

export function formatTime(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
