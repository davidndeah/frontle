// ============================================================
//  Frontle v2 — Monedas 🪙 (Fase 2, PLAN-FRONTLE-V2 §5)
//
//  · SALDO: vista `coin_balance` (suma del ledger).
//  · GASTO: insert de un movimiento negativo con la anon key. El precio de
//    cada ítem lo valida el check del servidor y el trigger impide gastar
//    sin saldo — aquí solo interpretamos la respuesta.
//  · COMPRA: `purchaseCoinPack` (transfer USDT a la tesorería) y luego el
//    edge function `credit-coins` verifica la tx on-chain y acredita. El
//    cliente NUNCA acredita monedas — la RLS solo le deja insertar gastos.
//  · Comprar exige wallet; gastar funciona con la identidad de la liga
//    (wallet o anónimo — p. ej. monedas de bienvenida futuras).
// ============================================================

import { purchaseCoinPack, type PayResult } from "./payments";
import { xpPlayerId } from "./xp";

// Paquetes del plan §5.1 (1 🪙 = $0.01; los grandes traen bonus).
export const COIN_PACKS = [
  { coins: 50, usdt: 0.5 },
  { coins: 110, usdt: 1.0 },
  { coins: 300, usdt: 2.5 },
] as const;

// Ítems de gasto (deben coincidir con el check `coin_shape` de la 0009).
export const COIN_COSTS = {
  spend_hint: 3,
  spend_hint_strong: 5,
  spend_attempt: 5,
  spend_freeze: 15,
  spend_repair: 25,
  spend_repair_long: 50,
} as const;

export type SpendKind = keyof typeof COIN_COSTS;

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPA_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const useSupabase = Boolean(SUPA_URL && SUPA_KEY);

const HEADERS = () => ({
  apikey: SUPA_KEY!,
  Authorization: `Bearer ${SUPA_KEY}`,
});

// Saldo actual del jugador (0 si no tiene movimientos o no hay backend).
export async function getCoinBalance(): Promise<number> {
  if (!useSupabase) return 0;
  try {
    const r = await fetch(
      `${SUPA_URL}/rest/v1/coin_balance?player_id=eq.${encodeURIComponent(xpPlayerId())}&select=coins`,
      { headers: HEADERS() }
    );
    const j = await r.json();
    return Number((Array.isArray(j) && j[0]?.coins) || 0);
  } catch {
    return 0;
  }
}

export type SpendResult = "ok" | "insufficient" | "error";

// Gasta un ítem. El servidor fija el precio (check) y el techo (trigger de
// saldo): si no alcanza, el insert rebota y devolvemos "insufficient".
export async function spendCoins(kind: SpendKind, ref?: string): Promise<SpendResult> {
  if (!useSupabase) return "error";
  try {
    const r = await fetch(`${SUPA_URL}/rest/v1/coin_ledger`, {
      method: "POST",
      headers: { ...HEADERS(), "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({
        player_id: xpPlayerId(),
        kind,
        amount: -COIN_COSTS[kind],
        ref: ref ?? null,
      }),
    });
    if (r.ok) return "ok";
    const body = await r.text();
    return /saldo insuficiente/i.test(body) ? "insufficient" : "error";
  } catch {
    return "error";
  }
}

export type BuyCoinsResult = { res: PayResult | "credit_pending"; coins?: number };

// Compra un paquete: transfer on-chain + acreditación verificada del server.
// "credit_pending" = la tx se confirmó pero la acreditación falló — el hash
// queda en localStorage y se reintenta en la próxima consulta de saldo.
const PENDING_KEY = "frontle-coins-pending-tx";

export async function buyCoinPack(pack: (typeof COIN_PACKS)[number]): Promise<BuyCoinsResult> {
  const { res, txHash } = await purchaseCoinPack(pack.usdt);
  if (res !== "success" || !txHash) return { res };
  const credited = await creditTx(txHash);
  if (credited === null) {
    try {
      localStorage.setItem(PENDING_KEY, txHash);
    } catch {}
    return { res: "credit_pending" };
  }
  return { res: "success", coins: credited };
}

// Reintenta acreditar una compra pendiente (llamar junto a getCoinBalance).
export async function retryPendingCredit(): Promise<void> {
  let tx: string | null = null;
  try {
    tx = localStorage.getItem(PENDING_KEY);
  } catch {}
  if (!tx) return;
  const credited = await creditTx(tx);
  if (credited !== null) {
    try {
      localStorage.removeItem(PENDING_KEY);
    } catch {}
  }
}

// Llama al edge function. Devuelve las monedas acreditadas o null si falló.
// "ya acreditada" cuenta como éxito (idempotencia por hash en el servidor).
async function creditTx(txHash: string): Promise<number | null> {
  if (!useSupabase) return null;
  try {
    const r = await fetch(`${SUPA_URL}/functions/v1/credit-coins`, {
      method: "POST",
      headers: { ...HEADERS(), "Content-Type": "application/json" },
      body: JSON.stringify({ txHash }),
    });
    if (!r.ok) return null;
    const j = await r.json();
    return typeof j?.coins === "number" ? j.coins : 0;
  } catch {
    return null;
  }
}
