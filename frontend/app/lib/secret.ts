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
//  first-write-wins. Si el jugador cambia de dispositivo, la vía de
//  recuperación es COMPRAR monedas — la tx on-chain prueba que controla la
//  wallet, y `credit-coins` rota el secret al del dispositivo nuevo.
// ============================================================

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
// player_id pertenece a otro dispositivo: hay que recuperar con una compra.
export async function ensureSecret(): Promise<boolean> {
  if (!SUPA_URL || !SUPA_KEY) return false;
  const secret = localSecret();
  const player = xpPlayerId();
  if (!secret || !player) return false;
  try {
    const r = await fetch(`${SUPA_URL}/rest/v1/rpc/claim_player_secret`, {
      method: "POST",
      headers: {
        apikey: SUPA_KEY,
        Authorization: `Bearer ${SUPA_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ p_player: player, p_secret: secret }),
    });
    if (!r.ok) return false;
    return (await r.json()) === true;
  } catch {
    return false;
  }
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
