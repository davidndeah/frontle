// ============================================================
//  Frontle v2 — Edge Function "credit-coins" (Fase 2, PLAN-FRONTLE-V2 §5)
//  Acredita un paquete de monedas DESPUÉS de verificar la compra on-chain.
//
//  Anti-abuso: NO confía en nada del cliente salvo el hash. Lee el receipt
//  del RPC y exige un Transfer de USDT hacia la TESORERÍA; el pagador (from
//  del log) es quien recibe el crédito — no se puede acreditar a otro. El
//  índice único sobre el hash hace la acreditación idempotente: reintentar
//  devuelve lo ya acreditado, nunca duplica.
//
//  Paquetes exactos (0.50→50, 1.00→110, 2.50→300); cualquier otro monto se
//  acredita sin bonus a 1 🪙 = $0.01 (floor).
//
//  Secrets: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (inyectados) ·
//  CELO_RPC_URL opcional (default forno) · COIN_TREASURY opcional.
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const USDT = "0x48065fbbe25f71c9282ddf5e1cd6d6a887483d5e"; // 6 dec, lowercase
const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const DEFAULT_TREASURY = "0x54e83c8d7b7a77cbf0a2842c1a82d51be8814dd0";

const PACKS: Record<string, number> = { "500000": 50, "1000000": 110, "2500000": 300 }; // wei USDT → 🪙

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const { txHash } = await req.json().catch(() => ({}));
    if (!/^0x[0-9a-fA-F]{64}$/.test(String(txHash ?? ""))) return json(400, { error: "txHash inválido" });

    const rpcUrl = Deno.env.get("CELO_RPC_URL") || "https://forno.celo.org";
    const treasury = (Deno.env.get("COIN_TREASURY") || DEFAULT_TREASURY).toLowerCase();

    const rpc = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_getTransactionReceipt", params: [txHash] }),
    });
    const receipt = (await rpc.json())?.result;
    if (!receipt) return json(404, { error: "tx no encontrada (¿aún sin confirmar?)" });
    if (receipt.status !== "0x1") return json(400, { error: "la tx falló on-chain" });

    // Transfer USDT → tesorería. topics[1] = from (pagador), topics[2] = to.
    const log = (receipt.logs ?? []).find(
      (l: { address?: string; topics?: string[] }) =>
        String(l.address).toLowerCase() === USDT &&
        l.topics?.[0] === TRANSFER_TOPIC &&
        `0x${String(l.topics?.[2] ?? "").slice(-40)}`.toLowerCase() === treasury
    );
    if (!log) return json(400, { error: "la tx no es una compra de monedas" });

    const payer = `0x${String(log.topics[1]).slice(-40)}`.toLowerCase();
    const wei = BigInt(log.data);
    // 1 🪙 = $0.01 = 10_000 wei de USDT (6 dec). Paquetes exactos con bonus.
    const coins = PACKS[wei.toString()] ?? Number(wei / 10_000n);
    if (coins <= 0) return json(400, { error: "monto demasiado pequeño" });

    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { error } = await supa.from("coin_ledger").insert({
      player_id: payer,
      kind: "purchase",
      amount: coins,
      ref: txHash.toLowerCase(),
    });
    // 23505 = unique_violation: ya acreditada — idempotente, contestar éxito.
    if (error && error.code !== "23505") {
      console.error("[credit-coins] insert falló:", error);
      return json(500, { error: "no se pudo acreditar" });
    }
    return json(200, { coins, player: payer, alreadyCredited: Boolean(error) });
  } catch (err) {
    console.error("[credit-coins] error:", err);
    return json(500, { error: "error interno" });
  }
});
