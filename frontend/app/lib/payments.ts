// ============================================================
//  Frontle — Pagos on-chain (Celo / MiniPay)
//  Implementa `requestPayment` que el juego ya tiene cableado.
//  Mapea cada acción del frontend a una función del contrato FrontleGame:
//    "reintento del reto diario"  -> payAttempt()
//    "pista: initial|next|all"    -> buyHint(0|1|2)
//  Devuelve true SOLO si la transacción se confirmó on-chain.
// ============================================================

import {
  createWalletClient,
  createPublicClient,
  custom,
  http,
  defineChain,
  parseUnits,
  parseEther,
  formatUnits,
  maxUint256,
  type Address,
} from "viem";
import { celo } from "viem/chains";
import type { Difficulty } from "./game";

// Índice on-chain de cada nivel (FrontleGame v2: LEVEL_EASY=0/MEDIUM=1/HARD=2).
const LEVEL_INDEX: Record<Difficulty, number> = { easy: 0, medium: 1, hard: 2 };

// --- Configuración de red / contrato (Celo Mainnet) --------------------
const CHAIN_ID: number = 42220; // Celo Mainnet
// FrontleGame v2 (niveles) — Celo Mainnet, desplegado 2026-07-05.
// ABI por (día,nivel): winnerOf/prize/claimed/claim. (v1 ganador único: 0x7Ea1…Fa09).
const GAME_ADDRESS: Address = "0xaDcA9A707F394509C8aA906B89B93cb222f2BeBE";
// FrontleGame v1 (ganador único, sin niveles). Ya no recibe pagos, pero
// conserva el historial de premios; /stats lo suma. El ganador se llevaba
// pot(día) entero, por eso el v1 no tiene `prize`.
const GAME_V1_ADDRESS: Address = "0x7Ea1EEB96Caf0b07E47354c349b8FdFC75B2Fa09";
// Día UTC en que se desplegó el v1 (2026-06-17): inicio del historial.
const FIRST_DAY = 20621;
const TOKEN_ADDRESS: Address = "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e"; // USDT (USD₮)
const TOKEN_DECIMALS = 6; // USDT usa 6 decimales

// feeCurrency (CIP-64): adapter de USDT → el usuario paga el "network fee" en USDT
// y nunca ve "gas" ni CELO (requisito MiniPay). Para USDT/USDC se usa el ADAPTER, no el token.
const FEE_CURRENCY: Address | undefined = "0x0e2a3e05bc9a16f5292a6170456a710cb89c6f72";

// COPm (peso colombiano de Mento) — para mostrar el saldo local del usuario.
const COPM_ADDRESS: Address = "0x8A567e2aE79CA692Bd748aB832081C45de4041eA";
const COPM_DECIMALS = 18;

// Reutiliza los serializers/formatters de Celo (soportan feeCurrency) apuntando a Sepolia.
const celoSepolia = defineChain({
  ...celo,
  id: 11142220,
  name: "Celo Sepolia",
  rpcUrls: { default: { http: ["https://forno.celo-sepolia.celo-testnet.org"] } },
});

const ACTIVE_CHAIN = CHAIN_ID === 42220 ? celo : celoSepolia;

