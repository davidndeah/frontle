// ============================================================
//  Frontle v2 — Edge Function "close-week" (liga semanal)
//  Cierra la semana terminada: lee el podio de XP (top 3) de la vista
//  `weekly_xp`, llama rollWeek(week, 1º, 2º, 3º) on-chain (firma el OPERATOR)
//  y registra el podio en `weekly_winners`.
//
//  Pensada para correr 1 vez/semana por cron, el LUNES poco después de las
//  00:00 UTC. Es idempotente: si la semana ya está cerrada on-chain (rolled)
//  o registrada en `weekly_winners`, no hace nada.
//
//  ⚠️ DOS NÚMEROS DE SEMANA (mismo tropiezo que los dos "días" de v1):
//    · el contrato indexa la semana como (timestamp/1día + 3) / 7;
//    · `weekly_xp.week` es la FECHA del lunes UTC (YYYY-MM-DD).
//  El lunes de la semana `w` del contrato es el día 7w-3 desde el epoch
//  (el epoch cayó en jueves). Aquí se convierte una sola vez.
//
//  ⚠️ Jugadores sin wallet: el XP se puede ganar con identidad anónima, pero
//  on-chain solo se puede premiar a una dirección. Igual que `close-day`, los
//  player_id que no son 0x… se SALTAN y el puesto pasa al siguiente elegible;
//  la respuesta los reporta en `skipped` para poder atenderlos a mano.
//
//  Secrets requeridos (supabase secrets set ...):
//    SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY   (los inyecta Supabase)
//    OPERATOR_PRIVATE_KEY   0x… wallet operator (necesita CELO para gas)
//    WEEKLY_ADDRESS         0x… FrontleWeekly en Mainnet
//    CELO_RPC_URL           opcional, por defecto https://forno.celo.org
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createPublicClient, createWalletClient, http, formatUnits } from "https://esm.sh/viem@2.21.0";
import { privateKeyToAccount } from "https://esm.sh/viem@2.21.0/accounts";
import { celo } from "https://esm.sh/viem@2.21.0/chains";

const TOKEN_DECIMALS = 6; // USDT
const ZERO = "0x0000000000000000000000000000000000000000" as const;
const PODIUM = 3;

const weeklyAbi = [
  { type: "function", name: "currentWeek", inputs: [], outputs: [{ type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "pot", inputs: [{ name: "week", type: "uint256" }], outputs: [{ type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "rolled", inputs: [{ name: "week", type: "uint256" }], outputs: [{ type: "bool" }], stateMutability: "view" },
  {
    type: "function",
    name: "rollWeek",
    inputs: [
      { name: "week", type: "uint256" },
      { name: "first", type: "address" },
      { name: "second", type: "address" },
      { name: "third", type: "address" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;

/// Lunes UTC (YYYY-MM-DD) de la semana `w` del contrato. Día 7w-3 del epoch.
function weekStartOf(w: bigint): string {
  return new Date((Number(w) * 7 - 3) * 86_400_000).toISOString().slice(0, 10);
}

Deno.serve(async () => {
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Inerte hasta que el contrato esté desplegado: el cron puede estar activo
    // sin ensuciar los logs con errores.
    const weeklyAddress = (Deno.env.get("WEEKLY_ADDRESS") ?? "") as `0x${string}`;
    if (!/^0x[0-9a-fA-F]{40}$/.test(weeklyAddress)) {
      return json({ ok: true, skipped: "WEEKLY_ADDRESS sin configurar (contrato no desplegado)" });
    }
    const rpcUrl = Deno.env.get("CELO_RPC_URL") || "https://forno.celo.org";
    const account = privateKeyToAccount(Deno.env.get("OPERATOR_PRIVATE_KEY")! as `0x${string}`);

    const publicClient = createPublicClient({ chain: celo, transport: http(rpcUrl) });
    const walletClient = createWalletClient({ account, chain: celo, transport: http(rpcUrl) });

    // La semana a cerrar es la anterior a la semana on-chain actual.
    const currentWeek = await publicClient.readContract({
      address: weeklyAddress,
      abi: weeklyAbi,
      functionName: "currentWeek",
    });
    const week = currentWeek - 1n;
    const weekStart = weekStartOf(week);

    // Idempotencia: ¿ya lo procesamos (en BD o on-chain)?
    const { data: existing } = await supabase.from("weekly_winners").select("week").eq("week", Number(week)).limit(1);
    if (existing && existing.length > 0) {
      return json({ ok: true, skipped: "ya registrado", week: Number(week), weekStart });
    }
    const alreadyRolled = await publicClient.readContract({
      address: weeklyAddress,
      abi: weeklyAbi,
      functionName: "rolled",
      args: [week],
    });
    if (alreadyRolled) {
      return json({ ok: true, skipped: "ya rolled on-chain", week: Number(week), weekStart });
    }

    // Podio por XP. Se piden más de 3 porque hay que descartar a los jugadores
    // sin wallet (no premiables on-chain) y ascender a los siguientes.
    const { data: board, error: boardErr } = await supabase
      .from("weekly_xp")
      .select("player_id, xp, last_event")
      .eq("week", weekStart)
      .order("xp", { ascending: false })
      .order("last_event", { ascending: true })
      .limit(30);
    if (boardErr) throw boardErr;

    const payable: { address: `0x${string}`; xp: number }[] = [];
    const skipped: { player: string; xp: number }[] = [];
    for (const row of board ?? []) {
      if (payable.length >= PODIUM) break;
      const id = String(row.player_id ?? "").toLowerCase();
      if (/^0x[0-9a-f]{40}$/.test(id)) payable.push({ address: id as `0x${string}`, xp: Number(row.xp) });
      else skipped.push({ player: id, xp: Number(row.xp) });
    }

    if (payable.length === 0) {
      // Sin nadie premiable: no se puede rollWeek (revierte NoWinners). El
      // owner recupera el premio sembrado con recoverUnrolledPot.
      return json({ ok: true, skipped: "sin ganadores premiables", week: Number(week), weekStart, notPayable: skipped });
    }

    // Cierra la semana on-chain. address(0) = puesto vacante: su parte rueda
    // al pot de la semana siguiente (el contrato lo calcula, no el operador).
    const rollTx = await walletClient.writeContract({
      address: weeklyAddress,
      abi: weeklyAbi,
      functionName: "rollWeek",
      args: [week, payable[0]?.address ?? ZERO, payable[1]?.address ?? ZERO, payable[2]?.address ?? ZERO],
    });
    await publicClient.waitForTransactionReceipt({ hash: rollTx });

    const potRaw = await publicClient.readContract({
      address: weeklyAddress,
      abi: weeklyAbi,
      functionName: "pot",
      args: [week],
    });

    const rows = payable.map((p, i) => ({
      week: Number(week),
      place: i + 1,
      week_start: weekStart,
      winner_address: p.address,
      xp: p.xp,
      pot_raw: potRaw.toString(),
      roll_tx: rollTx,
    }));
    const { error: insErr } = await supabase.from("weekly_winners").insert(rows);
    if (insErr) throw insErr;

    return json({
      ok: true,
      week: Number(week),
      weekStart,
      pot: formatUnits(potRaw, TOKEN_DECIMALS),
      podium: rows.map((r) => ({ place: r.place, winner: r.winner_address, xp: r.xp })),
      notPayable: skipped,
      roll_tx: rollTx,
    });
  } catch (err) {
    return json({ ok: false, error: String((err as Error)?.message ?? err) }, 500);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
