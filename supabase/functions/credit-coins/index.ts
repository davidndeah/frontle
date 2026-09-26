// ============================================================
//  Frontle v2 — Edge Function "credit-coins" (Fase 2, PLAN-FRONTLE-V2 §5)
//  Verifica los pagos por `USDT.transfer` a la tesorería y los reenvía al
//  pot que toca. Dos tipos, según `kind` en el body:
//
//   · (sin kind) COMPRA DE MONEDAS — acredita el paquete y encola el monto
//     completo para el pot SEMANAL (FrontleWeekly.fundPot).
//   · kind = "daily" — PISTA o REINTENTO del juego diario. No acredita nada
//     (el cliente ya mostró la pista); encola el monto menos la parte del
//     protocolo para el pot DIARIO (FrontleGame.fundPot). Es el mismo
//     reparto que hacía `_collect` en el contrato.
//
//  Por qué transfer y no el contrato: MiniPay pidió una sola confirmación, y
//  sin signTypedData (permit) ni batching, approve + llamada son dos.
//
//  Anti-abuso: NO confía en nada del cliente salvo el hash. Lee la tx y el
//  receipt del RPC; el pagador sale de la tx, no del cliente. Los pagos del
//  juego llevan una ETIQUETA al final del calldata del transfer (el token la
//  ignora) firmada por el jugador: así una pista de 0.05 no se puede cobrar
//  como 5 monedas ni al revés, aunque el monto coincida y el hash sea público.
//  El hash es clave única en la cola y en el ledger: nada se reenvía ni se
//  acredita dos veces.
//
//  Paquetes exactos (0.50→50, 1.00→110, 2.50→300); cualquier otro monto se
//  acredita sin bonus a 1 🪙 = $0.01 (floor).
//
//  Secrets: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (inyectados) ·
//  CELO_RPC_URL opcional (default forno) · COIN_TREASURY opcional ·
//  WEEKLY_ADDRESS, GAME_ADDRESS y OPERATOR_PRIVATE_KEY (los de close-week /
//  close-day) para el reenvío; sin ellos los pagos quedan en cola.
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
const TRANSFER_SELECTOR = "0xa9059cbb";

// Etiqueta de los pagos del juego diario: "FRTL" + 1 byte de propósito, al
// final del calldata. Debe coincidir con DAILY_TAG en frontend/app/lib/payments.ts.
const DAILY_TAG = "4652544c";
const DAILY_PURPOSES: Record<string, string> = {
  "01": "attempt",
  "02": "hint_initial",
  "03": "hint_next",
  "04": "hint_all",
};
// calldata de transfer(address,uint256) = 4 + 32 + 32 bytes; + 5 de etiqueta.
const TRANSFER_INPUT_LEN = 2 + (4 + 64) * 2;
const TAGGED_INPUT_LEN = TRANSFER_INPUT_LEN + 10;

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
// FrontleWeekly y FrontleGame exponen el mismo fundPot(uint256).
const fundPotAbi = [
  { type: "function", name: "fundPot", inputs: [{ name: "amount", type: "uint256" }], outputs: [], stateMutability: "nonpayable" },
] as const;
const protocolBpsAbi = [
  { type: "function", name: "protocolBps", inputs: [], outputs: [{ type: "uint256" }], stateMutability: "view" },
] as const;

type Target = "weekly" | "daily";

// Supabase Edge: deja correr una promesa después de responder.
declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;

const isAddress = (a: string): a is `0x${string}` => /^0x[0-9a-fA-F]{40}$/.test(a);

// Reenvía al pot de `target` TODO lo pendiente de la cola en un solo fundPot.
// Cada fila se "toma" con un UPDATE condicionado (atómico por fila): dos
// invocaciones a la vez nunca reenvían el mismo pago. Si algo falla ANTES de
// emitir la tx, las filas vuelven a pendiente y las recoge el próximo pago.
// fundPot suma al periodo EN CURSO (día o semana), así que un pago hecho
// segundos antes del corte puede caer en el siguiente.
async function forwardPending(
  supa: SupabaseClient,
  rpcUrl: string,
  treasury: string,
  target: Target,
  potAddress: string
): Promise<void> {
  const pk = Deno.env.get("OPERATOR_PRIVATE_KEY") as `0x${string}` | undefined;
  if (!isAddress(potAddress) || !pk) return; // queda en cola

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
    .eq("target", target)
    .select("ref, amount_wei");
  if (error) return console.error(`[credit-coins] no se pudo tomar la cola ${target}:`, error);
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
    const allowance = await publicClient.readContract({ address: usdt, abi: erc20Abi, functionName: "allowance", args: [account.address, potAddress] });
    if (allowance < total) {
      // Una sola vez por contrato: la tesorería lo autoriza para siempre.
      const approveHash = await walletClient.writeContract({ address: usdt, abi: erc20Abi, functionName: "approve", args: [potAddress, maxUint256] });
      await publicClient.waitForTransactionReceipt({ hash: approveHash });
    }
    hash = await walletClient.writeContract({ address: potAddress, abi: fundPotAbi, functionName: "fundPot", args: [total] });
  } catch (err) {
    console.error(`[credit-coins] fundPot ${target} no se emitió, vuelve a la cola:`, err);
    await release(claim);
    return;
  }

  // Emitida: se anota YA, antes de esperar el receipt, para que un corte aquí
  // no deje filas "tomadas" sin rastro de la tx que las reenvió.
  await supa.from("coin_pot_forwards").update({ forwarded_tx: hash }).eq("forwarded_tx", claim);
  try {
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") {
      console.error(`[credit-coins] fundPot ${target} revirtió, vuelve a la cola:`, hash);
      await release(hash);
    }
  } catch (err) {
    // Sin receipt no se sabe si entró: NO se libera (podría duplicar el pot).
    console.error(`[credit-coins] fundPot ${target} sin confirmar, revisar a mano:`, hash, err);
  }
}

