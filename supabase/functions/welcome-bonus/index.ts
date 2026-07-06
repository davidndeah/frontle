// ============================================================
//  Frontle — Edge Function "welcome-bonus" (faucet de bienvenida)
//  Da 0.10 USDT + un poco de CELO (una sola vez) a un usuario NUEVO que entra
//  por correo (Privy), para que pueda comprar pistas o reintentar. El CELO es
//  para el GAS: la wallet embebida de Privy no soporta feeCurrency (CIP-64),
//  así que sus transacciones pagan gas en CELO. Bordy le avisa en el front.
//
//  Anti-abuso (clave): NO confia en la direccion que manda el cliente. Verifica
//  el ACCESS TOKEN de Privy server-side (firma ES256 contra el JWKS del app),
//  saca el DID del usuario, consulta la API de Privy (Basic app_id:app_secret)
//  para obtener SU wallet embebida y su correo, y dedupe por DID + wallet.
//
//  Secrets requeridos (supabase secrets set ...):
//    SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY   (los inyecta Supabase)
//    PRIVY_APP_ID           app id de Privy (el mismo del front)
//    PRIVY_APP_SECRET       app secret de Privy (server-side; NUNCA en el repo)
//    FAUCET_PRIVATE_KEY     0x... wallet faucet dedicada (USDT + CELO para gas)
//    BONUS_DAILY_CAP        opcional, nº max de bonos/dia (default 100 = 10 USDT)
//    BONUS_GAS_CELO         opcional, CELO de gas por bono (default 0.01)
//    CELO_RPC_URL           opcional, default https://forno.celo.org
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { jwtVerify, createRemoteJWKSet } from "https://esm.sh/jose@5";
import {
  createPublicClient,
  createWalletClient,
  http,
  parseUnits,
  parseEther,
} from "https://esm.sh/viem@2.21.0";
import { privateKeyToAccount } from "https://esm.sh/viem@2.21.0/accounts";
import { celo } from "https://esm.sh/viem@2.21.0/chains";

