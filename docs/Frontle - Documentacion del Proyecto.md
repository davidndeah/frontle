# 🌍 Frontle — Documentación del Proyecto

> **Connect countries through borders.**
> MiniApp de geografía diaria para **MiniPay** sobre **Celo**, construida para el **Hackathon de Agentes Onchain — Celo Colombia** (Demo Day: **19 de junio de 2026**).

---

## 🔗 Enlaces clave

| Recurso | Enlace |
|---|---|
| **App en vivo** | https://frontle.vercel.app |
| **Repositorio (GitHub)** | https://github.com/davidndeah/frontle |
| **Hosting** | Vercel (auto-deploy desde `main`) |
| **Hackathon** | https://hackathon.celocolombia.org |
| **Repo de referencia (tutor)** | https://github.com/csacanam/freaking-grammar |

---

## 1. Resumen ejecutivo

**Frontle** es un juego de geografía diario inspirado en [Travle](https://travle.earth). Cada día se genera un reto: un **país de origen** y un **país de destino**. El jugador debe **conectarlos listando los países intermedios que comparten frontera terrestre**, usando la menor cantidad posible.

- Un reto nuevo cada día (igual para todos, como Wordle).
- **1 intento gratis al día.** Intentos extra y pistas se pagan en **stablecoins** (micropagos en Celo).
- Pensado para correr dentro del navegador de **MiniPay** (16M+ usuarios en mercados emergentes).

**Por qué encaja en el hackathon:** los jueces priorizan explícitamente **juegos con mecánicas de earn / pagos por uso**. Frontle es exactamente eso: un juego simple, de sesión corta, con micropagos en stablecoins como núcleo.

---

## 2. Mecánica del juego

1. Se muestra el reto del día: **🇨🇴 Origen → 🇦🇷 Destino**.
2. El jugador escribe países formando una **cadena por fronteras compartidas** (cada país debe limitar con el anterior).
3. **Gana** apenas llega a un país que **limita con el destino** (no hay que escribir el destino mismo).
4. El puntaje es por **número de países usados**: menos países = mejor (la "ruta óptima" se calcula con el camino más corto real).

### Semáforo (feedback visual)

Cada país jugado se colorea según su **desvío respecto a la ruta óptima**:

| Color | Significado | Regla |
|---|---|---|
| 🟢 Verde | Sobre una ruta óptima | desvío = 0 |
| 🟡 Amarillo | Desvío pequeño | desvío 1–2 países |
| 🔴 Rojo | Desvío grande | desvío ≥ 3 países |

> Desvío = `distancia(origen, país) + distancia(país, destino) − distancia(origen, destino)`.
> Garantiza que el número de verdes nunca exceda el óptimo.

### Mapa

Mapa mundial que **revela solo los países conocidos** (origen, destino y los que el usuario ingresa), con zoom automático a la región del reto. El resto del mundo queda oculto. *(Futuro: revelar contornos como pista de pago.)*

---

## 3. Monetización

| Acción | Precio | Estado |
|---|---|---|
| Primer intento del día | **Gratis** | Diseñado |
| Intento extra | 0.10 USDm | Por implementar (blockchain) |
| Pista (región / inicial / silueta del siguiente país) | 0.05 USDm | Por implementar |

- Pagos en **USDm / USDC** vía MiniPay con *fee abstraction* (el usuario nunca ve "gas" ni CELO).
- **Integración con COPm** (peso colombiano de Mento) para mostrar saldos en moneda local → habilita el **bono de 100,000 COPm** del hackathon.

**Decisión de diseño — anti-trampa sin timer:** no usamos cronómetro como mecanismo anti-trampa (genera fricción con las pistas pagas). El reto es el mismo para todos cada día y el puntaje mide cantidad de países, no velocidad. Un modo competitivo con timer opcional puede llegar después.

---

## 4. Alineación con Celo y MiniPay

### Criterios de evaluación del hackathon (y cómo encaja Frontle)

| Criterio | Peso | Cómo lo cumple Frontle |
|---|---|---|
| **Utilidad real** | 30% | Juego entretenido, usable sin saber de blockchain |
| **Calidad de producto** | 25% | App móvil funcional, acción rápida (<60s), sin links rotos |
| **Integración Celo** | 20% | Stablecoins (USDm/USDC) en el flujo central + smart contract |
| **Actividad blockchain** | 15% | Transacciones reales de pago por intento/pista |
| **Originalidad** | 10% | Único juego de geografía; categoría priorizada (games + earn) |

### Requisitos obligatorios de entrega

- [ ] Smart contract desplegado en **Celo Mainnet o Sepolia**
- [x] Repositorio **público** en GitHub con código real
- [x] **URL pública** accesible y funcional
- [ ] Funciona dentro del **navegador de MiniPay**
- [ ] Video demo

### App Fit Score (framework de la Celopedia) — **8/10 → Tier 1 "Build now"**

| Dimensión | Puntaje |
|---|---|
| Stablecoin-native | 2/2 |
| Sesión corta | 1/2 |
| Encaje mercado local | 1/2 |
| Sin `personal_sign` | 2/2 |
| Hueco de categoría (games) | 2/2 |

### Premios

- 🥇 1,000,000 COP · 🥈 600,000 COP · 🥉 400,000 COP
- Bono de integración: hasta 10 proyectos × **100,000 COPm** c/u

---

## 5. Arquitectura técnica *(para el equipo de desarrollo)*

### Capas (separadas desde el inicio — Bootcamp 1)

```
frontle/
├── frontend/     # Capa 1 · Next.js — la UI del juego (corre en MiniPay WebView)
├── backend/      # Capa 2 · Lógica de servidor / API (opcional para MVP)
└── contracts/    # Capa 3 · Smart contracts en Celo (Foundry)
```

### Stack

| Capa | Tecnología |
|---|---|
| Frontend | **Next.js 16** (App Router) · **TypeScript** · **Tailwind CSS 4** |
| Web3 | **viem v2** · `@celo/abis` (MiniPay usa `window.ethereum` directo, sin wagmi/RainbowKit) |
| Mapa | **d3-geo** + **topojson-client** (atlas Natural Earth cargado por CDN) |
| Blockchain | **Celo** (L2 de Ethereum) · stablecoins USDm/USDC/COPm |
| Deploy | **Vercel** (auto-deploy desde GitHub) |

### Lógica del juego (sin backend para el MVP)

Todo el juego corre en el frontend con **datos estáticos**:

- **`app/lib/countries.ts`** — grafo de fronteras de **153 países**. Cada país tiene `name`, `flag`, `code` (ISO derivado de la bandera) y `neighbors`. El grafo se **auto-normaliza a simétrico** (si A declara a B, B tendrá a A).
- **`app/lib/game.ts`** — lógica pura:
  - `shortestPath()` → **BFS** para la ruta más corta entre dos países.
  - `dailyChallenge()` → reto diario **determinístico** (PRNG sembrado por la fecha UTC → todos ven el mismo reto, dificultad 3–6 países).
  - `countryQuality()` → cálculo del semáforo por desvío.
  - `tryGuess()` → valida la jugada y devuelve un **código de razón** (no texto) para que la UI lo traduzca.
- **`app/lib/i18n.ts`** — internacionalización (ver abajo).
- **`app/components/WorldMap.tsx`** — render del mapa con d3-geo (proyección Equal Earth, `fitExtent` a los países conocidos).

> **Dato geográfico importante:** América **no tiene frontera terrestre** con Eurasia/África — son dos componentes desconectados del grafo. `dailyChallenge()` descarta pares sin ruta, así que nunca propone un reto imposible.

### Internacionalización (i18n)

Detecta el idioma del navegador (`navigator.language`) y adapta toda la app a los idiomas de los **mercados principales de Celo/MiniPay**:

- 🇨🇴 **Español** (Colombia, LatAm)
- 🇳🇬 **Inglés** (Nigeria, Kenia, Ghana, Sudáfrica, Filipinas)
- 🇧🇷 **Portugués** (Brasil)
- 🌍 **Francés** (África francófona)

**Truco técnico:** los nombres de países **no se traducen a mano**. Se usa `Intl.DisplayNames` del navegador con el **código ISO derivado del emoji de la bandera** (🇨🇴 = regional indicators C+O = "CO"). Esto traduce los 153 países a cualquier idioma automáticamente.

### Cómo correr en local *(para el compañero de IT)*

```bash
# Requisitos: Node.js 18+ (usamos v24), npm
git clone git@github.com:davidndeah/frontle.git
cd frontle/frontend
npm install
npm run dev          # http://localhost:3000
npm run build        # validar build de producción
```

> ⚠️ El proyecto vive fuera de OneDrive a propósito: OneDrive sincronizando `node_modules` rompe los builds.

### Probar dentro de MiniPay *(requiere dispositivo físico)*

Los emuladores **no funcionan**. Se necesita un Android/iOS real:

```bash
npm run dev
npx ngrok http 3000   # expone localhost con HTTPS
```

En MiniPay: Settings → About → tocar Version 7 veces → activar Developer Mode + Use Testnet → pegar la URL de ngrok en "Load Test Page".

---

## 6. Capa blockchain *(lo que sigue)*

### Diseño del smart contract

Inspirado en el contrato **`FreakingPot.sol`** del tutor (csacanam/freaking-grammar). Modelo de **pot diario winner-takes-all**:

- **Free play diario**: la primera jugada de cada día UTC es gratis por wallet.
- **Jugadas pagas**: `play()` cobra una entry fee en stablecoin → 80% al pot del día, 20% fee de protocolo.
- **Pistas**: `buyHint(tipo)` cobra una tarifa menor.
- **Rollover diario**: un `operator` llama `rollDay()` a las 00:00 UTC para cerrar el día y abrir el siguiente.
- **Claim**: el ganador del día reclama el pot.
- Usa `SafeERC20`, `Ownable` y *custom errors* (OpenZeppelin).

### Tokens en Celo (Mainnet)

| Token | Dirección | Decimales |
|---|---|---|
| USDm (cUSD) | `0x765DE816845861e75A25fCA122bb6898B8B1282a` | 18 |
| USDC | `0xcebA9300f2b948710d2653dD7B07f33A8B32118C` | 6 |
| USDT | `0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e` | 6 |
| COPm (Mento) | `0x8A567e2aE79CA692Bd748aB832081C45de4041eA` | 18 |

> **Fee abstraction:** para pagar el "network fee" en USDC/USDT hay que usar la dirección **adapter**, no la del token:
> - USDC adapter: `0x2F25deB3848C207fc8E0c34035B3Ba7fC157602B`
> - USDT adapter: `0x0e2a3e05bc9a16f5292a6170456a710cb89c6f72`
> - USDm: la dirección del token sirve como adapter (es de 18 decimales).

### Redes

| Red | Chain ID | Uso |
|---|---|---|
| Celo Sepolia (testnet) | `11142220` | Demo |
| Celo Mainnet | `42220` | Bono de integración (contrato verificado) |

- RPC público: `https://forno.celo.org`
- Block time ~1s · gas pagable en stablecoins.

### Integración con MiniPay (patrones de código)

```typescript
// Detección
const isMiniPay = window.ethereum?.isMiniPay === true;

// Auto-connect (OBLIGATORIO: sin botón "Connect Wallet" dentro de MiniPay)
const client = createWalletClient({ chain: celo, transport: custom(window.ethereum) });
const [address] = await client.getAddresses();

// Pago al contrato con fee abstraction (USDm)
await walletClient.sendTransaction({
  account: address,
  to: GAME_CONTRACT_ADDRESS,
  data: encodeFunctionData({ abi, functionName: "play" }),
  feeCurrency: "0x765DE816845861e75A25fCA122bb6898B8B1282a", // USDm
});
```

### Pasos pendientes de la capa blockchain

1. Instalar **Foundry** (`forge`) e inicializar `contracts/`.
2. Escribir el contrato (pagos de intento + pista, eventos).
3. Desplegar en **Celo Sepolia** y verificar.
4. Conectar el frontend (auto-connect + botón de pago con viem).
5. Probar en MiniPay real con ngrok.
6. (Para el bono) desplegar y verificar en **Mainnet** + integrar COPm.

---

## 7. Restricciones de MiniPay *(crítico para desarrollo)*

| Restricción | Detalle |
|---|---|
| **Bundle < 2 MB** | Usar SVG/WebP, no PNG/JPG grandes |
| **Resolución mínima** | Diseñar y probar a **360 × 640** |
| **Solo USDm/USDC/USDT** | **Nunca mostrar CELO** en la UI |
| **Transacciones legacy** | No usar `maxFeePerGas`/`maxPriorityFeePerGas` (EIP-1559) |
| **Sin firma de mensajes** | No funcionan `personal_sign` ni `eth_signTypedData` |
| **Auto-connect** | Nunca mostrar botón "Connect Wallet" dentro de MiniPay |
| **Sin geolocalización en iOS** | `navigator.geolocation` no funciona en MiniPay iOS |
| **Solo dispositivo físico** | Los emuladores no sirven; usar ngrok |
| **Copy de UI** | Decir "network fee" (no "gas"), "Deposit" (no "onramp"), "Digital dollar" (no "crypto") |

---

## 8. Conceptos clave del Hackathon *(Kickoff + Bootcamp 1)*

| Concepto | Definición |
|---|---|
| **Vibe Coding** | Desarrollar usando IA (Claude, Cursor, Codex) como copiloto |
| **MVP** | La versión más pequeña que resuelve el dolor del usuario. Build → Measure → Learn |
| **MiniPay** | Wallet de stablecoins (16M+ usuarios) integrada en Opera Mini; el canal de distribución |
| **Stablecoin** | Moneda estable (USDm, USDC, COPm). Celo está optimizado para pagos con ellas |
| **Build in Public** | Publicar el progreso abiertamente — motor de crecimiento orgánico |
| **Proof of Ship** | Programa de Celo (talent.app) que recompensa publicar proyectos reales |
| **SSH Key** | Criptografía asimétrica: llave pública en GitHub, privada en tu máquina. (Las wallets usan el mismo principio) |
| **`.gitignore`** | Lista de archivos que git ignora — protege secretos (`.env`, llaves de wallet). Los bots cazan API keys en GitHub 24/7 |
| **Vercel** | Hosting que redespliega solo con cada `git push` |

### Arquitectura de capas (Kickoff)

```
Capa 1 · Frontend    → La interfaz que ve el usuario
Capa 2 · Backend     → La lógica (opcional para MVP)
Capa 3 · Blockchain  → Smart contracts en Celo
```

---

## 9. Estado actual y roadmap

### ✅ Completado

- [x] Idea aterrizada (Frontle)
- [x] SSH key configurada + repo público en GitHub
- [x] `.gitignore` con protección de secretos
- [x] Vercel conectado + URL pública con auto-deploy
- [x] **Frontend funcional**: juego completo, mapa, semáforo, i18n (4 idiomas), diseño
- [x] Lógica del juego (grafo de 153 países, BFS, reto diario)

### ⬜ Pendiente (hacia Demo Day)

- [ ] Smart contract de pagos (intentos + pistas) en Solidity/Foundry
- [ ] Desplegar y verificar en Celo Sepolia
- [ ] Integración MiniPay: auto-connect + pagos con viem
- [ ] Pistas pagas (región / inicial / silueta)
- [ ] Integración COPm (bono de 100k)
- [ ] Probar en MiniPay real (dispositivo + ngrok)
- [ ] Video demo

### Reparto de trabajo sugerido

- **David** — producto, diseño, frontend del juego, demo.
- **Compañero (IT)** — capa blockchain: smart contract en Foundry, despliegue en Celo, integración de pagos con viem.

---

## 10. Cómo contribuir *(flujo de trabajo)*

1. Clonar el repo y trabajar en `frontend/` (juego) o `contracts/` (blockchain).
2. `npm run build` antes de pushear para validar.
3. `git push` a `main` → Vercel despliega solo en ~1 min.
4. **Nunca** commitear `.env` ni llaves privadas de wallet (ya están en `.gitignore`).
5. Para la capa blockchain, considerar trabajar en branches + PRs para revisión.

---

*Documento generado para el equipo de Frontle · Hackathon de Agentes Onchain · Celo Colombia 2026.*
