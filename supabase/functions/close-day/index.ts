// ============================================================
//  Frontle — Edge Function "close-day"
//  Cierra el ciclo diario: lee el ganador del ranking, llama rollDay()
//  on-chain (firma el OPERATOR) y registra la fila en la tabla `winners`.
//
//  Pensada para ejecutarse 1 vez/día por cron (pg_cron / Scheduled Function),
//  poco después del cierre del día UTC. Es idempotente: si el día ya está
//  en `winners`, no hace nada.
//
//  Secrets requeridos (supabase secrets set ...):
//    SUPABASE_URL                 (lo inyecta Supabase)
//    SUPABASE_SERVICE_ROLE_KEY    (lo inyecta Supabase)
//    OPERATOR_PRIVATE_KEY         0x... wallet operator (debe tener CELO para gas)
//    GAME_ADDRESS                 0x7Ea1…Fa09 (FrontleGame en Mainnet)
//    CELO_RPC_URL                 opcional, por defecto https://forno.celo.org
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  createPublicClient,
  createWalletClient,
  http,
  formatUnits,
} from "https://esm.sh/viem@2.21.0";
import { privateKeyToAccount } from "https://esm.sh/viem@2.21.0/accounts";
import { celo } from "https://esm.sh/viem@2.21.0/chains";

const TOKEN_DECIMALS = 6; // USDT

const gameAbi = [
  { type: "function", name: "currentDay", inputs: [], outputs: [{ type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "pot", inputs: [{ name: "day", type: "uint256" }], outputs: [{ type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "rolled", inputs: [{ name: "day", type: "uint256" }], outputs: [{ type: "bool" }], stateMutability: "view" },
  { type: "function", name: "rollDay", inputs: [{ name: "day", type: "uint256" }, { name: "winner", type: "address" }], outputs: [], stateMutability: "nonpayable" },
] as const;

Deno.serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const gameAddress = Deno.env.get("GAME_ADDRESS")! as `0x${string}`;
    const rpcUrl = Deno.env.get("CELO_RPC_URL") || "https://forno.celo.org";
    const account = privateKeyToAccount(Deno.env.get("OPERATOR_PRIVATE_KEY")! as `0x${string}`);

    const publicClient = createPublicClient({ chain: celo, transport: http(rpcUrl) });
    const walletClient = createWalletClient({ account, chain: celo, transport: http(rpcUrl) });

    // El día a cerrar es el anterior al día on-chain actual.
    const currentDay = await publicClient.readContract({ address: gameAddress, abi: gameAbi, functionName: "currentDay" });
    const day = currentDay - 1n;

    // Idempotencia: ¿ya lo procesamos (en BD o on-chain)?
    const { data: existing } = await supabase.from("winners").select("day").eq("day", Number(day)).maybeSingle();
    if (existing) {
      return json({ ok: true, skipped: "ya registrado", day: Number(day) });
    }
    const alreadyRolled = await publicClient.readContract({ address: gameAddress, abi: gameAbi, functionName: "rolled", args: [day] });
    if (alreadyRolled) {
      return json({ ok: true, skipped: "ya rolled on-chain", day: Number(day) });
    }

    // Ganador del día: menos países, a igualdad menor tiempo.
    const { data: top, error: scoreErr } = await supabase
      .from("scores")
      .select("player_id, countries, time_ms")
      .eq("day", Number(day))
      .order("countries", { ascending: true })
      .order("time_ms", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (scoreErr) throw scoreErr;
    if (!top || !top.player_id) {
      return json({ ok: true, skipped: "sin jugadores ese día", day: Number(day) });
    }

    const winner = String(top.player_id).toLowerCase() as `0x${string}`;
    if (!/^0x[0-9a-f]{40}$/.test(winner)) {
      // player_id no es una dirección (jugador sin wallet) → no se puede premiar on-chain.
      return json({ ok: false, error: "ganador sin dirección válida", day: Number(day), winner });
    }

    // Cierra el día on-chain.
    const rollTx = await walletClient.writeContract({
      address: gameAddress, abi: gameAbi, functionName: "rollDay", args: [day, winner],
    });
    await publicClient.waitForTransactionReceipt({ hash: rollTx });

    const potRaw = await publicClient.readContract({ address: gameAddress, abi: gameAbi, functionName: "pot", args: [day] });

    // Registra en la tabla de ganadores (índice para la UI).
    const { error: insErr } = await supabase.from("winners").insert({
      day: Number(day),
      winner_address: winner,
      pot_raw: potRaw.toString(),
      countries: top.countries,
      time_ms: top.time_ms,
      roll_tx: rollTx,
    });
    if (insErr) throw insErr;

    return json({
      ok: true,
      day: Number(day),
      winner,
      pot: formatUnits(potRaw, TOKEN_DECIMALS),
      roll_tx: rollTx,
    });
  } catch (err) {
    return json({ ok: false, error: String((err as Error)?.message ?? err) }, 500);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