const USDT = "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e" as const; // 6 dec
const TOKEN_DECIMALS = 6;
const BONUS = "0.10"; // USDT

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-privy-token, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const erc20Abi = [
  { type: "function", name: "transfer", inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }], stateMutability: "nonpayable" },
  { type: "function", name: "balanceOf", inputs: [{ name: "a", type: "address" }], outputs: [{ type: "uint256" }], stateMutability: "view" },
] as const;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const APP_ID = Deno.env.get("PRIVY_APP_ID")!;
    const APP_SECRET = Deno.env.get("PRIVY_APP_SECRET")!;
    const DAILY_CAP = Number(Deno.env.get("BONUS_DAILY_CAP") || "100");
    const rpcUrl = Deno.env.get("CELO_RPC_URL") || "https://forno.celo.org";

    // 1) Verificar el access token de Privy (prueba de login por correo real).
    const token = req.headers.get("x-privy-token") || "";
    if (!token) return json({ ok: false, error: "sin token" }, 401);

    const JWKS = createRemoteJWKSet(new URL(`https://auth.privy.io/api/v1/apps/${APP_ID}/jwks.json`));
    let did: string;
    try {
      const { payload } = await jwtVerify(token, JWKS, { issuer: "privy.io", audience: APP_ID });
      did = String(payload.sub);
    } catch {
      return json({ ok: false, error: "token invalido" }, 401);
    }
    if (!did) return json({ ok: false, error: "sin sujeto" }, 401);

    // 2) Consultar el usuario en Privy → SU wallet embebida y correo (no confiamos
    //    en nada que mande el cliente).
    const basic = btoa(`${APP_ID}:${APP_SECRET}`);
    const uRes = await fetch(`https://auth.privy.io/api/v1/users/${encodeURIComponent(did)}`, {
      headers: { Authorization: `Basic ${basic}`, "privy-app-id": APP_ID },
    });
    if (!uRes.ok) return json({ ok: false, error: "no se pudo leer el usuario de Privy" }, 502);
    const user = await uRes.json();
    const accounts: Array<Record<string, unknown>> = user?.linked_accounts ?? [];
    const embedded = accounts.find(
      (a) => a.type === "wallet" && (a.wallet_client_type === "privy" || a.walletClientType === "privy"),
    );
    const wallet = String((embedded?.address as string) || "").toLowerCase();
    const emailAcc = accounts.find((a) => a.type === "email");
    const email = (emailAcc?.address as string) || null;
    if (!/^0x[0-9a-f]{40}$/.test(wallet)) return json({ ok: false, error: "usuario sin wallet embebida" }, 400);

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // 3) Dedupe: ¿ya recibio el bono este DID o esta wallet?
    const { data: prev } = await supabase
      .from("welcome_bonus")
      .select("privy_did, tx_hash")
      .or(`privy_did.eq.${did},wallet_address.eq.${wallet}`)
      .limit(1);
    if (prev && prev.length > 0) {
      // Ya recibio el USDT. Compat: bonos entregados ANTES del regalo de gas
      // (o wallets que lo agotaron) quedan sin CELO y no pueden transaccionar
      // (la embebida de Privy paga gas en CELO, no soporta feeCurrency).
      // Top-up: si su saldo esta bajo el regalo, rellenar hasta una vez por
      // request. Costo maximo del abuso: ~0.01 CELO por login, despreciable.
      try {
        const GAS_CELO = Deno.env.get("BONUS_GAS_CELO") || "0.01";
        const gasRaw = parseEther(GAS_CELO);
        const publicClient = createPublicClient({ chain: celo, transport: http(rpcUrl) });
        const balCelo = await publicClient.getBalance({ address: wallet as `0x${string}` });
        if (balCelo < gasRaw / 2n) {
          const account = privateKeyToAccount(Deno.env.get("FAUCET_PRIVATE_KEY")! as `0x${string}`);
          const walletClient = createWalletClient({ account, chain: celo, transport: http(rpcUrl) });
          const gasTx = await walletClient.sendTransaction({ to: wallet as `0x${string}`, value: gasRaw });
          await publicClient.waitForTransactionReceipt({ hash: gasTx });
          return json({ ok: true, granted: false, reason: "ya recibido", gasTopup: GAS_CELO, gasTx });
        }
      } catch (topErr) {
        console.error("[bono] top-up de gas fallo:", topErr);
      }
      return json({ ok: true, granted: false, reason: "ya recibido" });
    }

    // 4) Tope diario (presupuesto): no pasar de BONUS_DAILY_CAP bonos/dia.
    const since = new Date(Date.now() - 86_400_000).toISOString();
    const { count } = await supabase
      .from("welcome_bonus")
      .select("privy_did", { count: "exact", head: true })
      .gte("created_at", since);
    if ((count ?? 0) >= DAILY_CAP) {
      return json({ ok: true, granted: false, reason: "cupo diario agotado" });
    }

    // 5) Reservar la fila ANTES de transferir (el unique la hace atomica contra
    //    llamadas concurrentes). Si choca, alguien la tomo → ya recibido.
    const amountRaw = parseUnits(BONUS, TOKEN_DECIMALS);
    const { error: insErr } = await supabase.from("welcome_bonus").insert({
      privy_did: did, wallet_address: wallet, email, amount_raw: amountRaw.toString(), tx_hash: null,
    });
    if (insErr) {
      // 23505 = unique_violation (carrera): tratamos como ya recibido.
      return json({ ok: true, granted: false, reason: "ya recibido" });
    }

    // 6) Transferir 0.10 USDT + CELO de gas desde el faucet. Si falla, liberar
    //    la reserva. Se verifican AMBOS saldos antes de enviar nada, para no
    //    quedar a medias (CELO enviado pero USDT no, o viceversa).
    try {
      const GAS_CELO = Deno.env.get("BONUS_GAS_CELO") || "0.01";
      const gasRaw = parseEther(GAS_CELO);
      const account = privateKeyToAccount(Deno.env.get("FAUCET_PRIVATE_KEY")! as `0x${string}`);
      const publicClient = createPublicClient({ chain: celo, transport: http(rpcUrl) });
      const walletClient = createWalletClient({ account, chain: celo, transport: http(rpcUrl) });

      const bal = await publicClient.readContract({ address: USDT, abi: erc20Abi, functionName: "balanceOf", args: [account.address] });
      if (bal < amountRaw) throw new Error("faucet sin USDT suficiente");
      // El regalo de gas + margen para pagar las 2 tx del propio faucet.
      const celoBal = await publicClient.getBalance({ address: account.address });
      if (celoBal < gasRaw + parseEther("0.005")) throw new Error("faucet sin CELO suficiente");

      // Primero el CELO (barato): si el USDT fallara después, liberar la
      // reserva solo re-regala centavos de gas, nunca duplica el USDT.
      const gasTx = await walletClient.sendTransaction({ to: wallet as `0x${string}`, value: gasRaw });
      await publicClient.waitForTransactionReceipt({ hash: gasTx });

      const tx = await walletClient.writeContract({
        address: USDT, abi: erc20Abi, functionName: "transfer", args: [wallet as `0x${string}`, amountRaw],
      });
      await publicClient.waitForTransactionReceipt({ hash: tx });

      await supabase.from("welcome_bonus").update({ tx_hash: tx }).eq("privy_did", did);
      return json({ ok: true, granted: true, amount: BONUS, gas: GAS_CELO, tx, gasTx });
    } catch (sendErr) {
      // Liberar la reserva para que pueda reintentar en otro login.
      await supabase.from("welcome_bonus").delete().eq("privy_did", did);
      return json({ ok: false, error: `transferencia fallo: ${String((sendErr as Error)?.message ?? sendErr)}` }, 502);
    }
  } catch (err) {
    return json({ ok: false, error: String((err as Error)?.message ?? err) }, 500);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}
