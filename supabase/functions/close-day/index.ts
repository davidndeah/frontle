// ============================================================
//  Frontle — Edge Function "close-day" (v2, por NIVELES)
//  Cierra el ciclo diario: lee el ganador de CADA nivel (fácil/medio/difícil)
//  del ranking, llama rollDay(day, hard, med, easy) on-chain (firma el
//  OPERATOR) y registra hasta 3 filas en la tabla `winners`.
//
//  Pensada para ejecutarse 1 vez/día por cron (pg_cron / Scheduled Function),
//  poco después del cierre del día UTC. Es idempotente: si el día ya está
//  cerrado on-chain (rolled) o registrado en `winners`, no hace nada.
//
//  Secrets requeridos (supabase secrets set ...):
//    SUPABASE_URL                 (lo inyecta Supabase)
//    SUPABASE_SERVICE_ROLE_KEY    (lo inyecta Supabase)
//    OPERATOR_PRIVATE_KEY         0x... wallet operator (debe tener CELO para gas)
//    GAME_ADDRESS                 0x... FrontleGame v2 en Mainnet
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
const ZERO = "0x0000000000000000000000000000000000000000" as const;

// Niveles en orden fácil → medio → difícil (el índice on-chain lo usa el contrato,
// no lo pasamos aquí: rollDay recibe las 3 direcciones por posición hard/med/easy).
const LEVELS = ["easy", "medium", "hard"] as const;
type Level = (typeof LEVELS)[number];

const gameAbi = [
  { type: "function", name: "currentDay", inputs: [], outputs: [{ type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "pot", inputs: [{ name: "day", type: "uint256" }], outputs: [{ type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "rolled", inputs: [{ name: "day", type: "uint256" }], outputs: [{ type: "bool" }], stateMutability: "view" },
  {
    type: "function",
    name: "rollDay",
    inputs: [
      { name: "day", type: "uint256" },
      { name: "hardWinner", type: "address" },
      { name: "medWinner", type: "address" },
      { name: "easyWinner", type: "address" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
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

    // OJO: el contrato indexa el día como "días desde epoch UTC" (ej. 20622),
    // pero la tabla `scores` lo guarda como YYYYMMDD (ej. 20260618, dateSeed del
    // front). Convertimos el índice del contrato a YYYYMMDD para cruzar ganadores.
    const dUtc = new Date(Number(day) * 86_400_000);
    const seedDay =
      dUtc.getUTCFullYear() * 10000 + (dUtc.getUTCMonth() + 1) * 100 + dUtc.getUTCDate();

    // Idempotencia: ¿ya lo procesamos (en BD o on-chain)?
    const { data: existing } = await supabase.from("winners").select("day").eq("day", Number(day)).limit(1);
    if (existing && existing.length > 0) {
      return json({ ok: true, skipped: "ya registrado", day: Number(day) });
    }
    const alreadyRolled = await publicClient.readContract({ address: gameAddress, abi: gameAbi, functionName: "rolled", args: [day] });
    if (alreadyRolled) {
      return json({ ok: true, skipped: "ya rolled on-chain", day: Number(day) });
    }

    // Ganador de cada nivel: menos países, a igualdad menor tiempo.
    const winners: Record<Level, { address: `0x${string}`; countries: number; time_ms: number } | null> = {
      easy: null,
      medium: null,
      hard: null,
    };
    for (const level of LEVELS) {
      const { data: top, error: scoreErr } = await supabase
        .from("scores")
        .select("player_id, countries, time_ms")
        .eq("day", seedDay)
        .eq("level", level)
        .order("countries", { ascending: true })
        .order("time_ms", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (scoreErr) throw scoreErr;
      if (!top || !top.player_id) continue;
      const addr = String(top.player_id).toLowerCase();
      // player_id que no es dirección (jugador sin wallet) → no se puede premiar on-chain.
      if (!/^0x[0-9a-f]{40}$/.test(addr)) continue;
      winners[level] = { address: addr as `0x${string}`, countries: top.countries, time_ms: top.time_ms };
    }

    if (!winners.hard && !winners.medium && !winners.easy) {
      // Sin ningún ganador con dirección: no se puede rollDay (revierte NoWinners).
      // El owner recupera el pot con recoverUnrolledPot si se sembró premio base.
      return json({ ok: true, skipped: "sin ganadores premiables ese día", day: Number(day), seedDay });
    }

    // Cierra el día on-chain: rollDay(day, hard, med, easy). address(0) = nivel sin ganador.
    // El contrato calcula los montos por nivel desde pot[day] con _computeShares.
    const rollTx = await walletClient.writeContract({
      address: gameAddress,
      abi: gameAbi,
      functionName: "rollDay",
      args: [
        day,
        winners.hard?.address ?? ZERO,
        winners.medium?.address ?? ZERO,
        winners.easy?.address ?? ZERO,
      ],
    });
    await publicClient.waitForTransactionReceipt({ hash: rollTx });

    const potRaw = await publicClient.readContract({ address: gameAddress, abi: gameAbi, functionName: "pot", args: [day] });

    // Registra una fila por nivel con ganador (índice para la UI).
    const rows = LEVELS.filter((lv) => winners[lv]).map((lv) => ({
      day: Number(day),
      level: lv,
      winner_address: winners[lv]!.address,
      pot_raw: potRaw.toString(),
      countries: winners[lv]!.countries,
      time_ms: winners[lv]!.time_ms,
      roll_tx: rollTx,
    }));
    const { error: insErr } = await supabase.from("winners").insert(rows);
    if (insErr) throw insErr;

    return json({
      ok: true,
      day: Number(day),
      pot: formatUnits(potRaw, TOKEN_DECIMALS),
      winners: rows.map((r) => ({ level: r.level, winner: r.winner_address })),
      roll_tx: rollTx,
    });
  } catch (err) {
    return json({ ok: false, error: String((err as Error)?.message ?? err) }, 500);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
