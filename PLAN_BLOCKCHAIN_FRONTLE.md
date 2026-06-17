# Frontle — Plan de la Capa Blockchain (rol IT)

> Plan paso a paso para implementar la capa onchain de **Frontle** en Celo, de aquí al **Demo Day (viernes 19 de junio, 6 pm)**.
> Responsable: **Santiago (IT)**. Frontend y producto: **David**.
> Modelo de economía: **pot diario winner-takes-all** (modelo del tutor), según la guía de producto `contracts/README.md`.
>
> ⚠️ **Decisión y riesgo (18-jun):** el equipo eligió el **pot winner-takes-all** que pide la guía de David. Reparte el dinero de los jugadores hacia el ganador del día → **puede considerarse apuesta, que MiniPay restringe** (ver PDF §7 y el principio rector de abajo). Se asume el riesgo conscientemente. *Mitigación posible si el listing lo exige:* sembrar el pot con un premio base de la plataforma (`fundPot`) y comunicarlo como "torneo con premio", o volver al modelo de recompensa fija (está en el historial de git).

---

## 0. Principio rector (leer antes de empezar)

- **La capa blockchain es lo obligatorio y lo más riesgoso.** Va primero. La IA (pistas inteligentes) es la capa final, opcional, solo si sobra tiempo.
- **Mantener el contrato simple = más seguro.** Contrato pequeño = menos superficie de bugs. Recuerda: los contratos son **inmutables**; dejarlo bien antes de desplegar.
- **⚠️ El premio (pot) SÍ se nutre de lo que pagan los jugadores** → es winner-takes-all (decisión del equipo, ver encabezado). MiniPay restringe la apuesta; tenerlo presente para el listing. Mitigación: premio base con `fundPot` + comunicarlo como "torneo".
- **La clave privada y las 12 palabras NUNCA** van a GitHub, a un chat, ni a ningún sitio. Solo en `.env` (que ya está en `.gitignore`) y respaldadas en papel/gestor.

---

## 1. Modelo de economía (qué hace el contrato `FrontleGame`)

### Flujo del dinero
| Acción | Quién paga | A dónde va el dinero |
| --- | --- | --- |
| Primer intento del día | Gratis | — |
| Intento extra (`payAttempt`) | El jugador | `protocolBps`% (def. 20%) al protocolo, el resto al **pot del día** |
| Comprar pista (`buyHint`) | El jugador | Igual split: protocolo / pot del día |
| Sembrar premio base (`fundPot`) | La plataforma | 100% al pot del día |
| Cerrar el día (`rollDay`) | El operator (backend) | Asigna el pot del día al **ganador** (calculado off-chain) |
| Reclamar (`claim`) | El ganador | Retira el pot completo de ese día |

### El "día" y la competencia
- El **día** se deriva on-chain de `block.timestamp / 1 días` (UTC) → el cliente no lo puede falsear y coincide con el reto diario del frontend.
- El **número de países usados** determina la **posición en el leaderboard** (off-chain, Supabase). El operator lee ese ranking y pasa el ganador a `rollDay`.
- ⚠️ **NO se usa cronómetro** (PDF §3): el puntaje mide cantidad de países, no velocidad.

> **Riesgo asumido:** winner-takes-all reparte dinero entre jugadores = posible apuesta (restringida en MiniPay). Ver nota del encabezado. El contrato deriva el día on-chain y usa CEI en `claim` para minimizar superficie de bugs.

---

## 2. Qué va on-chain vs off-chain

| Dato | Dónde | Por qué |
| --- | --- | --- |
| Grafo de fronteras / reto del día | Frontend (estático) | No cambia; determinístico por fecha |
| Puntaje temporal de la partida | Frontend (local) | Efímero |
| **Pagos de intento extra / pista** | **Blockchain** | Es dinero → verificable |
| **Recompensa por completar** | **Blockchain** | Es dinero → verificable |
| Leaderboard (tiempo/intentos) | Base de datos (Supabase) | Barato, editable; NO es dinero |

---

## 3. Estado de partida (✅ ya logrado)

- [x] Wallet **Rabby** creada (dirección `0x54E83C8...8814DD0`).
- [x] **6.3 CELO** de prueba en **Celo Sepolia** (confirmado en `celo-sepolia.blockscout.com`).
- [x] Repo público en GitHub + `.gitignore` protegiendo secretos.
- [x] Frontend del juego funcional desplegado en Vercel.

