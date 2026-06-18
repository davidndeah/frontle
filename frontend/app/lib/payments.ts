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

// --- Configuración de red / contrato (Celo Mainnet) --------------------
const CHAIN_ID: number = 42220; // Celo Mainnet
const GAME_ADDRESS: Address = "0x7Ea1EEB96Caf0b07E47354c349b8FdFC75B2Fa09";
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

function getProvider(): unknown | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { ethereum?: unknown }).ethereum;
}

// --- Identidad: dirección de la wallet ---------------------------------
// La dirección es la IDENTIDAD del jugador en el ranking: es lo que el
// contrato necesita para pagar el premio (rollDay/claim). En MiniPay la wallet
// ya está conectada → getAddresses la entrega SIN abrir prompt.
export async function getWalletAddress(): Promise<string | null> {
  const provider = getProvider();
  if (!provider) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const walletClient = createWalletClient({ chain: ACTIVE_CHAIN, transport: custom(provider as any) });
    const [account] = await walletClient.getAddresses();
    return account ? account.toLowerCase() : null;
  } catch {
    return null;
  }
}

// Solicita conexión de wallet (ABRE prompt). Para navegador con extensión:
// "Conecta tu wallet para entrar al ranking".
export async function connectWallet(): Promise<string | null> {
  const provider = getProvider();
  if (!provider) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const walletClient = createWalletClient({ chain: ACTIVE_CHAIN, transport: custom(provider as any) });
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

// --- Lectura: saldo de COPm (peso colombiano) de la wallet conectada ----
// Localización para el mercado colombiano de MiniPay. Devuelve el saldo o null.
export async function getCopmBalance(): Promise<number | null> {
  const provider = getProvider();
  if (!provider) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const walletClient = createWalletClient({ chain: ACTIVE_CHAIN, transport: custom(provider as any) });
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
  const provider = getProvider();
  if (!provider) {
    console.warn("[pago] No hay wallet (window.ethereum). ¿Abierto fuera de MiniPay?");
    return false;
  }
  const action = resolveAction(reason);
  if (!action) {
    console.error("[pago] reason no reconocido:", reason);
    return false;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const transport = custom(provider as any);
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
    const feeOpts = FEE_CURRENCY ? { feeCurrency: FEE_CURRENCY } : {};

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
