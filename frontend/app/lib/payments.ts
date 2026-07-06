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
export async function requestPayment(amountUSDm: number, reason: string): Promise<boolean> {
  const active = getProvider();
  if (!active) {
    console.warn("[pago] No hay wallet (window.ethereum ni embebida). ¿Abierto fuera de MiniPay?");
    return false;
  }
  const action = resolveAction(reason);
  if (!action) {
    console.error("[pago] reason no reconocido:", reason);
    return false;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const transport = custom(active.provider as any);
    const walletClient = createWalletClient({ chain: ACTIVE_CHAIN, transport });
    const publicClient = createPublicClient({ chain: ACTIVE_CHAIN, transport: http() });

    // Auto-connect: en MiniPay getAddresses ya devuelve la cuenta sin prompt.
    let [account] = await walletClient.getAddresses();
    if (!account) [account] = await walletClient.requestAddresses();
    if (!account) return false;

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
    return receipt.status === "success";
  } catch (err) {
    console.error("[pago] falló o cancelado:", err);
    return false;
  }
}
