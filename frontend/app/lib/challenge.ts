// ============================================================
//  Frontle — "¿Me ganas?": reto de Práctica compartible por link
//
//  Quien gana una ronda de Práctica comparte un link con la SEMILLA del
//  reto, el nivel y su marca (países y tiempo). Quien lo abre juega
//  exactamente ese reto (`dailyChallenge` es determinista por semilla) y
//  al resolverlo ve si le ganó. Es la prueba barata del modo 1 contra 1:
//  sin plata y sin estado nuevo en el servidor. La ronda es una ronda de
//  Práctica normal, así que el XP sigue sus reglas de siempre.
//
//  La marca viaja en el link y nadie la verifica: es un reto entre amigos
//  que no reparte premios. Si algún día lleva plata, el resultado tiene
//  que salir del servidor, no del link.
//
//  Semillas en [1e9, 2^31): fuera del rango de fechas YYYYMMDD y siempre
//  por encima de REBALANCE_FROM, así que salen con las reglas de nivel
//  vigentes.
// ============================================================

import { dailyChallenge, type DailyChallenge, type Difficulty } from "./game";
import { SITE_URL } from "./site";
import { xpPlayerId } from "./xp";

export const SEED_MIN = 1_000_000_000;
export const SEED_MAX = 2_147_483_646;

// Marca de quien reta: el reto (semilla + nivel) y cómo lo resolvió.
export interface RivalMark {
  seed: number;
  level: Difficulty;
  countries: number;
  timeMs: number;
}

const LEVEL_CODE: Record<Difficulty, string> = { easy: "e", medium: "m", hard: "h" };
const CODE_LEVEL: Record<string, Difficulty> = { e: "easy", m: "medium", h: "hard" };

export function newChallengeSeed(): number {
  const r = crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296;
  return SEED_MIN + Math.floor(r * (SEED_MAX - SEED_MIN));
}

export function challengeFromSeed(seed: number, level: Difficulty): DailyChallenge {
  return dailyChallenge(seed, level);
}

export function challengeUrl(m: RivalMark): string {
  const q = new URLSearchParams({
    reto: String(m.seed),
    n: LEVEL_CODE[m.level],
    p: String(m.countries),
    t: String(Math.round(m.timeMs)),
  });
  return `${SITE_URL}/?${q}`;
}

// Lee el reto de la URL. null si falta algo o un valor está fuera de rango
// (un link roto o editado a mano no abre un reto imposible).
export function parseChallenge(search: string): RivalMark | null {
  const sp = new URLSearchParams(search);
  if (!sp.has("reto")) return null;
  const seed = Number(sp.get("reto"));
  const level = CODE_LEVEL[sp.get("n") ?? ""];
  const countries = Number(sp.get("p"));
  const timeMs = Number(sp.get("t"));
  if (!Number.isInteger(seed) || seed < SEED_MIN || seed > SEED_MAX) return null;
  if (!level) return null;
  if (!Number.isInteger(countries) || countries < 1 || countries > 40) return null;
  if (!Number.isInteger(timeMs) || timeMs < 2000 || timeMs > 24 * 3600 * 1000) return null;
  return { seed, level, countries, timeMs };
}

// Toma el reto de la URL UNA vez por carga y lo borra de la barra (recargar o
// compartir la pestaña no lo repite). El resultado queda en caché: en
// desarrollo React monta la página dos veces, y el segundo montaje ya
// encuentra la URL limpia. Por lo mismo, "open" se cuenta aquí y no en el efecto.
let urlChallenge: RivalMark | null | undefined;
export function takeChallengeFromUrl(): RivalMark | null {
  if (urlChallenge === undefined) {
    urlChallenge = parseChallenge(window.location.search);
    if (urlChallenge) {
      trackChallenge("open", urlChallenge);
      window.history.replaceState(null, "", window.location.pathname);
    }
  }
  return urlChallenge;
}

export type ChallengeResult = "win" | "lose" | "tie";

// Mismo orden que el ranking diario: menos países gana; a igualdad, menos tiempo.
export function compareMarks(
  mine: { countries: number; timeMs: number },
  rival: { countries: number; timeMs: number },
): ChallengeResult {
  if (mine.countries !== rival.countries) return mine.countries < rival.countries ? "win" : "lose";
  if (mine.timeMs !== rival.timeMs) return mine.timeMs < rival.timeMs ? "win" : "lose";
  return "tie";
}

// Comparte el link. El link va DENTRO del texto: si se pasa aparte como `url`,
// WhatsApp lo muestra dos veces. Sin `navigator.share` (escritorio), se copia.
export async function shareChallenge(text: string, url: string): Promise<"shared" | "copied" | "cancelled" | "failed"> {
  const message = `${text}\n${url}`;
  if (typeof navigator.share === "function") {
    try {
      await navigator.share({ text: message });
      return "shared";
    } catch (e) {
      if ((e as DOMException)?.name === "AbortError") return "cancelled";
    }
  }
  try {
    await navigator.clipboard.writeText(message);
    return "copied";
  } catch {
    return "failed";
  }
}

// --- Medición del experimento -------------------------------------------------
// share: quien gana comparte · open: alguien llega por un link · play: empieza
// el reto · solve: lo resuelve (con resultado). Va por la función `game`
// porque desde la migración 0026 las tablas no aceptan escrituras con la clave
// pública. Fire-and-forget: si falla, o la función aún no tiene la acción, el
// juego sigue igual.

export type ChallengeEvent = "share" | "open" | "play" | "solve";

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPA_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const CLIENT_KEY = "frontle-cid";

// Id anónimo del navegador: deja contar "un evento por persona y reto" sin
// pedir wallet (quien llega por un link casi nunca la tiene conectada).
function clientId(): string {
  try {
    let id = localStorage.getItem(CLIENT_KEY);
    if (!id) {
      id = typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");
      localStorage.setItem(CLIENT_KEY, id);
    }
    return id;
  } catch {
    return "";
  }
}

export function trackChallenge(
  kind: ChallengeEvent,
  mark: { seed: number; level: Difficulty },
  result?: ChallengeResult,
): void {
  if (!SUPA_URL || !SUPA_KEY) return;
  const client = clientId();
  if (!client) return;
  void fetch(`${SUPA_URL}/functions/v1/game`, {
    method: "POST",
    headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "challenge_event",
      kind,
      seed: mark.seed,
      level: mark.level,
      client,
      player: xpPlayerId(),
      result: result ?? null,
    }),
    keepalive: true,
  }).catch(() => {});
}