> Falta solo que Rabby **muestre** el saldo (activar testnets / botón "Add Celo Sepolia" del explorador). Pero para desplegar NO es bloqueante: Foundry usa el saldo directo de la blockchain.

---

## 4. Paso a paso de implementación

### Paso A — Configurar entorno de contratos (Foundry) ✅ HECHO (17-jun)
1. ✅ Foundry ya estaba instalado (`forge 1.7.1`).
2. ✅ Proyecto inicializado en `contracts/` (`forge init --force --no-git .`), ejemplos `Counter.*` eliminados.
3. ✅ OpenZeppelin **v5.6.1** instalado (`forge install OpenZeppelin/openzeppelin-contracts`).
4. ✅ `foundry.toml` configurado: `solc 0.8.28`, optimizer, remappings de OZ, endpoints RPC (`celo_sepolia`, `celo`) y bloque `[etherscan]` para verificar en Celoscan.
5. ✅ `.env.example` creado (plantilla sin secretos). `lib/` vendorizada e ignorada por git (sin submódulos colgando).

> ⚠️ **OZ v5 rompe `Ownable`:** el constructor exige el dueño inicial → `Ownable(msg.sender)`. Código de OZ v4 no compila.

### Paso B — Configurar la red Celo Sepolia
1. Crear `.env` en `contracts/` (NUNCA commitearlo):
   ```
   PRIVATE_KEY=0x...        # clave privada de la wallet Rabby de despliegue
   CELO_SEPOLIA_RPC=https://forno.celo-sepolia.celo-testnet.org
   ```
2. Verificar el RPC oficial en `docs.celo.org` (sección Celo Sepolia). Chain ID = **11142220**.

### Paso C — Escribir el contrato (`FrontleGame.sol`) ✅ HECHO (18-jun)
`contracts/src/FrontleGame.sol` (compila OK, solc 0.8.28). Modelo **pot diario winner-takes-all** (guía de David). Firmas alineadas con lo que espera el frontend (`payAttempt()` / `buyHint(type)`):
- `payAttempt()` — cobra `attemptFee`; split `protocolBps`% al protocolo, resto al **pot del día**. Emite `AttemptPaid(player, day, amount)`.
- `buyHint(uint8 hintType)` — cobra `hintFee[hintType]` (0=inicial 0.05, 1=siguiente 0.05, 2=todas 0.10). Mismo split. Revierte si el tipo no tiene precio. Emite `HintPaid`.
- `fundPot(uint256 amount)` — siembra el premio base; 100% al pot del día. Emite `PotFunded`.
- `rollDay(uint256 day, address winner)` — **`onlyOperator`**; cierra un día **ya terminado** y le asigna ganador. Revierte si el día sigue en curso / ya cerrado / winner cero. Emite `DayRolled`.
- `claim(uint256 day)` — el `winnerOf[day]` retira el pot. Idempotente (`claimed`), patrón CEI. Emite `Claimed`.
- `withdrawProtocol(to, amount)` — **`onlyOwner`**, retira solo la comisión de protocolo acumulada (no toca los pots). Emite `ProtocolWithdrawn`.
- Admin `onlyOwner`: `setOperator`, `setFees(attemptFee, protocolBps)`, `setHintFee(hintType, fee)`. Lectura: `currentDay()`, `pot(day)`, `winnerOf(day)`, `rolled(day)`, `claimed(day)`, `protocolAccrued`.
- Usa `SafeERC20`, `Ownable`, custom errors.

**Decisiones tomadas (18-jun):**
- 🔑 **Pot winner-takes-all** (modelo del tutor / guía de David). Riesgo de apuesta asumido (ver encabezado).
- 🔑 **El "día" se deriva on-chain** (`block.timestamp / 1 días`), no se pasa como argumento → coincide con lo que el frontend de David espera (`payAttempt()`/`buyHint(type)`) y el cliente no puede falsearlo.
- 🔑 **Split 80/20** por defecto (`protocolBps = 2000`), configurable. El pot vive en el contrato.
- 🔑 **Un solo stablecoin** `immutable` (mock en Sepolia, USDm en Mainnet).
- 🔑 Mapeo del frontend → contrato: `reintento` → `payAttempt()`; `pista: initial/next/all` → `buyHint(0/1/2)`.

✅ **Paso C cerrado (18-jun):** `test/FrontleGame.t.sol` (32 tests + fuzz del split) y `test/mocks/MockERC20.sol`. **Cobertura 100%** (líneas, ramas y funciones). `script/Deploy.s.sol` listo. `forge test` verde.

