// ============================================================
//  Frontle v2 — Racha real, congelar y reparar (Fase 3, PLAN §5.2)
//
//  La racha ya NO es "días jugados": la deriva el servidor de `scores` +
//  los escudos comprados (`streak_shields`), así que no se puede inflar
//  desde el cliente. Aquí solo llamamos a las funciones y traducimos.
// ============================================================

import { ensureSecret, localSecret, rpc } from "./secret";
import { xpPlayerId } from "./xp";

export const FREEZE_COST = 5;
export const MAX_FREEZES = 2;

// Consume congeladores por los días perdidos y devuelve la racha vigente.
// Se llama al abrir la app: es idempotente y barato.
export async function syncStreak(): Promise<number> {
  const r = await rpc<number>("sync_streak", { p_player: xpPlayerId() });
  return r.ok ? Number(r.data ?? 0) : 0;
}

// Congeladores en reserva (0–2).
export async function getFreezes(): Promise<number> {
  const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPA_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!SUPA_URL || !SUPA_KEY) return 0;
  try {
    const r = await fetch(
      `${SUPA_URL}/rest/v1/streak_freezes?player_id=eq.${encodeURIComponent(xpPlayerId())}&consumed_day=is.null&select=id`,
      { headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` } }
    );
    const j = await r.json();
    return Array.isArray(j) ? j.length : 0;
  } catch {
    return 0;
  }
}

export type StreakActionResult = "ok" | "insufficient" | "identity" | "max" | "unavailable" | "error";

function translate(code: string): StreakActionResult {
  if (code === "P0001") return "insufficient"; // saldo
  if (code === "P0002") return "identity";
  if (code === "P0004") return "max";
  if (code === "P0005" || code === "P0006" || code === "P0007") return "unavailable";
  return "error";
}

// Compra un congelador (15 🪙, máx 2 en reserva).
export async function buyFreeze(): Promise<{ res: StreakActionResult; freezes?: number }> {
  if (!(await ensureSecret())) return { res: "identity" };
  const r = await rpc<number>("buy_streak_freeze", { p_player: xpPlayerId(), p_secret: localSecret() });
  return r.ok ? { res: "ok", freezes: Number(r.data ?? 0) } : { res: translate(r.code) };
}

export interface RepairQuote {
  day: number;
  cost: number;
  streakLen: number;
}

// ¿Hay un día reparable dentro de la ventana de 48h? Con su precio exacto.
export async function getRepairQuote(): Promise<RepairQuote | null> {
  const r = await rpc<Array<{ day: number; cost: number; streak_len: number }>>("repair_quote", {
    p_player: xpPlayerId(),
  });
  if (!r.ok || !Array.isArray(r.data) || r.data.length === 0) return null;
  const q = r.data[0];
  return { day: Number(q.day), cost: Number(q.cost), streakLen: Number(q.streak_len) };
}

// Repara el día perdido (el servidor revalida ventana, hueco y precio).
export async function repairStreak(day: number): Promise<{ res: StreakActionResult; streak?: number }> {
  if (!(await ensureSecret())) return { res: "identity" };
  const r = await rpc<number>("repair_streak", {
    p_player: xpPlayerId(),
    p_secret: localSecret(),
    p_day: day,
  });
  return r.ok ? { res: "ok", streak: Number(r.data ?? 0) } : { res: translate(r.code) };
}
