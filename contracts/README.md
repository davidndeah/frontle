# Contracts — Frontle (guía para la capa blockchain)

Capa 3 de la arquitectura: smart contracts en **Celo**. Esta carpeta es tu punto de partida para conectar los pagos del juego.

> 📄 Documento completo del proyecto: en **Notion** ("Frontle - Documentacion del Proyecto") y en el Obsidian del equipo. Esta guía es el resumen accionable para los contratos.

---

## 🎯 Objetivo

El **frontend ya está completo y desplegado** ([frontle.vercel.app](https://frontle.vercel.app)). Todas las acciones pagas (3 pistas + reintento) ya están cableadas a **un único punto** que hoy es un stub gratis. Tu trabajo:

1. Escribir y desplegar el contrato `FrontleGame` en Celo.
2. Implementar el pago real en ese punto (`requestPayment`).
3. (Opcional) ranking global on-chain + COPm.

---

## 🔌 El punto de integración (lo único que toca el frontend)

**Archivo:** `frontend/app/page.tsx`

```typescript
// Reemplazar por el pago real con viem. Devuelve true SOLO si se confirmó on-chain.
async function requestPayment(amountUSDm: number, reason: string): Promise<boolean> {
  return true; // stub actual (gratis)
}

const PRICES = { hintInitial: 0.05, hintNext: 0.05, hintAll: 0.1, retry: 0.1 };
```

Mapeo de `reason` → función del contrato:

| `reason` | Función |
|---|---|
| `reintento del reto diario` | `payAttempt()` |
| `pista: initial` / `pista: next` / `pista: all` | `buyHint(0 / 1 / 2)` |

Cuando `requestPayment` devuelva `true` tras un pago confirmado, **las 4 acciones pagas y el flujo del juego funcionan sin tocar más el frontend**.

---

## 📋 Contrato a construir — `FrontleGame`

Modelo inspirado en `FreakingPot.sol` del tutor (csacanam/freaking-grammar): **pot diario winner-takes-all**. Mantenlo **simple** (es inmutable una vez desplegado).

Funciones mínimas:

- `payAttempt()` — cobra la entry fee (USDm); 80% al pot del día, 20% al protocolo; emite `AttemptPaid(player, day)`.
- `buyHint(uint8 hintType)` — cobra la tarifa de la pista; emite `HintPaid(player, hintType, day)`.
- `rollDay(address winner)` — solo `operator`: cierra el día y asigna el pot al ganador.
- `claim(uint256 day)` — el ganador retira el pot.

Notas:
- Token: **USDm** `0x765DE816845861e75A25fCA122bb6898B8B1282a` (18 decimales). Requiere `approve` antes del primer pago (patrón ERC-20).
- Usa `SafeERC20`, `Ownable` y *custom errors* (OpenZeppelin).
- El dinero del pool **vive dentro del contrato** (no en una wallet personal).

---

## 🛠️ Setup (Foundry)

```bash
cd contracts
forge init --no-git .
forge install OpenZeppelin/openzeppelin-contracts
# escribir src/FrontleGame.sol y script/Deploy.s.sol
forge build
```

Despliegue (con una wallet nueva creada por el agente + CELO para el gas):

```bash
forge script script/Deploy.s.sol --rpc-url https://forno.celo.org --broadcast --private-key $PRIVATE_KEY
```

> Crea una wallet nueva solo para desplegar y envíale ~0.1 CELO desde Rabby. **Nunca** commitees la clave privada (`.env` ya está en `.gitignore`).

---

## 🌐 Redes y tokens

| Red | Chain ID |
|---|---|
| Celo Mainnet | `42220` |
| Celo Sepolia (testnet, antes Alfajores) | `11142220` |

RPC: `https://forno.celo.org` · Explorador: https://celoscan.io

| Token | Dirección | Decimales | `feeCurrency` |
|---|---|---|---|
| USDm (cUSD) | `0x765DE816845861e75A25fCA122bb6898B8B1282a` | 18 | misma dirección |
| USDC | `0xcebA9300f2b948710d2653dD7B07f33A8B32118C` | 6 | adapter `0x2F25deB3848C207fc8E0c34035B3Ba7fC157602B` |
| USDT | `0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e` | 6 | adapter `0x0e2a3e05bc9a16f5292a6170456a710cb89c6f72` |
| COPm (Mento) | `0x8A567e2aE79CA692Bd748aB832081C45de4041eA` | 18 | misma dirección |

---

## 💻 Implementar `requestPayment` con viem (MiniPay)

```typescript
import { createWalletClient, custom, encodeFunctionData } from "viem";
import { celo } from "viem/chains";

const GAME = "0x...";            // dirección del contrato desplegado
const USDM = "0x765DE816845861e75A25fCA122bb6898B8B1282a";

async function requestPayment(amountUSDm: number, reason: string): Promise<boolean> {
  if (!window.ethereum?.isMiniPay) return false; // o soportar Rabby fuera de MiniPay
  const client = createWalletClient({ chain: celo, transport: custom(window.ethereum) });
  const [address] = await client.getAddresses();

  const fn = reason.startsWith("pista:")
    ? { name: "buyHint", args: [reason.endsWith("initial") ? 0 : reason.endsWith("next") ? 1 : 2] }
    : { name: "payAttempt", args: [] };

  // (Antes del primer pago: approve de USDm al contrato GAME)
  const hash = await client.sendTransaction({
    account: address,
    to: GAME,
    data: encodeFunctionData({ abi: FRONTLE_ABI, functionName: fn.name, args: fn.args }),
    feeCurrency: USDM, // fee abstraction — transacción legacy (sin EIP-1559)
  });
  // esperar recibo y devolver true si status === "success"
  return true;
}
```

> Restricciones MiniPay: transacciones **legacy** (no EIP-1559), **sin** `personal_sign`, **auto-connect** (no botón "Connect Wallet"), nunca mostrar CELO.

---

## 🏆 Ranking global (opcional, para el premio diario)

- Indexar los eventos `AttemptPaid` / resolución del juego (o guardar en Supabase) para construir el leaderboard.
- El `operator` llama `rollDay(winner)` a medianoche UTC → el ganador reclama el pot (premio base que ponemos + lo recolectado).

---

## ✅ Checklist

- [ ] Wallet Rabby + CELO para gas
- [ ] `FrontleGame.sol` escrito (payAttempt, buyHint, rollDay, claim)
- [ ] Desplegado en Celo + verificado en Celoscan
- [ ] `requestPayment` implementado con viem en `frontend/app/page.tsx`
- [ ] Probado en MiniPay real (Developer Settings → Open URL + ngrok)
- [ ] (Bono) COPm + verificación en Mainnet
