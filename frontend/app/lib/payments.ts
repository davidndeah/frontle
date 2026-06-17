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
  maxUint256,
  type Address,
} from "viem";
import { celo } from "viem/chains";

// --- Configuración de red / contrato -----------------------------------
// Para pasar a Mainnet: CHAIN_ID = 42220, TOKEN_ADDRESS = USDm
// (0x765DE816845861e75A25fCA122bb6898B8B1282a) y FEE_CURRENCY = USDm.
const CHAIN_ID: number = 11142220; // Celo Sepolia
const GAME_ADDRESS: Address = "0x08D5Ac4faB4946C3B966880BE2C8C107966a0AEc";
const TOKEN_ADDRESS: Address = "0x7Ea1EEB96Caf0b07E47354c349b8FdFC75B2Fa09"; // MockERC20 (tUSD) en Sepolia
const TOKEN_DECIMALS = 18;

// feeCurrency (CIP-64): en Mainnet poner USDm para que el usuario nunca vea "gas".
// En testnet se deja undefined → el gas se paga en CELO. El MockERC20 NO sirve como feeCurrency.
const FEE_CURRENCY: Address | undefined = undefined;

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
