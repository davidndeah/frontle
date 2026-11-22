// ============================================================
//  Frontle v2 — Secret de gasto (Fase 3)
//
//  Por qué existe: sin él, cualquiera podía insertar un GASTO con el
//  player_id de otro (las direcciones son públicas en el ranking) y drenarle
//  las monedas, que se compran con dinero real. Ahora todo gasto pasa por
//  una función del servidor que exige este secret.
//
//  MiniPay PROHÍBE `personal_sign`, así que no hay firma de wallet posible:
//  el secret lo genera el navegador y se liga al player_id con
//  first-write-wins. El registro va por la función `game` (claim_secret),
//  que limita los registros nuevos por IP: sin eso, un script registraba el
//  secret de wallets ajenas. La app lo registra en cuanto conoce la wallet
//  (page.tsx), no recién al gastar, para que no quede el hueco abierto.
//
//  Si la wallet ya está ligada a otro dispositivo (cambio de teléfono, o
//  alguien la registró antes), `recoverIdentity` la recupera con una tx de
//  0 USDT que prueba que es tuya. Comprar monedas también la rota
//  (`credit-coins`), como antes.
// ============================================================

import type { IdentityProofResult } from "./payments";
import { xpPlayerId } from "./xp";

const KEY = "frontle-spend-secret";

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPA_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function localSecret(): string {
  try {
    let s = localStorage.getItem(KEY);
    if (!s) {
      const buf = new Uint8Array(24);
      (globalThis.crypto ?? ({} as Crypto)).getRandomValues?.(buf);
      s = Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
      // Fallback por si no hay WebCrypto (navegadores muy viejos).
      if (s.length < 16) s = `${Date.now().toString(16)}${Math.random().toString(16).slice(2)}${Math.random().toString(16).slice(2)}`;
      localStorage.setItem(KEY, s);
    }
    return s;
  } catch {
    return "";
  }
}

// Liga el secret al jugador (o confirma que ya es suyo). `false` = el
// player_id pertenece a otro dispositivo: hay que recuperarlo.
export async function ensureSecret(): Promise<boolean> {
  if (!SUPA_URL || !SUPA_KEY) return false;
  const secret = localSecret();
  const player = xpPlayerId();
  if (!secret || !player) return false;
  try {
    const r = await fetch(`${SUPA_URL}/functions/v1/game`, {
      method: "POST",
      headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ action: "claim_secret", player, secret }),
    });
    const j = (await r.json().catch(() => null)) as { ok?: boolean; mine?: boolean; error?: string } | null;
    if (j?.ok) return j.mine === true;
    // Función sin desplegar todavía (no conoce la acción): la vía de siempre.
    if (j?.error === "bad_action") return claimDirect(player, secret);
    return false;
  } catch {
    return false;
  }
}

// Registro directo de antes (claim_player_secret). Solo de respaldo mientras
// la función `game` no tenga claim_secret; la migración 0036 lo cierra.
async function claimDirect(player: string, secret: string): Promise<boolean> {
  try {
    const r = await fetch(`${SUPA_URL}/rest/v1/rpc/claim_player_secret`, {
      method: "POST",
      headers: { apikey: SUPA_KEY!, Authorization: `Bearer ${SUPA_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_player: player, p_secret: secret }),
    });
    if (!r.ok) return false;
    return (await r.json()) === true;
  } catch {
    return false;
  }
}

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

export type RecoverResult = IdentityProofResult | "rejected";

// Recupera la wallet en ESTE dispositivo: manda la tx de prueba (0 USDT, solo
// la comisión de red) y le pide al servidor que rote el secret a este.
export async function recoverIdentity(): Promise<RecoverResult> {
  if (!SUPA_URL || !SUPA_KEY) return "error";
  const secret = localSecret();
  const player = xpPlayerId();
  if (!secret || !/^0x[0-9a-f]{40}$/.test(player)) return "error";
  // payments (viem) se carga solo aquí: secret.ts va en la carga inicial.
  const { sendIdentityProof } = await import("./payments");
  const { res, txHash } = await sendIdentityProof(player, await sha256Hex(secret));
  if (res !== "success" || !txHash) return res;
  // El nodo que lee el servidor puede ir un bloque atrás: unos reintentos.
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch(`${SUPA_URL}/functions/v1/game`, {
        method: "POST",
        headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "recover_secret", player, secret, tx: txHash }),
      });
      const j = (await r.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (j?.ok) return "success";
      if (j?.error && j.error !== "tx_not_found") return "rejected";
    } catch {}
    await new Promise((ok) => setTimeout(ok, 1500 * (i + 1)));
  }
  return "error";
}

// Llama a una función del servidor con la identidad del jugador. Devuelve el
// resultado, o el `code` del error de Postgres para que la UI lo traduzca.
export async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<{ ok: true; data: T } | { ok: false; code: string }> {
  if (!SUPA_URL || !SUPA_KEY) return { ok: false, code: "NO_BACKEND" };
  try {
    const r = await fetch(`${SUPA_URL}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers: {
        apikey: SUPA_KEY,
        Authorization: `Bearer ${SUPA_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(args),
    });
    const body = await r.json().catch(() => null);
    if (r.ok) return { ok: true, data: body as T };
    return { ok: false, code: String((body as { code?: string })?.code ?? "ERROR") };
  } catch {
    return { ok: false, code: "ERROR" };
  }
}
