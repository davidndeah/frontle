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
import { ensureSecret, localSecret, rpc } from "./secret";

// Precio unitario del plan §5.1. Los paquetes grandes traen bonus; comprar
// suelto siempre sale a esta tarifa, sin recargo ni descuento.
export const COIN_UNIT_USDT = 0.01;

// Un lote comprable: cuántas monedas y cuánto cuesta.
export interface CoinLot {
  coins: number;
  usdt: number;
}

// Paquetes del plan §5.1 (1 🪙 = $0.01; los grandes traen bonus).
export const COIN_PACKS: readonly CoinLot[] = [
  { coins: 50, usdt: 0.5 },
  { coins: 110, usdt: 1.0 },
  { coins: 300, usdt: 2.5 },
];

// Compra suelta, para quien solo necesita una pista y no un paquete. Sin
// bonus: sale a tarifa plana. `credit-coins` ya acredita cualquier monto a
// 1 🪙 = $0.01 (su fallback), así que el servidor no necesita cambios.
export const COIN_UNITS: readonly CoinLot[] = [1, 2, 5, 10].map((coins) => ({
  coins,
  // Redondeo a 2 decimales: 3*0.01 en coma flotante da 0.030000000000000002,
  // y ese sobrante llegaría a parseUnits como monto no representable.
  usdt: Math.round(coins * COIN_UNIT_USDT * 100) / 100,
}));

// Ítems de gasto. Deben coincidir con el check `coin_shape` de coin_ledger,
// hoy en la 0015 — NO en la 0009, que es donde nacieron: el congelador bajó de
// 15 a 5 🪙 en la 0015 y aquí se quedó en 15. El servidor manda (fija el precio
// en `buy_streak_freeze`), así que el desajuste solo mentía en pantalla.
export const COIN_COSTS = {
  spend_hint: 3,
  spend_hint_strong: 5,
  spend_attempt: 5,
  spend_freeze: 5,
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

export type SpendResult = "ok" | "insufficient" | "identity" | "error";

// Gasta un ítem. Pasa por `spend_coins` en el servidor: verifica la identidad
// (secret), fija el precio y aborta si el saldo no alcanza — el cliente no
// puede gastar el saldo de otro ni inventarse el importe.
export async function spendCoins(kind: SpendKind, ref?: string): Promise<SpendResult> {
  if (!useSupabase) return "error";
  if (!(await ensureSecret())) return "identity";
  const r = await rpc<number>("spend_coins", {
    p_player: xpPlayerId(),
    p_secret: localSecret(),
    p_kind: kind,
    p_ref: ref ?? null,
  });
  if (r.ok) return "ok";
  if (r.code === "P0001") return "insufficient";
  if (r.code === "P0002") return "identity";
  return "error";
}

export type BuyCoinsResult = { res: PayResult | "credit_pending"; coins?: number };

// Compra un paquete: transfer on-chain + acreditación verificada del server.
// "credit_pending" = la tx se confirmó pero la acreditación falló — el hash
// queda en localStorage y se reintenta en la próxima consulta de saldo.
const PENDING_KEY = "frontle-coins-pending-tx";

export async function buyCoinPack(pack: CoinLot): Promise<BuyCoinsResult> {
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
      // El secret viaja con la compra: la tx on-chain prueba que el jugador
      // controla la wallet, así que el servidor puede (re)ligar la identidad
      // de gasto a ESTE dispositivo. Es la vía de recuperación cross-device.
      body: JSON.stringify({ txHash, secret: localSecret() }),
    });
    if (!r.ok) return null;
    const j = await r.json();
    return typeof j?.coins === "number" ? j.coins : 0;
  } catch {
    return null;
  }
}