### Paso D — Desplegar y verificar ✅ HECHO en Sepolia (18-jun)
**Desplegado y probado end-to-end en Celo Sepolia:**
- **FrontleGame:** `0x08D5Ac4faB4946C3B966880BE2C8C107966a0AEc` ([verificado en Blockscout](https://celo-sepolia.blockscout.com/address/0x08d5ac4fab4946c3b966880be2c8c107966a0aec))
- **MockERC20 (tUSD):** `0x7Ea1EEB96Caf0b07E47354c349b8FdFC75B2Fa09`
- Probado con `cast`: `payAttempt`/`buyHint` (split 80/20 OK), `fundPot`, `rollDay`, `claim`.

> ⚠️ **Verificación en Sepolia = Blockscout, NO Celoscan.** El endpoint de Celoscan para Sepolia es V1 deprecado y no responde. Se usó `--verifier blockscout --verifier-url https://celo-sepolia.blockscout.com/api/` (sin API key). Para **Mainnet** sí sirve Celoscan/Etherscan V2 con la `CELOSCAN_API_KEY`.

El script `script/Deploy.s.sol` despliega todo: si `TOKEN_ADDRESS` está vacío (Sepolia) despliega un `MockERC20` y mintea 1000 tUSD al deployer; si está seteada (Mainnet USDm) la usa.

1. **Importar la clave de forma segura** (NO texto plano). Una sola vez:
   ```bash
   cast wallet import frontle-deployer --interactive   # pega la private key de Rabby
   ```
2. **Configurar `.env`** (copiar de `.env.example`): al menos `OPERATOR` (para Sepolia puede ser tu propia dirección de deployer). Cargar con `source .env` o `--env-file`.
3. **Desplegar a Celo Sepolia** (gratis, ya tienes 6.3 CELO):
   ```bash
   forge script script/Deploy.s.sol \
     --rpc-url celo_sepolia \
     --account frontle-deployer \
     --broadcast
   ```
   Apunta las direcciones que imprime: `MockERC20`, `FrontleGame`.
4. **Verificar en Celoscan** (mejor que Blockscout para verificación):
   ```bash
   forge verify-contract <GAME_ADDR> src/FrontleGame.sol:FrontleGame \
     --chain 11142220 --verifier etherscan \
     --etherscan-api-key $CELOSCAN_API_KEY \
     --constructor-args $(cast abi-encode "constructor(address,address,uint256,uint256)" <TOKEN_ADDR> <OPERATOR> 100000000000000000 2000)
   ```
5. **Probar el flujo con `cast`** (mintear, aprobar, payAttempt, buyHint, fundPot, rollDay, claim) — ver checklist al final.
6. **Solo cuando funcione perfecto**, desplegar a **Celo Mainnet** (Chain ID 42220) pasando `TOKEN_ADDRESS`=USDm, para la entrega + bono COPm. Requiere CELO real (~1-2 USD).

### Paso E — Conectar el frontend (con David) ✅ código HECHO (18-jun)
- Nuevo módulo **`frontend/app/lib/payments.ts`** implementa `requestPayment(amount, reason)` con viem: auto-connect (`getAddresses`/`requestAddresses`), `approve` una vez si falta allowance, `payAttempt()`/`buyHint(0|1|2)`, espera recibo y devuelve `true` solo si `status === "success"`. Mapea `reintento`→`payAttempt`, `pista: initial/next/all`→`buyHint(0/1/2)`.
- `page.tsx` ahora importa ese `requestPayment` (stub eliminado). **`npm run build` limpio** (compila + typecheck). Lint: solo avisos preexistentes de `page.tsx`, `payments.ts` sin issues.
- Config en `payments.ts`: apunta a **Sepolia** (`GAME 0x08D5…0AEc`, token MockERC20). Para **Mainnet**: cambiar `CHAIN_ID=42220`, `TOKEN_ADDRESS=USDm`, `FEE_CURRENCY=USDm` (para no mostrar "gas").
- **Pendiente:** probar el pago real (desktop con Rabby en Sepolia, o Paso F en MiniPay).

#### Referencia (patrón original)
> 🔌 **Gancho ya listo (commit `763ab20`):** en `frontend/app/page.tsx` existe `requestPayment(amountUSDm, reason)` (hoy un stub que hace `console.log` y devuelve `true`). Hay que **reemplazar ese stub** por: conectar MiniPay → `approve` USDm al contrato (una vez) → `payAttempt()` o `buyHint(type)` → esperar recibo → devolver `true` solo si `status === "success"`. Mapeo (ya en `contracts/README.md`): `reason="reintento del reto diario"` → `payAttempt()`; `reason="pista: initial/next/all"` → `buyHint(0/1/2)`. El "día" lo pone el contrato solo (no se pasa). El ranking diario vive en `localStorage` (off-chain, no tocar) — el `operator` lo usará para `rollDay(day, winner)`.

- Auto-connect (sin botón "Connect Wallet" dentro de MiniPay):
  ```js
  const isMiniPay = window.ethereum?.isMiniPay === true;
  const client = createWalletClient({ chain: celo, transport: custom(window.ethereum) });
  const [address] = await client.getAddresses();
  ```
- Pago con **fee abstraction** (el usuario nunca ve "gas"):
  ```js
  await walletClient.sendTransaction({
    account: address,
    to: GAME_CONTRACT_ADDRESS,
    data: encodeFunctionData({ abi, functionName: "payAttempt" }),
    feeCurrency: "0x765DE816845861e75A25fCA122bb6898B8B1282a", // USDm (18 dec)
  });
  ```

### Paso F — Probar en MiniPay real (dispositivo físico)
- Emuladores NO sirven.
  ```bash
  npm run dev
  npx ngrok http 3000
  ```
- En MiniPay: Settings → About → tocar Version 7 veces → Developer Mode + Use Testnet → pegar URL de ngrok en "Load Test Page".
- Hacer un pago real y confirmarlo en Celoscan/Blockscout.

### Paso G — Integrar COPm (bono de 100k)
- Mostrar saldos en COPm (peso colombiano de Mento).
- Verificar el contrato en Mainnet.
- COPm Mainnet: `0x8A567e2aE79CA692Bd748aB832081C45de4041eA` (18 decimales).

---

## 5. Direcciones útiles (Celo Mainnet)

| Token | Dirección | Decimales |
| --- | --- | --- |
| USDm (cUSD) | `0x765DE816845861e75A25fCA122bb6898B8B1282a` | 18 |
| USDC | `0xcebA9300f2b948710d2653dD7B07f33A8B32118C` | 6 |
| USDT | `0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e` | 6 |
| COPm (Mento) | `0x8A567e2aE79CA692Bd748aB832081C45de4041eA` | 18 |

**Fee abstraction (adapters):**
- USDC adapter: `0x2F25deB3848C207fc8E0c34035B3Ba7fC157602B`
- USDT adapter: `0x0e2a3e05bc9a16f5292a6170456a710cb89c6f72`
- USDm: la dirección del token sirve como adapter.

**Redes:**
- Celo Sepolia (testnet): Chain ID `11142220` — pruebas. RPC `https://forno.celo-sepolia.celo-testnet.org` (verificado). *(Antes se llamaba Alfajores.)*
- Celo Mainnet: Chain ID `42220` — entrega + bono. RPC `https://forno.celo.org`.

> **Sepolia primero (decidido 17-jun):** el PDF trae el consejo del tutor de ir *directo a Mainnet* (gas de centavos). Lo evaluamos y elegimos **Sepolia primero** porque ya hay 6.3 CELO de prueba y permite validar el contrato inmutable gratis; Mainnet al final para la entrega + bono COPm.

---

## 6. Prioridades si el tiempo aprieta

1. **Obligatorio (sin esto no se entrega):** Pasos A–D — contrato simple desplegado y verificado en Celo.
2. **Conecta todo:** Pasos E–F — pagos reales desde MiniPay.
3. **Bono:** Paso G — COPm.
4. **Capa final opcional (IA):** pistas inteligentes con la API de Anthropic — solo si 1-3 están cerrados. La IA *describe* el país que el grafo ya determinó; NUNCA decide geografía ni mueve dinero.

---

## 7. Reglas de oro (no romper)

- Contrato simple, inmutable → dejarlo bien antes de desplegar.
- Dinero del premio = fondo de plataforma, NO de jugadores que pierden (no apuesta).
- Clave privada solo en `.env` (en `.gitignore`). Nunca a GitHub ni a nadie.
- Probar gratis en Sepolia primero; Mainnet solo al final.
- Copy de UI: "network fee" (no "gas"), "Deposit" (no "onramp"), "dólar digital" (no "cripto").
- MiniPay: auto-connect, bundle < 2 MB, diseñar a 360×640, transacciones legacy (no EIP-1559), sin `personal_sign`.
