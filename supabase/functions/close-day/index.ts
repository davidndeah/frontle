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
const MIN_TIME_MS = 2000; // = check scores_min_time (migración 0020)
const MAX_LEVELS_PER_PLAYER = 2;
// Teléfono verificado en MiniPay (FederatedAttestations, emisor de MiniPay):
// requisito para cobrar desde el 4-nov-2026. Las cuentas falsas no lo tienen;
// el 98% de los jugadores sí. Ver frontend/app/lib/phone.ts.
const FEDERATED_ATTESTATIONS = "0x0aD5b1d0C25ecF6266Dd951403723B2687d6aff2" as const;
const MINIPAY_ISSUER = "0x7888612486844Bb9BE598668081c59A9f7367FBc" as const;
const faAbi = [
  {
    type: "function",
    name: "lookupIdentifiers",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }, { name: "trustedIssuers", type: "address[]" }],
    outputs: [{ type: "uint256[]" }, { type: "bytes32[]" }],
  },
] as const;
// deno-lint-ignore no-explicit-any
async function hasMiniPayPhone(client: any, addr: `0x${string}`): Promise<boolean> {
  const [counts] = await client.readContract({
    address: FEDERATED_ATTESTATIONS,
    abi: faAbi,
    functionName: "lookupIdentifiers",
    args: [addr, [MINIPAY_ISSUER]],
  });
  return counts.length > 0 && counts[0] > 0n;
}

// Wallets de correo (wallet embebida de Privy): por ahora compiten sin
// teléfono. Se confirma con Privy (no con lo que diga el cliente) que la
// dirección es la wallet embebida de un usuario con correo verificado.
// Mismos secrets que welcome-bonus. Cualquier fallo → false.
async function isPrivyEmailWallet(addr: string): Promise<boolean> {
  const appId = Deno.env.get("PRIVY_APP_ID");
  const secret = Deno.env.get("PRIVY_APP_SECRET");
  if (!appId || !secret) return false;
  try {
    const r = await fetch("https://api.privy.io/v1/users/wallet/address", {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${appId}:${secret}`)}`,
        "privy-app-id": appId,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ address: addr }),
    });
    if (!r.ok) return false;
    const u = await r.json();
    // deno-lint-ignore no-explicit-any
    const accts: any[] = u?.linked_accounts ?? [];
    const hasEmail = accts.some((a) => a.type === "email");
    const embedded = accts.some(
      (a) =>
        a.type === "wallet" &&
        (a.wallet_client_type === "privy" || a.walletClientType === "privy") &&
        String(a.address ?? "").toLowerCase() === addr.toLowerCase(),
    );
    return hasEmail && embedded;
  } catch {
    return false;
  }
}

// Puede cobrar: teléfono verificado en MiniPay o wallet de correo (Privy).
// deno-lint-ignore no-explicit-any
async function canWinPrize(client: any, addr: `0x${string}`): Promise<boolean> {
  return (await hasMiniPayPhone(client, addr)) || (await isPrivyEmailWallet(addr));
}


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

    // Ganador de cada nivel: menos países, a igualdad menor tiempo. Reglas
    // (migración 0020, tras el 3-nov-2026):
    //  - nadie gana más de MAX_LEVELS_PER_PLAYER niveles el mismo día: si ya
    //    ganó 2, el tercero pasa al siguiente de la tabla. Se reparte de
    //    difícil a fácil, así el tope cae en el premio más pequeño;
    //  - marcas por debajo de MIN_TIME_MS no cuentan (la base ya las rechaza
    //    desde 0020; esto cubre las históricas);
    //  - las cuentas en revisión (account_reviews.block_prizes) no ganan,
    //    mientras la sanción siga vigente (`until`) y alcance al diario
    //    (`scope = 'all'`; las de 'weekly' solo pierden la liga, 0030);
    //  - sin teléfono verificado en MiniPay no se gana (pasa al siguiente),
    //    salvo las wallets de correo (Privy), que por ahora compiten igual.
    const winners: Record<Level, { address: `0x${string}`; countries: number; time_ms: number } | null> = {
      easy: null,
      medium: null,
      hard: null,
    };
    const { data: reviewed, error: revErr } = await supabase
      .from("account_reviews")
      .select("player_id")
      .eq("block_prizes", true)
      .eq("scope", "all")
      .or(`until.is.null,until.gt.${new Date().toISOString()}`);
    if (revErr) throw revErr;
    const blocked = new Set((reviewed ?? []).map((r) => String(r.player_id).toLowerCase()));
    const levelsWon = new Map<string, number>();
    const phoneCache = new Map<string, boolean>();
    const phoneOk = async (a: `0x${string}`) => {
      if (!phoneCache.has(a)) phoneCache.set(a, await canWinPrize(publicClient, a));
      return phoneCache.get(a)!;
    };
    const noPhone: string[] = [];

    for (const level of ["hard", "medium", "easy"] as const) {
      const { data: rows, error: scoreErr } = await supabase
        .from("scores")
        .select("player_id, countries, time_ms")
        .eq("day", seedDay)
        .eq("level", level)
        .gte("time_ms", MIN_TIME_MS)
        .order("countries", { ascending: true })
        .order("time_ms", { ascending: true })
        .order("created_at", { ascending: true })
        .limit(500);
      if (scoreErr) throw scoreErr;
      for (const top of rows ?? []) {
        const addr = String(top.player_id ?? "").toLowerCase();
        // player_id que no es dirección (jugador sin wallet) → no se puede premiar on-chain.
        if (!/^0x[0-9a-f]{40}$/.test(addr)) continue;
        if (blocked.has(addr)) continue;
        if ((levelsWon.get(addr) ?? 0) >= MAX_LEVELS_PER_PLAYER) continue;
        if (!(await phoneOk(addr as `0x${string}`))) {
          if (!noPhone.includes(addr)) noPhone.push(addr);
          continue;
        }
        winners[level] = { address: addr as `0x${string}`, countries: top.countries, time_ms: top.time_ms };
        levelsWon.set(addr, (levelsWon.get(addr) ?? 0) + 1);
        break;
      }
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
      skippedNoPhone: noPhone,
      roll_tx: rollTx,
    });
  } catch (err) {
    return json({ ok: false, error: String((err as Error)?.message ?? err) }, 500);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
