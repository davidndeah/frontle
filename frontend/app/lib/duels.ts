// ============================================================
//  Frontle — Duelos (1 contra 1): cliente de las acciones duel_* de `game`
//
//  El servidor genera el reto, cronometra y valida (ver
//  supabase/functions/game/duels.ts y la migración 0033). Aquí solo se
//  pide, se muestra y se comparte.
//
//  Cómo llega un duelo de un jugador a otro:
//    · Rival elegido (lista o alias): le aparece en Duelos, sin link.
//    · Sin rival: se comparte. Dentro de MiniPay va el deeplink de la app +
//      el CÓDIGO del duelo (el deeplink no lleva parámetros); fuera, el link
//      web con ?duelo=CÓDIGO. El código siempre se ve en pantalla, así que
//      si compartir falla se puede dictar o copiar a mano.
// ============================================================

import type { Difficulty } from "./game";
import { ensureSecret, localSecret } from "./secret";
import { xpPlayerId } from "./xp";
import { getAlias } from "./ranking";
import { SITE_URL } from "./site";
import { isMiniPay, MINIPAY_APP_URL } from "./minipay";

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPA_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const DUEL_HINT_SECONDS = 15; // lo mismo que DUEL_HINT_MS en el servidor
export const DUEL_CODE_RE = /^[A-HJ-NP-Z2-9]{6}$/;

export type DuelStatus = "playing" | "open" | "started" | "finished" | "expired";
export interface DuelMark {
  countries: number;
  timeMs: number;
  hints: number;
}
export interface Duel {
  id: string;
  level: Difficulty;
  role: "challenger" | "rival";
  status: DuelStatus;
  code: string | null;
  opponentName: string | null;
  opponentId: string | null;
  hasOpponent: boolean;
  mine: DuelMark | null;
  theirs: DuelMark | null;
  result: "win" | "lose" | "tie" | null;
  optimal: number | null;
  createdAt: string;
  expiresAt: string | null;
}
export interface DuelPlay {
  duel: Duel;
  challenge: { start: string; end: string; optimal: number };
  /** ms ya transcurridos según el servidor (al retomar > 0). */
  elapsedMs: number;
}
export interface DuelPlayer {
  id: string;
  name: string;
}
export type DuelResult<T> = { ok: true; data: T } | { ok: false; error: string };

// El secret se liga una vez por sesión (first-write-wins en el servidor).
let identityReady: Promise<boolean> | null = null;

async function call<T>(action: string, args: Record<string, unknown> = {}): Promise<DuelResult<T>> {
  const player = xpPlayerId();
  if (!/^0x[0-9a-f]{40}$/.test(player)) return { ok: false, error: "no_wallet" };
  if (!SUPA_URL || !SUPA_KEY) return { ok: false, error: "network" };
  identityReady ??= ensureSecret();
  if (!(await identityReady)) {
    identityReady = null; // reintentar la próxima vez (p. ej. sin red)
    return { ok: false, error: "identity" };
  }
  try {
    const r = await fetch(`${SUPA_URL}/functions/v1/game`, {
      method: "POST",
      headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ action, player, secret: localSecret(), ...args }),
    });
    const j = await r.json().catch(() => null);
    if (j?.ok) return { ok: true, data: j as T };
    return { ok: false, error: String(j?.error ?? "network") };
  } catch {
    return { ok: false, error: "network" };
  }
}

function toPlay(d: { duel: Duel; challenge: DuelPlay["challenge"]; startedAt: string; serverNow: string }): DuelPlay {
  const elapsedMs = Math.max(0, new Date(d.serverNow).getTime() - new Date(d.startedAt).getTime());
  return { duel: d.duel, challenge: d.challenge, elapsedMs };
}

export async function listDuels(): Promise<DuelResult<Duel[]>> {
  const r = await call<{ duels: Duel[] }>("duel_list");
  return r.ok ? { ok: true, data: r.data.duels } : r;
}

export async function findPlayers(q: string): Promise<DuelResult<DuelPlayer[]>> {
  const r = await call<{ players: DuelPlayer[] }>("duel_players", { q: q.trim() });
  return r.ok ? { ok: true, data: r.data.players } : r;
}

type RevealBody = { duel: Duel; challenge: DuelPlay["challenge"]; startedAt: string; serverNow: string };

export async function createDuel(level: Difficulty, rival: string | null): Promise<DuelResult<DuelPlay>> {
  const r = await call<RevealBody>("duel_create", { level, rival, name: getAlias() || null });
  return r.ok ? { ok: true, data: toPlay(r.data) } : r;
}

export async function startDuel(id: string): Promise<DuelResult<DuelPlay>> {
  const r = await call<RevealBody>("duel_start", { id });
  return r.ok ? { ok: true, data: toPlay(r.data) } : r;
}

export async function finishDuel(id: string, chain: string[], hints: number): Promise<DuelResult<Duel>> {
  const r = await call<{ duel: Duel }>("duel_finish", { id, chain, hints });
  return r.ok ? { ok: true, data: r.data.duel } : r;
}

export async function claimDuel(code: string): Promise<DuelResult<Duel>> {
  const r = await call<{ duel: Duel }>("duel_claim", { code: normalizeCode(code), name: getAlias() || null });
  return r.ok ? { ok: true, data: r.data.duel } : r;
}

export function markShared(id: string): void {
  void call("duel_shared", { id });
}

export function normalizeCode(s: string): string {
  return s.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
}

// Link que se comparte: dentro de MiniPay, el deeplink de la app (el código va
// en el texto); fuera, el link web con el código, que abre Duelos directo.
export function duelLink(code: string): string {
  return isMiniPay() ? MINIPAY_APP_URL : `${SITE_URL}/?duelo=${code}`;
}

// Comparte el texto con el link DENTRO (si va aparte como `url`, WhatsApp lo
// repite). Sin `navigator.share`, se copia. "failed": la UI ya muestra el
// código y el link para copiarlos a mano.
export async function shareText(message: string): Promise<"shared" | "copied" | "cancelled" | "failed"> {
  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
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

// Código de duelo que llegó en la URL (?duelo=XXXXXX). Se lee UNA vez por
// carga y se borra SOLO ese parámetro: los demás (utm_*, ref…) se quedan.
// En desarrollo React monta dos veces; el caché evita perderlo en el segundo.
let urlCode: string | null | undefined;
export function takeDuelCodeFromUrl(): string | null {
  if (urlCode !== undefined) return urlCode;
  urlCode = null;
  try {
    const url = new URL(window.location.href);
    const raw = url.searchParams.get("duelo");
    if (raw !== null) {
      const code = normalizeCode(raw);
      urlCode = DUEL_CODE_RE.test(code) ? code : null;
      url.searchParams.delete("duelo");
      window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
    }
  } catch {}
  return urlCode;
}

// Balance contra cada rival ("Tú 3 – 2 Ana"), con los duelos terminados.
export function recordByOpponent(duels: Duel[]): { name: string; wins: number; losses: number; ties: number }[] {
  const by = new Map<string, { name: string; wins: number; losses: number; ties: number }>();
  for (const d of duels) {
    if (d.status !== "finished" || !d.opponentName) continue;
    const e = by.get(d.opponentName) ?? { name: d.opponentName, wins: 0, losses: 0, ties: 0 };
    if (d.result === "win") e.wins++;
    else if (d.result === "lose") e.losses++;
    else e.ties++;
    by.set(d.opponentName, e);
  }
  return [...by.values()].sort((a, b) => b.wins + b.losses + b.ties - (a.wins + a.losses + a.ties));
}
