# Frontle — Capa Blockchain

Documentación completa de la capa onchain de **Frontle** en **Celo**: contrato, despliegues, integración con el frontend, cómo desplegar/verificar/probar, y las decisiones tomadas.

> Responsable IT: Santiago · Frontend/Producto: David · Hackathon Agentes Onchain — Celo Colombia (Demo Day 19-jun-2026).
> Plan paso a paso e historial de decisiones: [`PLAN_BLOCKCHAIN_FRONTLE.md`](PLAN_BLOCKCHAIN_FRONTLE.md).

---

## 1. Resumen

El jugador paga en stablecoin por **intentos extra** y **pistas**. Cada pago se reparte: un % al **protocolo** y el resto al **pot del día**. Al cerrar el día, el **operator** asigna el ganador (calculado off-chain por el leaderboard) y este **reclama el pot** (modelo *winner-takes-all*, inspirado en `FreakingPot.sol` del tutor).

- **Contrato:** `contracts/src/FrontleGame.sol` (Solidity 0.8.28, OpenZeppelin v5).
- **Frontend:** `frontend/app/lib/payments.ts` implementa `requestPayment` con viem.
- **Red de producción:** Celo **Mainnet** (token USDT). También probado en Celo Sepolia.

> ⚠️ **Nota de cumplimiento (importante):** *winner-takes-all* reparte dinero de unos jugadores al ganador → puede considerarse **apuesta**, y **MiniPay la restringe**. Es una decisión consciente del equipo (según la guía de producto `contracts/README.md`). Mitigación si el listing lo exige: sembrar el pot con un premio base de la plataforma (`fundPot`) y comunicarlo como "torneo", o volver al modelo de **recompensa fija** (existe en el historial de git). Ver `PLAN_BLOCKCHAIN_FRONTLE.md`.

---

## 2. Direcciones desplegadas

