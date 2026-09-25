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
//  Reenvío al pot (migración 0016): la compra es UN solo `USDT.transfer` a la
//  tesorería —MiniPay pidió quitar el approve— y la tesorería ES el operador.
//  Tras acreditar, esta función llama `fundPot` en FrontleWeekly con lo
//  pendiente, así el 100% sigue yendo al pot de la semana. Va en segundo
//  plano: el crédito del jugador no espera a esa tx.
//
//  Secrets: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (inyectados) ·
//  CELO_RPC_URL opcional (default forno) · COIN_TREASURY opcional ·
//  WEEKLY_ADDRESS + OPERATOR_PRIVATE_KEY (los mismos de close-week) para el
//  reenvío; sin ellos las compras quedan en cola y se reenvían al ponerlos.
// ============================================================

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createPublicClient, createWalletClient, http, maxUint256 } from "https://esm.sh/viem@2.21.0";
import { privateKeyToAccount } from "https://esm.sh/viem@2.21.0/accounts";
import { celo } from "https://esm.sh/viem@2.21.0/chains";

const USDT = "0x48065fbbe25f71c9282ddf5e1cd6d6a887483d5e"; // 6 dec, lowercase
const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
// keccak256("CoinsPurchased(address,uint256,uint256)") — evento de FrontleWeekly.
const COINS_PURCHASED_TOPIC = "0xe42c627940ae035b15bcb45ba29d47ff8b9716b27a4b993b5513d8c0516dc1ed";
const DEFAULT_TREASURY = "0x54e83c8d7b7a77cbf0a2842c1a82d51be8814dd0";