// Ambos pots, uno detrás de otro: misma llave, así no chocan los nonces.
async function forwardAll(supa: SupabaseClient, rpcUrl: string, treasury: string): Promise<void> {
  await forwardPending(supa, rpcUrl, treasury, "weekly", Deno.env.get("WEEKLY_ADDRESS") ?? "");
  await forwardPending(supa, rpcUrl, treasury, "daily", Deno.env.get("GAME_ADDRESS") ?? "");
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

async function rpcCall(rpcUrl: string, method: string, params: unknown[]) {
  const r = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  return (await r.json())?.result;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const { txHash, secret, kind } = await req.json().catch(() => ({}));
    if (!/^0x[0-9a-fA-F]{64}$/.test(String(txHash ?? ""))) return json(400, { error: "txHash inválido" });
    const ref = String(txHash).toLowerCase();

    const rpcUrl = Deno.env.get("CELO_RPC_URL") || "https://forno.celo.org";
    const treasury = (Deno.env.get("COIN_TREASURY") || DEFAULT_TREASURY).toLowerCase();

    const [receipt, tx] = await Promise.all([
      rpcCall(rpcUrl, "eth_getTransactionReceipt", [txHash]),
      rpcCall(rpcUrl, "eth_getTransactionByHash", [txHash]),
    ]);
    if (!receipt || !tx) return json(404, { error: "tx no encontrada (¿aún sin confirmar?)" });
    if (receipt.status !== "0x1") return json(400, { error: "la tx falló on-chain" });

    // ¿Es un transfer DIRECTO de USDT a la tesorería? Solo entonces el
    // calldata dice a quién y cuánto, y puede llevar la etiqueta del juego.
    const input = String(tx.input ?? "").toLowerCase();
    const directTransfer =
      String(tx.to ?? "").toLowerCase() === USDT &&
      input.startsWith(TRANSFER_SELECTOR) &&
      `0x${input.slice(34, 74)}` === treasury;
    const taggedDaily =
      directTransfer && input.length === TAGGED_INPUT_LEN && input.slice(TRANSFER_INPUT_LEN, TRANSFER_INPUT_LEN + 8) === DAILY_TAG;

    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // ---- Pista / reintento del juego diario --------------------------------
    if (kind === "daily") {
      if (!taggedDaily) return json(400, { error: "la tx no es un pago del juego diario" });
      const purpose = DAILY_PURPOSES[input.slice(-2)];
      if (!purpose) return json(400, { error: "propósito desconocido" });
      const wei = BigInt(`0x${input.slice(74, 138)}`);
      if (wei <= 0n) return json(400, { error: "monto inválido" });

      // La parte del protocolo se queda en la tesorería; el resto, al pot del
      // día — el mismo reparto que `_collect`. Se lee del contrato por si cambia.
      const gameAddress = Deno.env.get("GAME_ADDRESS") ?? "";
      if (!isAddress(gameAddress)) return json(500, { error: "GAME_ADDRESS sin configurar" });
      const publicClient = createPublicClient({ chain: celo, transport: http(rpcUrl) });
      const bps = await publicClient.readContract({ address: gameAddress, abi: protocolBpsAbi, functionName: "protocolBps" });
      const toPot = wei - (wei * bps) / 10_000n;

      const { error } = await supa
        .from("coin_pot_forwards")
        .upsert({ ref, amount_wei: toPot.toString(), target: "daily", purpose }, { onConflict: "ref", ignoreDuplicates: true });
      if (error) {
        console.error("[credit-coins] no se pudo encolar el pago diario:", error);
        return json(500, { error: "no se pudo registrar" });
      }

      const forward = forwardAll(supa, rpcUrl, treasury).catch((e) => console.error("[credit-coins] reenvío:", e));
      if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(forward);
      else await forward;
      return json(200, { ok: true, purpose });
    }

    // ---- Compra de monedas ---------------------------------------------------
    // Un pago etiquetado del juego NUNCA se acredita como monedas.
    if (taggedDaily) return json(400, { error: "este pago es del juego diario, no una compra de monedas" });

    // Camino 1 (antiguo): evento CoinsPurchased del contrato FrontleWeekly —
    //   compras hechas antes del cambio a transfer, reintentadas ahora.
    // Camino 2 (actual): Transfer de USDT a la tesorería.
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
      ref,
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
        .upsert({ ref, amount_wei: wei.toString(), target: "weekly", purpose: "coins" }, { onConflict: "ref", ignoreDuplicates: true });
      if (qErr) console.error("[credit-coins] no se pudo encolar el reenvío al pot, sembrar a mano:", txHash, wei, qErr);
    }

    // El reenvío al pot no bloquea la respuesta: el jugador ya tiene sus monedas.
    const forward = forwardAll(supa, rpcUrl, treasury).catch((e) => console.error("[credit-coins] reenvío:", e));
    if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(forward);
    else await forward;

    return json(200, { coins, player: payer, alreadyCredited: Boolean(error) });
  } catch (err) {
    console.error("[credit-coins] error:", err);
    return json(500, { error: "error interno" });
  }
});