### Celo Mainnet (chain 42220) — producción / demo
| Qué | Dirección |
|---|---|
| **FrontleGame** | `0x7Ea1EEB96Caf0b07E47354c349b8FdFC75B2Fa09` ([Blockscout](https://celo.blockscout.com/address/0x7Ea1EEB96Caf0b07E47354c349b8FdFC75B2Fa09), verificado) |
| **token = USDT** (USD₮, 6 dec) | `0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e` |
| **feeCurrency adapter USDT** | `0x0e2a3e05bc9a16f5292a6170456a710cb89c6f72` |
| owner / operator / deployer | `0x54E83C8D7B7A77cbf0a2842c1a82d51be8814DD0` |

### Celo Sepolia (chain 11142220) — pruebas
| Qué | Dirección |
|---|---|
| FrontleGame | `0x08D5Ac4faB4946C3B966880BE2C8C107966a0AEc` ([Blockscout](https://celo-sepolia.blockscout.com/address/0x08d5ac4fab4946c3b966880be2c8c107966a0aec), verificado) |
| MockERC20 (tUSD de prueba, 18 dec) | `0x7Ea1EEB96Caf0b07E47354c349b8FdFC75B2Fa09` |

### Otros tokens en Celo Mainnet (referencia)
| Token | Dirección | Dec | feeCurrency |
|---|---|---|---|
| USDm (cUSD) | `0x765DE816845861e75A25fCA122bb6898B8B1282a` | 18 | misma dirección |
| USDC | `0xcebA9300f2b948710d2653dD7B07f33A8B32118C` | 6 | adapter `0x2F25deB3848C207fc8E0c34035B3Ba7fC157602B` |
| COPm (Mento) | `0x8A567e2aE79CA692Bd748aB832081C45de4041eA` | 18 | misma dirección |

---

## 3. El contrato `FrontleGame`

### Configuración
- `token` (**immutable**): stablecoin único del juego (USDT en mainnet).
- `operator`: wallet del backend; única que puede cerrar días (`rollDay`).
- `attemptFee`: precio del intento extra.
- `hintFee[tipo]`: precio de pista por tipo (`0`=inicial, `1`=siguiente silueta, `2`=todas). `0` = pista deshabilitada.
- `protocolBps`: % al protocolo en *basis points* (2000 = 20%); el resto va al pot.

### El "día"
`currentDay()` = `block.timestamp / 1 día` (índice de día **UTC**). Se deriva **on-chain** → el cliente no puede falsearlo y coincide con el reto diario del frontend.

### Funciones
| Función | Quién | Qué hace |
|---|---|---|
| `payAttempt()` | jugador | Cobra `attemptFee`; split protocolo/pot del día. Emite `AttemptPaid`. |
| `buyHint(uint8 hintType)` | jugador | Cobra `hintFee[hintType]` (revierte si no configurado); split. Emite `HintPaid`. |
| `fundPot(uint256 amount)` | cualquiera | Siembra el pot del día (100% al pot, sin split). Emite `PotFunded`. |
| `rollDay(uint256 day, address winner)` | **operator** | Cierra un día **ya terminado** y le asigna ganador. Emite `DayRolled`. |
| `claim(uint256 day)` | ganador | Retira el pot de ese día. Emite `Claimed`. |
| `withdrawProtocol(address to, uint256 amount)` | **owner** | Retira la comisión de protocolo acumulada (no toca los pots). |
| `setOperator` / `setFees` / `setHintFee` | **owner** | Administración. |

Lectura: `currentDay()`, `pot(day)`, `winnerOf(day)`, `rolled(day)`, `claimed(day)`, `protocolAccrued`, `hintFee(tipo)`.

### Seguridad
- `SafeERC20` para transferencias; `Ownable` (OZ v5: constructor `Ownable(msg.sender)`).
- **Custom errors** (más baratos que `require` con string).
- `rollDay` exige día terminado (`day < currentDay()`) y no recerrar (`rolled`).
- `claim` usa **checks-effects-interactions** (marca `claimed` antes de transferir) e idempotencia.
- Pagos: `payAttempt`/`buyHint` requieren `approve` previo del jugador sobre el token.

### Tests
`contracts/test/FrontleGame.t.sol` — **32 tests + fuzz** del split. **Cobertura 100%** (líneas, ramas, funciones).
```bash
cd contracts && forge test
forge coverage
```

---

## 4. Integración con el frontend

**Punto único:** `frontend/app/lib/payments.ts` exporta `requestPayment(amountUSDm, reason)`, que el juego (`page.tsx`) ya tiene cableado. Devuelve `true` solo si la tx se confirmó on-chain.

Hace: auto-connect (`getAddresses`/`requestAddresses`) → **switch de red** a Celo si hace falta → `approve` (una vez si falta allowance) → `payAttempt()` / `buyHint(tipo)` con **`feeCurrency`** (network fee en USDT, sin mostrar "gas") → espera el recibo.

Mapeo `reason` → función del contrato:
| `reason` (del frontend) | Función |
|---|---|
| `reintento del reto diario` | `payAttempt()` |
| `pista: initial` | `buyHint(0)` |
| `pista: next` | `buyHint(1)` |
| `pista: all` | `buyHint(2)` |

Config en `payments.ts` (cambiar aquí si se redespliega): `CHAIN_ID`, `GAME_ADDRESS`, `TOKEN_ADDRESS`, `TOKEN_DECIMALS`, `FEE_CURRENCY`.

> El ranking diario vive en `localStorage` (off-chain). El `operator` lo usará para `rollDay(day, winner)`.

### Lecturas en la UI (sin wallet de escritura)
- **Premio del día:** `getDailyPot()` lee `pot(currentDay())` del contrato y lo muestra como banner arriba del reto (`🏆 Premio de hoy: X USDT`). Se refresca al cargar, cada 30 s (pagos de otros) y tras cada pago propio.
- **Saldo en COPm (localización / bono):** `getCopmBalance()` lee `balanceOf` del token **COPm de Mento** (`0x8A567e2aE79CA692Bd748aB832081C45de4041eA`, 18 dec) de la wallet conectada y lo muestra como chip `🇨🇴 Saldo: X COP` en el header. Integra COPm sin tocar el contrato del juego.
  > El criterio final del bono lo definen los organizadores; si exigieran **transaccionar** COPm (no solo mostrarlo), la vía limpia es `feeCurrency = COPm` o un deploy con `token = COPm`.

---

## 5. Cómo desplegar (Foundry)

Requisitos: Foundry (`forge`, `cast`), OpenZeppelin instalado (`forge install OpenZeppelin/openzeppelin-contracts`).

1. **Clave de deploy (segura, no en texto plano):**
   ```bash
   cd contracts
   cast wallet import frontle-deployer --interactive   # pega la private key
   ```
2. **`.env`** (copiar de `.env.example`): `OPERATOR`, `TOKEN_ADDRESS` (vacío en testnet → despliega mock; USDT en mainnet), fees, `CELOSCAN_API_KEY`. **Nunca se commitea** (`.gitignore`).
3. **Desplegar:**
   ```bash
   set -a && . ./.env && set +a
   # Mainnet:
   forge script script/Deploy.s.sol --rpc-url celo --account frontle-deployer --broadcast
   # Sepolia (despliega un MockERC20 si TOKEN_ADDRESS está vacío):
   forge script script/Deploy.s.sol --rpc-url celo_sepolia --account frontle-deployer --broadcast
   ```
4. **Verificar** (Blockscout, sin API key — funciona en mainnet y sepolia):
   ```bash
   forge verify-contract <GAME> src/FrontleGame.sol:FrontleGame \
     --verifier blockscout --verifier-url https://celo.blockscout.com/api/ \
     --constructor-args $(cast abi-encode "constructor(address,address,uint256,uint256)" <TOKEN> <OPERATOR> <ATTEMPT_FEE> <PROTOCOL_BPS>)
   ```
   > El endpoint de **Celoscan para Sepolia es V1 deprecado** y falla con forge → usar Blockscout. En Mainnet también se usó Blockscout.

---

## 6. Cómo probar el flujo (cast)

Las tx de escritura usan `--account frontle-deployer` (pide contraseña). Las lecturas no.
```bash
GAME=<dirección>; TOKEN=<dirección>; RPC=https://forno.celo.org
# Autorizar y pagar
cast send $TOKEN "approve(address,uint256)" $GAME <monto> --account frontle-deployer --rpc-url $RPC
cast send $GAME "payAttempt()" --account frontle-deployer --rpc-url $RPC
cast send $GAME "buyHint(uint8)" 2 --account frontle-deployer --rpc-url $RPC
cast send $GAME "fundPot(uint256)" <monto> --account frontle-deployer --rpc-url $RPC
# Cerrar un día YA terminado y reclamar
cast send $GAME "rollDay(uint256,address)" <day> <winner> --account frontle-deployer --rpc-url $RPC
cast send $GAME "claim(uint256)" <day> --account frontle-deployer --rpc-url $RPC
# Lecturas
cast call $GAME "pot(uint256)(uint256)" <day> --rpc-url $RPC
cast call $GAME "currentDay()(uint256)" --rpc-url $RPC
```

### Probar en MiniPay (dispositivo físico)
1. App pública con HTTPS (Vercel desde `main`, o ngrok del dev server).
2. MiniPay → Settings → About → tocar **Version 7 veces** → **Developer Mode** → **"Load Test Page"** → pegar la URL.
3. Jugar y pagar (en Mainnet = USDT real, céntimos por acción). El `feeCurrency` evita que se vea "gas".

---

## 7. Estado y pendientes

- [x] Contrato `FrontleGame` + tests (100% cobertura)
- [x] Desplegado y verificado en **Sepolia** (probado end-to-end con cast)
- [x] Frontend conectado (`requestPayment` real, validado con Rabby)
- [x] Desplegado y verificado en **Mainnet** (USDT) → habilita el bono COPm
- [x] **Probado en MiniPay real** (pago USDT desde el dispositivo; pot subió 0.04 → 0.08)
- [x] **Premio del día** en vivo en la UI (banner)
- [x] **Saldo en COPm** mostrado en la UI (localización / bono) — confirmar criterio con organizadores
- [ ] Sembrar el pot con premio base (`fundPot`) — requiere USDT en la wallet de deploy
- [ ] Cerrar un día (`rollDay`) + `claim` en Mainnet para mostrar el winner-takes-all completo
- [ ] (Opcional) Backend/cron que llame `rollDay` a medianoche UTC con el ganador del leaderboard

---

## 8. Estructura de archivos

```
contracts/
├── src/FrontleGame.sol          # el contrato
├── test/FrontleGame.t.sol       # 32 tests + fuzz
├── test/mocks/MockERC20.sol     # stablecoin de prueba (testnet)
├── script/Deploy.s.sol          # despliegue configurable por red
├── foundry.toml                 # solc 0.8.28, remappings OZ, RPCs, etherscan
├── .env.example                 # plantilla (sin secretos)
└── README.md                    # guía de producto (David)

frontend/app/lib/payments.ts     # integración viem (requestPayment)
```