const PACKS: Record<string, number> = { "500000": 50, "1000000": 110, "2500000": 300 }; // wei USDT → 🪙

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const erc20Abi = [
  { type: "function", name: "balanceOf", inputs: [{ name: "a", type: "address" }], outputs: [{ type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "allowance", inputs: [{ name: "o", type: "address" }, { name: "s", type: "address" }], outputs: [{ type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "approve", inputs: [{ name: "s", type: "address" }, { name: "v", type: "uint256" }], outputs: [{ type: "bool" }], stateMutability: "nonpayable" },
] as const;
const weeklyFundAbi = [
  { type: "function", name: "fundPot", inputs: [{ name: "amount", type: "uint256" }], outputs: [], stateMutability: "nonpayable" },
] as const;

// Supabase Edge: deja correr una promesa después de responder.
declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;

// Reenvía al pot semanal TODAS las compras pendientes de la cola en un solo
// fundPot. Cada fila se "toma" con un UPDATE condicionado (atómico por fila):
// dos invocaciones a la vez nunca reenvían la misma compra. Si algo falla
// ANTES de emitir la tx, las filas vuelven a pendiente y las recoge la
// próxima compra. fundPot suma a la semana EN CURSO, así que una compra hecha
// segundos antes del corte del lunes puede caer en la semana nueva.
async function forwardPendingToPot(supa: SupabaseClient, rpcUrl: string, treasury: string): Promise<void> {
  const weekly = (Deno.env.get("WEEKLY_ADDRESS") ?? "") as `0x${string}`;
  const pk = Deno.env.get("OPERATOR_PRIVATE_KEY") as `0x${string}` | undefined;
  if (!/^0x[0-9a-fA-F]{40}$/.test(weekly) || !pk) return; // queda en cola

  const account = privateKeyToAccount(pk);
  if (account.address.toLowerCase() !== treasury) {
    console.error("[credit-coins] OPERATOR_PRIVATE_KEY no es la tesorería: no se reenvía");
    return;
  }

  const claim = `claim:${crypto.randomUUID()}`;
  const { data: rows, error } = await supa
    .from("coin_pot_forwards")
    .update({ forwarded_tx: claim, claimed_at: new Date().toISOString() })
    .is("forwarded_tx", null)
    .select("ref, amount_wei");
  if (error) return console.error("[credit-coins] no se pudo tomar la cola:", error);
  if (!rows?.length) return;

  const total = rows.reduce((acc, r) => acc + BigInt(String(r.amount_wei)), 0n);
  const release = (tag: string) =>
    supa.from("coin_pot_forwards").update({ forwarded_tx: null, claimed_at: null }).eq("forwarded_tx", tag);

  const publicClient = createPublicClient({ chain: celo, transport: http(rpcUrl) });
  const walletClient = createWalletClient({ account, chain: celo, transport: http(rpcUrl) });
  const usdt = USDT as `0x${string}`;
  let hash: `0x${string}`;
  try {
    const bal = await publicClient.readContract({ address: usdt, abi: erc20Abi, functionName: "balanceOf", args: [account.address] });
    if (bal < total) throw new Error(`tesorería sin saldo: ${bal} < ${total}`);
    const allowance = await publicClient.readContract({ address: usdt, abi: erc20Abi, functionName: "allowance", args: [account.address, weekly] });
    if (allowance < total) {
      // Una sola vez: la tesorería autoriza al contrato semanal para siempre.
      const approveHash = await walletClient.writeContract({ address: usdt, abi: erc20Abi, functionName: "approve", args: [weekly, maxUint256] });
      await publicClient.waitForTransactionReceipt({ hash: approveHash });
    }
    hash = await walletClient.writeContract({ address: weekly, abi: weeklyFundAbi, functionName: "fundPot", args: [total] });
  } catch (err) {
    console.error("[credit-coins] fundPot no se emitió, vuelve a la cola:", err);
    await release(claim);
    return;
  }

  // Emitida: se anota YA, antes de esperar el receipt, para que un corte aquí
  // no deje filas "tomadas" sin rastro de la tx que las reenvió.
  await supa.from("coin_pot_forwards").update({ forwarded_tx: hash }).eq("forwarded_tx", claim);
  try {
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") {
      console.error("[credit-coins] fundPot revirtió, vuelve a la cola:", hash);
      await release(hash);
    }
  } catch (err) {
    // Sin receipt no se sabe si entró: NO se libera (podría duplicar el pot).
    console.error("[credit-coins] fundPot sin confirmar, revisar a mano:", hash, err);
  }
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const { txHash, secret } = await req.json().catch(() => ({}));
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

    // Camino 1 (definitivo): evento CoinsPurchased del contrato FrontleWeekly.
    //   topics[1] = player, topics[2] = week, data = amount.
    // Camino 2 (interino, mientras el contrato no esté desplegado): Transfer de
    //   USDT a la tesorería del operador. topics[1] = from, topics[2] = to.
    const weeklyAddr = (Deno.env.get("WEEKLY_ADDRESS") || "").toLowerCase();
    const logs = receipt.logs ?? [];

    let payer = "";
    let wei = 0n;
    // Compra por transfer directo a la tesorería → hay que reenviarla al pot.
    let needsForward = false;

    const purchase = weeklyAddr
      ? logs.find(
        (l: { address?: string; topics?: string[] }) =>
          String(l.address).toLowerCase() === weeklyAddr && l.topics?.[0] === COINS_PURCHASED_TOPIC
      )
      : undefined;

    if (purchase) {
      payer = `0x${String(purchase.topics[1]).slice(-40)}`.toLowerCase();
      wei = BigInt(purchase.data);
    } else {
      const transfer = logs.find(
        (l: { address?: string; topics?: string[] }) =>
          String(l.address).toLowerCase() === USDT &&
          l.topics?.[0] === TRANSFER_TOPIC &&
          `0x${String(l.topics?.[2] ?? "").slice(-40)}`.toLowerCase() === treasury
      );
      if (!transfer) return json(400, { error: "la tx no es una compra de monedas" });
      payer = `0x${String(transfer.topics[1]).slice(-40)}`.toLowerCase();
      wei = BigInt(transfer.data);
      needsForward = true;
    }
    // 1 🪙 = $0.01 = 10_000 wei de USDT (6 dec). Paquetes exactos con bonus.
    const coins = PACKS[wei.toString()] ?? Number(wei / 10_000n);
    if (coins <= 0) return json(400, { error: "monto demasiado pequeño" });

    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Recuperación cross-device: la tx prueba que quien compra controla la
    // wallet, así que su dispositivo pasa a ser el dueño de la identidad de
    // gasto. Sin esto, cambiar de teléfono dejaría las monedas inutilizables.
    if (typeof secret === "string" && secret.length >= 16) {
      const hashBuf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
      const secretHash = Array.from(new Uint8Array(hashBuf), (b) => b.toString(16).padStart(2, "0")).join("");
      await supa
        .from("player_secrets")
        .upsert({ player_id: payer, secret_hash: secretHash, updated_at: new Date().toISOString() }, { onConflict: "player_id" });
    }

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

    // A la cola del pot SOLO si el crédito es nuevo: un hash ya acreditado
    // (p. ej. un transfer viejo a la tesorería, de antes de este flujo, cuyo
    // dinero ya se sembró a mano) no debe volver a llenar el pot.
    if (needsForward && !error) {
      const { error: qErr } = await supa
        .from("coin_pot_forwards")
        .upsert({ ref: txHash.toLowerCase(), amount_wei: wei.toString() }, { onConflict: "ref", ignoreDuplicates: true });
      if (qErr) console.error("[credit-coins] no se pudo encolar el reenvío al pot, sembrar a mano:", txHash, wei, qErr);
    }

    // El reenvío al pot no bloquea la respuesta: el jugador ya tiene sus monedas.
    const forward = forwardPendingToPot(supa, rpcUrl, treasury).catch((e) => console.error("[credit-coins] reenvío:", e));
    if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(forward);
    else await forward;

    return json(200, { coins, player: payer, alreadyCredited: Boolean(error) });
  } catch (err) {
    console.error("[credit-coins] error:", err);
    return json(500, { error: "error interno" });
  }
});