// --- ABIs mínimos -------------------------------------------------------
const gameAbi = [
  { type: "function", name: "payAttempt", inputs: [], outputs: [], stateMutability: "nonpayable" },
  {
    type: "function",
    name: "buyHint",
    inputs: [{ name: "hintType", type: "uint8" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  { type: "function", name: "currentDay", inputs: [], outputs: [{ type: "uint256" }], stateMutability: "view" },
  {
    type: "function",
    name: "pot",
    inputs: [{ name: "day", type: "uint256" }],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "winnerOf",
    inputs: [
      { name: "day", type: "uint256" },
      { name: "level", type: "uint8" },
    ],
    outputs: [{ type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "prize",
    inputs: [
      { name: "day", type: "uint256" },
      { name: "level", type: "uint8" },
    ],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "rolled",
    inputs: [{ name: "day", type: "uint256" }],
    outputs: [{ type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "claimed",
    inputs: [
      { name: "day", type: "uint256" },
      { name: "level", type: "uint8" },
    ],
    outputs: [{ type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "claim",
    inputs: [
      { name: "day", type: "uint256" },
      { name: "level", type: "uint8" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  // Comisión de plataforma acumulada (el 20%). No es dinero de los jugadores.
  { type: "function", name: "protocolAccrued", inputs: [], outputs: [{ type: "uint256" }], stateMutability: "view" },
] as const;

// ABI mínimo del v1, solo para las lecturas del histórico de /stats.
// Ojo: `pot(día)` ES el premio del ganador (no hay `prize` ni niveles).
const gameV1Abi = [
  { type: "function", name: "pot", inputs: [{ name: "day", type: "uint256" }], outputs: [{ type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "rolled", inputs: [{ name: "day", type: "uint256" }], outputs: [{ type: "bool" }], stateMutability: "view" },
  { type: "function", name: "protocolAccrued", inputs: [], outputs: [{ type: "uint256" }], stateMutability: "view" },
] as const;

const erc20Abi = [
  {
    type: "function",
    name: "approve",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "allowance",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "transfer",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
    stateMutability: "nonpayable",
  },
] as const;

// --- Mapeo reason → función del contrato --------------------------------
type Action = { fn: "payAttempt" } | { fn: "buyHint"; hintType: number };

function resolveAction(reason: string): Action | null {
  if (reason === "reintento del reto diario") return { fn: "payAttempt" };
  if (reason.startsWith("pista:")) {
    const kind = reason.slice("pista:".length).trim();
    const hintType = kind === "initial" ? 0 : kind === "next" ? 1 : kind === "all" ? 2 : -1;
    return hintType < 0 ? null : { fn: "buyHint", hintType };
  }
  return null;
}

// --- Provider de wallet embebida (Privy / login por correo) -------------
// Cuando el jugador entra por CORREO, Privy le crea una wallet embebida en
// Celo. `page.tsx` captura su provider EIP-1193 y lo registra aquí. Así
// `getProvider()` puede caer a esta wallet cuando NO hay window.ethereum
// (ni MiniPay ni extensión), sin tocar el resto de payments.ts.
let embeddedProvider: unknown | undefined;

// Envuelve el provider de Privy para que hable el método legacy que entiende:
// viem/algunas rutas piden `wallet_sendTransaction` (EIP-5792) pero la wallet
// embebida solo implementa `eth_sendTransaction`. El Proxy traduce el nombre;
// misma firma, mismo flujo. Idempotente ante provider nulo.
export function setEmbeddedProvider(raw: unknown | undefined): void {
  if (!raw) {
    embeddedProvider = undefined;
    return;
  }
  const target = raw as {
    request: (args: { method: string; params?: unknown }) => Promise<unknown>;
  };
  embeddedProvider = new Proxy(target, {
    get(t, prop, receiver) {
      if (prop === "request") {
        return (args: { method: string; params?: unknown }) => {
          if (args?.method === "wallet_sendTransaction") {
            return t.request({ method: "eth_sendTransaction", params: args.params });
          }
          return t.request(args);
        };
      }
      return Reflect.get(t, prop, receiver);
    },
  });
}

// Provider activo + si es la wallet embebida. La embebida tiene PRIORIDAD:
// si Privy la creó, el usuario se identificó por CORREO y su identidad de
// ranking es esa dirección — enrutar el pago a una extensión instalada
// (otra dirección) rompería identidad y premio. En MiniPay nunca hay
// embeddedProvider, así que ahí sigue mandando window.ethereum.
type ActiveProvider = { provider: unknown; embedded: boolean };

function getProvider(): ActiveProvider | undefined {
  if (embeddedProvider) return { provider: embeddedProvider, embedded: true };
  if (typeof window !== "undefined") {
    const injected = (window as unknown as { ethereum?: unknown }).ethereum;
    if (injected) return { provider: injected, embedded: false };
  }
  return undefined;
}

// La wallet embebida de Privy solo firma tx estándar (legacy/eip1559...):
// una tx CIP-64 (type 0x7b, la que genera viem al incluir feeCurrency) lanza
// "Unsupported transaction type". Para ella se omite feeCurrency y el gas se
// paga en CELO (el bono de bienvenida incluye un poco de CELO para esto).
function feeOptsFor(embedded: boolean): { feeCurrency?: Address } {
  return FEE_CURRENCY && !embedded ? { feeCurrency: FEE_CURRENCY } : {};
}

// --- Identidad: dirección de la wallet ---------------------------------
// La dirección es la IDENTIDAD del jugador en el ranking: es lo que el
// contrato necesita para pagar el premio (rollDay/claim). En MiniPay la wallet
// ya está conectada → getAddresses la entrega SIN abrir prompt.
export async function getWalletAddress(): Promise<string | null> {
  const active = getProvider();
  if (!active) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const walletClient = createWalletClient({ chain: ACTIVE_CHAIN, transport: custom(active.provider as any) });
    const [account] = await walletClient.getAddresses();
    return account ? account.toLowerCase() : null;
  } catch {
    return null;
  }
}

// Solicita conexión de wallet (ABRE prompt). Para navegador con extensión:
// "Conecta tu wallet para entrar al ranking".
export async function connectWallet(): Promise<string | null> {
  const active = getProvider();
  if (!active) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const walletClient = createWalletClient({ chain: ACTIVE_CHAIN, transport: custom(active.provider as any) });
    let [account] = await walletClient.getAddresses();
    if (!account) [account] = await walletClient.requestAddresses();
    return account ? account.toLowerCase() : null;
  } catch {
    return null;
  }
}

// --- Lectura: premio (pot) del día actual ------------------------------
// No requiere wallet: lee directo del RPC. Devuelve el monto en USDT (number) o null.
export async function getDailyPot(): Promise<number | null> {
  try {
    const publicClient = createPublicClient({ chain: ACTIVE_CHAIN, transport: http() });
    const day = await publicClient.readContract({ address: GAME_ADDRESS, abi: gameAbi, functionName: "currentDay" });
    const amount = await publicClient.readContract({
      address: GAME_ADDRESS,
      abi: gameAbi,
      functionName: "pot",
      args: [day],
    });
    return Number(formatUnits(amount, TOKEN_DECIMALS));
  } catch (err) {
    console.error("[pago] no se pudo leer el pot:", err);
    return null;
  }
}

// --- Lectura: datos públicos para /stats -------------------------------
// Todo sale del contrato vía RPC público: sin wallet, sin backend, sin claves.
// Es la página de transparencia que pide el listing de MiniPay.

// Datos fijos del despliegue, para enlazar al explorador.
//
// `verified` refleja el estado REAL en el explorador. Ambos verificados el
// 2026-07-09 (el v2 estaba sin verificar hasta ese día) en Blockscout y
// Celoscan, con solc 0.8.28 y optimizer 200. Es requisito de listado en
// MiniPay y de elegibilidad en Proof of Ship: si se despliega un v3, nace en
// `false` hasta que se verifique.
const explorerUrl = ACTIVE_CHAIN.blockExplorers.default.url;
export const CONTRACT_INFO = {
  address: GAME_ADDRESS,
  addressV1: GAME_V1_ADDRESS,
  token: "USDT",
  chainId: CHAIN_ID,
  chainName: ACTIVE_CHAIN.name,
  explorer: `${explorerUrl}/address/${GAME_ADDRESS}`,
  explorerV1: `${explorerUrl}/address/${GAME_V1_ADDRESS}`,
  verifiedV2: true,
  verifiedV1: true,
} as const;

export interface PublicStats {
  day: number; // índice del día UTC en curso
  potToday: number; // premio acumulado hoy (USDT)
  prizesPaid: number; // premios asignados en TODOS los días cerrados, v1 + v2
  daysClosed: number; // días cerrados desde FIRST_DAY, v1 + v2
  playerFunds: number; // USDT de los jugadores (pot de hoy + premios sin reclamar)
  protocolFees: number; // comisión de plataforma acumulada — NO es de los jugadores
}

// Lee el histórico completo de ambos contratos (v1 + v2) desde FIRST_DAY.
// Usa multicall para agrupar las lecturas en pocas llamadas al RPC.
//
// Cuidado con los saldos: balanceOf incluye la comisión de plataforma
// acumulada (`protocolAccrued`). Restarla es lo que hace que "fondos de los
// jugadores" signifique lo que dice.
export async function getPublicStats(): Promise<PublicStats | null> {
  try {
    const publicClient = createPublicClient({ chain: ACTIVE_CHAIN, transport: http() });

    // 1) Día actual, comisión acumulada y saldo de cada contrato.
    const [dayRaw, accruedV1, accruedV2, balV1, balV2] = await publicClient.multicall({
      allowFailure: false,
      contracts: [
        { address: GAME_ADDRESS, abi: gameAbi, functionName: "currentDay" },
        { address: GAME_V1_ADDRESS, abi: gameV1Abi, functionName: "protocolAccrued" },
        { address: GAME_ADDRESS, abi: gameAbi, functionName: "protocolAccrued" },
        { address: TOKEN_ADDRESS, abi: erc20Abi, functionName: "balanceOf", args: [GAME_V1_ADDRESS] },
        { address: TOKEN_ADDRESS, abi: erc20Abi, functionName: "balanceOf", args: [GAME_ADDRESS] },
      ],
    });
    const day = Number(dayRaw);

    // 2) ¿Qué días están cerrados? Se pregunta a los dos contratos por cada
    //    día pasado; un día puede estar cerrado en uno y no en el otro.
    //    Un multicall por contrato: `multicall` exige un solo ABI por lote.
    const past: bigint[] = [];
    for (let d = FIRST_DAY; d < day; d++) past.push(BigInt(d));

    const [rolledV1, rolledV2] = await Promise.all([
      publicClient.multicall({
        allowFailure: false,
        contracts: past.map((d) => ({ address: GAME_V1_ADDRESS, abi: gameV1Abi, functionName: "rolled", args: [d] }) as const),
      }),
      publicClient.multicall({
        allowFailure: false,
        contracts: past.map((d) => ({ address: GAME_ADDRESS, abi: gameAbi, functionName: "rolled", args: [d] }) as const),
      }),
    ]);
    const closedV1 = past.filter((_, i) => rolledV1[i]);
    const closedV2 = past.filter((_, i) => rolledV2[i]);

    // 3) Premios de cada día cerrado. En el v1 el ganador se lleva pot(día);
    //    en el v2 hay un premio por nivel.
    const [potToday, potsV1, prizesV2] = await Promise.all([
      publicClient.readContract({ address: GAME_ADDRESS, abi: gameAbi, functionName: "pot", args: [dayRaw] }),
      publicClient.multicall({
        allowFailure: false,
        contracts: closedV1.map((d) => ({ address: GAME_V1_ADDRESS, abi: gameV1Abi, functionName: "pot", args: [d] }) as const),
      }),
      publicClient.multicall({
        allowFailure: false,
        contracts: closedV2.flatMap((d) =>
          [0, 1, 2].map((lv) => ({ address: GAME_ADDRESS, abi: gameAbi, functionName: "prize", args: [d, lv] }) as const),
        ),
      }),
    ]);

    // Se suma en bigint y se formatea una sola vez: sumar floats arrastra error.
    const prizesPaid = [...potsV1, ...prizesV2].reduce((acc, p) => acc + p, BigInt(0));

    // Días cerrados distintos entre ambos contratos (no se cuenta dos veces).
    const daysClosed = new Set([...closedV1, ...closedV2].map(Number)).size;

    const protocolFees = accruedV1 + accruedV2;
    const playerFunds = balV1 + balV2 - protocolFees;
    const usdt = (v: bigint) => Number(formatUnits(v, TOKEN_DECIMALS));

    return {
      day,
      potToday: usdt(potToday),
      prizesPaid: usdt(prizesPaid),
      daysClosed,
      playerFunds: usdt(playerFunds),
      protocolFees: usdt(protocolFees),
    };
  } catch (err) {
    console.error("[stats] no se pudieron leer los datos del contrato:", err);
    return null;
  }
}

// --- Ganadores del ciclo anterior --------------------------------------
// Para el tab Ranking: quién ganó cada nivel del último día cerrado, cuánto,
// y si ya lo reclamó. Solo lectura: no necesita wallet.

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export interface DayWinner {
  level: Difficulty;
  winner: string; // "" si ese nivel no tuvo ganador
  amount: number; // USDT
  claimed: boolean;
}

export interface LastCycle {
  day: number;
  winners: DayWinner[];
}

// Busca hacia atrás el último día CERRADO. No se asume `currentDay - 1`: si el
// cron de cierre se retrasa, ese día aún no está `rolled` y la sección saldría
// vacía sin que nada esté roto.
export async function getLastCycleWinners(lookback = 7): Promise<LastCycle | null> {
  try {
    const publicClient = createPublicClient({ chain: ACTIVE_CHAIN, transport: http() });
    const game = { address: GAME_ADDRESS, abi: gameAbi } as const;

    const today = Number(await publicClient.readContract({ ...game, functionName: "currentDay" }));
    const candidates: bigint[] = [];
    for (let d = today - 1; d >= Math.max(FIRST_DAY, today - lookback); d--) candidates.push(BigInt(d));
    if (candidates.length === 0) return null;

    const rolled = await publicClient.multicall({
      allowFailure: false,
      contracts: candidates.map((d) => ({ ...game, functionName: "rolled", args: [d] }) as const),
    });
    const idx = rolled.findIndex(Boolean);
    if (idx === -1) return null;
    const day = candidates[idx];

    const levels: Difficulty[] = ["easy", "medium", "hard"];
    const reads = await publicClient.multicall({
      allowFailure: false,
      contracts: levels.flatMap((lv) => [
        { ...game, functionName: "winnerOf", args: [day, LEVEL_INDEX[lv]] } as const,
        { ...game, functionName: "prize", args: [day, LEVEL_INDEX[lv]] } as const,
        { ...game, functionName: "claimed", args: [day, LEVEL_INDEX[lv]] } as const,
      ]),
    });

    const winners: DayWinner[] = levels.map((level, i) => {
      const winner = reads[i * 3] as string;
      const amount = reads[i * 3 + 1] as bigint;
      const claimed = reads[i * 3 + 2] as boolean;
      return {
        level,
        winner: winner.toLowerCase() === ZERO_ADDRESS ? "" : winner.toLowerCase(),
        amount: Number(formatUnits(amount, TOKEN_DECIMALS)),
        claimed,
      };
    });

    return { day: Number(day), winners };
  } catch (err) {
    console.error("[premios] no se pudieron leer los ganadores del ciclo:", err);
    return null;
  }
}

// --- Premios: (día, nivel) reclamables y reclamo ------------------------
// El contrato es la fuente de verdad. Recibe los (día, nivel) candidatos (de la
// tabla `winners` de Supabase) y deja SOLO los que la wallet puede cobrar ahora:
// rolled && winnerOf(día,nivel) == yo && !claimed(día,nivel). Devuelve el monto
// del premio de ESE nivel (prize[día][nivel]), no el pot entero.
export interface ClaimableEntry {
  day: number;
  level: Difficulty;
}

export interface ClaimablePrize {
  day: number;
  level: Difficulty;
  amount: number; // en USDT
}

export async function getClaimablePrizes(entries: ClaimableEntry[], address: string): Promise<ClaimablePrize[]> {
  if (!address || entries.length === 0) return [];
  const me = address.toLowerCase();
  try {
    const publicClient = createPublicClient({ chain: ACTIVE_CHAIN, transport: http() });
    const out: ClaimablePrize[] = [];
    for (const { day, level } of entries) {
      const d = BigInt(day);
      const lv = LEVEL_INDEX[level];
      const [rolled, winner, claimed] = await Promise.all([
        publicClient.readContract({ address: GAME_ADDRESS, abi: gameAbi, functionName: "rolled", args: [d] }),
        publicClient.readContract({ address: GAME_ADDRESS, abi: gameAbi, functionName: "winnerOf", args: [d, lv] }),
        publicClient.readContract({ address: GAME_ADDRESS, abi: gameAbi, functionName: "claimed", args: [d, lv] }),
      ]);
      if (!rolled || claimed) continue;
      if (String(winner).toLowerCase() !== me) continue;
      const amount = await publicClient.readContract({ address: GAME_ADDRESS, abi: gameAbi, functionName: "prize", args: [d, lv] });
      out.push({ day, level, amount: Number(formatUnits(amount, TOKEN_DECIMALS)) });
    }
    return out;
  } catch (err) {
    console.error("[premio] no se pudieron leer los (día,nivel) reclamables:", err);
    return [];
  }
}

// El ganador reclama su parte de un (día, nivel). Devuelve true solo si se confirmó on-chain.
export async function claimPrize(day: number, level: Difficulty): Promise<boolean> {
  const active = getProvider();
  if (!active) return false;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const transport = custom(active.provider as any);
    const walletClient = createWalletClient({ chain: ACTIVE_CHAIN, transport });
    const publicClient = createPublicClient({ chain: ACTIVE_CHAIN, transport: http() });

    let [account] = await walletClient.getAddresses();
    if (!account) [account] = await walletClient.requestAddresses();
    if (!account) return false;

    const walletChainId = await walletClient.getChainId();
    if (walletChainId !== ACTIVE_CHAIN.id) {
      try {
        await walletClient.switchChain({ id: ACTIVE_CHAIN.id });
      } catch (switchErr) {
        const code = (switchErr as { code?: number }).code;
        if (code === 4902 || /Unrecognized chain|not been added/i.test(String((switchErr as Error)?.message))) {
          await walletClient.addChain({ chain: ACTIVE_CHAIN });
          await walletClient.switchChain({ id: ACTIVE_CHAIN.id });
        } else {
          throw switchErr;
        }
      }
    }

    const feeOpts = feeOptsFor(active.embedded);
    const hash = await walletClient.writeContract({
      account,
      chain: ACTIVE_CHAIN,
      address: GAME_ADDRESS,
      abi: gameAbi,
      functionName: "claim",
      args: [BigInt(day), LEVEL_INDEX[level]],
      ...feeOpts,
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    return receipt.status === "success";
  } catch (err) {
    console.error("[premio] reclamo falló o cancelado:", err);
    return false;
  }
}

// --- Lectura: saldos de la wallet activa (USDT + CELO) ------------------
// Para el Perfil: el usuario de CORREO no tiene otra vista de su wallet
// embebida (el de MiniPay ve su saldo en la app). Devuelve null sin wallet.
export async function getWalletBalances(): Promise<{ usdt: number; celo: number } | null> {
  const active = getProvider();
  if (!active) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const walletClient = createWalletClient({ chain: ACTIVE_CHAIN, transport: custom(active.provider as any) });
    const [account] = await walletClient.getAddresses();
    if (!account) return null;
    const publicClient = createPublicClient({ chain: ACTIVE_CHAIN, transport: http() });
    const [usdt, celo] = await Promise.all([
      publicClient.readContract({ address: TOKEN_ADDRESS, abi: erc20Abi, functionName: "balanceOf", args: [account] }),
      publicClient.getBalance({ address: account }),
    ]);
    return { usdt: Number(formatUnits(usdt, TOKEN_DECIMALS)), celo: Number(formatUnits(celo, 18)) };
  } catch (err) {
    console.error("[saldo] no se pudo leer:", err);
    return null;
  }
}

// --- Lectura: saldo de COPm (peso colombiano) de la wallet conectada ----
// Localización para el mercado colombiano de MiniPay. Devuelve el saldo o null.
export async function getCopmBalance(): Promise<number | null> {
  const active = getProvider();
  if (!active) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const walletClient = createWalletClient({ chain: ACTIVE_CHAIN, transport: custom(active.provider as any) });
    const [account] = await walletClient.getAddresses();
    if (!account) return null;
    const publicClient = createPublicClient({ chain: ACTIVE_CHAIN, transport: http() });
    const bal = await publicClient.readContract({
      address: COPM_ADDRESS,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [account],
    });
    return Number(formatUnits(bal, COPM_DECIMALS));
  } catch (err) {
    console.error("[copm] no se pudo leer el saldo:", err);
    return null;
  }
}

// --- Pago ---------------------------------------------------------------
// Resultado tipado para que la UI pueda dar el mensaje correcto:
//   success   → confirmado on-chain
//   cancelled → el usuario rechazó la firma en su wallet
//   no_funds  → USDT insuficiente para el precio de la compra
//   no_gas    → (embebida) sin CELO para la comisión de red
//   error     → cualquier otro fallo (red, contrato, etc.)
export type PayResult = "success" | "cancelled" | "no_funds" | "no_gas" | "error";

// ¿El error es un rechazo del usuario? (viem lo envuelve; recorrer los cause)
function isUserRejection(err: unknown): boolean {
  let e = err as { code?: number; name?: string; message?: string; cause?: unknown } | undefined;
  while (e) {
    if (e.code === 4001 || e.name === "UserRejectedRequestError" || /user rejected|user denied/i.test(String(e.message ?? ""))) {
      return true;
    }
    e = e.cause as typeof e;
  }
  return false;
}

export async function requestPayment(amountUSDm: number, reason: string): Promise<PayResult> {
  const active = getProvider();
  if (!active) {
    console.warn("[pago] No hay wallet (window.ethereum ni embebida). ¿Abierto fuera de MiniPay?");
    return "error";
  }
  const action = resolveAction(reason);
  if (!action) {
    console.error("[pago] reason no reconocido:", reason);
    return "error";
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const transport = custom(active.provider as any);
    const walletClient = createWalletClient({ chain: ACTIVE_CHAIN, transport });
    const publicClient = createPublicClient({ chain: ACTIVE_CHAIN, transport: http() });

    // Auto-connect: en MiniPay getAddresses ya devuelve la cuenta sin prompt.
    let [account] = await walletClient.getAddresses();
    if (!account) [account] = await walletClient.requestAddresses();
    if (!account) return "error";

    // Asegurar que la wallet está en la red correcta (Rabby en desktop puede estar
    // en Mainnet). En MiniPay normalmente ya coincide y esto se salta.
    const walletChainId = await walletClient.getChainId();
    if (walletChainId !== ACTIVE_CHAIN.id) {
      try {
        await walletClient.switchChain({ id: ACTIVE_CHAIN.id });
      } catch (switchErr) {
        const code = (switchErr as { code?: number }).code;
        // 4902 = la red no está agregada en la wallet → agregarla y reintentar
        if (code === 4902 || /Unrecognized chain|not been added/i.test(String((switchErr as Error)?.message))) {
          await walletClient.addChain({ chain: ACTIVE_CHAIN });
          await walletClient.switchChain({ id: ACTIVE_CHAIN.id });
        } else {
          throw switchErr;
        }
      }
    }

    const feeWei = parseUnits(String(amountUSDm), TOKEN_DECIMALS);
    const feeOpts = feeOptsFor(active.embedded);

    // Pre-chequeo de fondos: mejor un mensaje claro ANTES que una tx fallida.
    const usdtBal = await publicClient.readContract({
      address: TOKEN_ADDRESS,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [account],
    });
    if (usdtBal < feeWei) return "no_funds";
    if (active.embedded) {
      // La embebida paga gas en CELO: bajo ~0.02 ni el approve pasa la
      // validación del nodo (exige saldo >= gas × ~2× baseFee).
      const gasBal = await publicClient.getBalance({ address: account });
      if (gasBal < parseEther("0.02")) return "no_gas";
    }

    // approve una vez si la autorización no alcanza
    const allowance = await publicClient.readContract({
      address: TOKEN_ADDRESS,
      abi: erc20Abi,
      functionName: "allowance",
      args: [account, GAME_ADDRESS],
    });
    if (allowance < feeWei) {
      const approveHash = await walletClient.writeContract({
        account,
        chain: ACTIVE_CHAIN,
        address: TOKEN_ADDRESS,
        abi: erc20Abi,
        functionName: "approve",
        args: [GAME_ADDRESS, maxUint256],
        ...feeOpts,
      });
      await publicClient.waitForTransactionReceipt({ hash: approveHash });
    }

    // pago real
    const hash = await walletClient.writeContract({
      account,
      chain: ACTIVE_CHAIN,
      address: GAME_ADDRESS,
      abi: gameAbi,
      functionName: action.fn,
      args: action.fn === "buyHint" ? [action.hintType] : [],
      ...feeOpts,
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    return receipt.status === "success" ? "success" : "error";
  } catch (err) {
    console.error("[pago] falló o cancelado:", err);
    if (isUserRejection(err)) return "cancelled";
    // El pre-chequeo es best-effort: si el gas fluctuó y aun así no alcanzó,
    // clasificar el fallo residual como falta de fondos/gas.
    if (/insufficient funds|gas required exceeds allowance|exceeds the balance/i.test(String((err as Error)?.message ?? ""))) {
      return active.embedded ? "no_gas" : "no_funds";
    }
    return "error";
  }
}

// --- Compra de monedas 🪙 (v2, PLAN-FRONTLE-V2 §5) ----------------------
// Un `transfer` simple de USDT a la tesorería de la liga (sin approve). El
// edge function `credit-coins` verifica la tx y acredita el paquete.
// INTERINO hasta el contrato FrontleWeekly (Fase 4): la tesorería es la
// wallet del operador y esos fondos se siembran al pot semanal a mano.
export const COIN_TREASURY = "0x54E83C8D7B7A77cbf0a2842c1a82d51be8814DD0" as const;

export async function purchaseCoinPack(amountUsdt: number): Promise<{ res: PayResult; txHash?: string; account?: string }> {
  const active = getProvider();
  if (!active) return { res: "error" };
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const transport = custom(active.provider as any);
    const walletClient = createWalletClient({ chain: ACTIVE_CHAIN, transport });
    const publicClient = createPublicClient({ chain: ACTIVE_CHAIN, transport: http() });
    let [account] = await walletClient.getAddresses();
    if (!account) [account] = await walletClient.requestAddresses();
    if (!account) return { res: "error" };

    const wei = parseUnits(String(amountUsdt), TOKEN_DECIMALS);
    const bal = await publicClient.readContract({ address: TOKEN_ADDRESS, abi: erc20Abi, functionName: "balanceOf", args: [account] });
    if (bal < wei) return { res: "no_funds" };
    if (active.embedded) {
      const gasBal = await publicClient.getBalance({ address: account });
      if (gasBal < parseEther("0.02")) return { res: "no_gas" };
    }

    const hash = await walletClient.writeContract({
      account,
      chain: ACTIVE_CHAIN,
      address: TOKEN_ADDRESS,
      abi: erc20Abi,
      functionName: "transfer",
      args: [COIN_TREASURY, wei],
      ...feeOptsFor(active.embedded),
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    return receipt.status === "success"
      ? { res: "success", txHash: hash, account: account.toLowerCase() }
      : { res: "error" };
  } catch (err) {
    console.error("[monedas] compra falló o cancelada:", err);
    if (isUserRejection(err)) return { res: "cancelled" };
    if (/insufficient funds|exceeds the balance/i.test(String((err as Error)?.message ?? ""))) {
      return { res: active.embedded ? "no_gas" : "no_funds" };
    }
    return { res: "error" };
  }
}
