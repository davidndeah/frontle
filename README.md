# 🌍 Frontle

> **Conecta el mundo por sus fronteras.** El Wordle de geografía, dentro de MiniPay, con premios reales en stablecoins sobre Celo.

Frontle es un juego de geografía **diario** inspirado en [Travle](https://travle.earth): cada día, el mismo reto para todo el mundo — un país de **origen** y uno de **destino**. Tienes que unirlos listando los países intermedios que comparten frontera terrestre. **Menos países = mejor puntaje;** a igualdad de países, gana quien lo resuelve en menos tiempo.

Construido para **[MiniPay](https://www.opera.com/products/minipay)** (16M+ usuarios) sobre **[Celo](https://celo.org)** para el **Hackathon de Agentes Onchain · Celo Colombia**.

| | |
|---|---|
| 🎮 **App en vivo** | **https://frontle.vercel.app** |
| ⛓️ **Contrato (Celo Mainnet, verificado)** | [`0x7Ea1…Fa09`](https://celo.blockscout.com/address/0x7Ea1EEB96Caf0b07E47354c349b8FdFC75B2Fa09) |

---

## 🎮 Cómo se juega

1. Recibes el reto del día: **Origen → Destino** (ej: 🇨🇴 Colombia → 🇦🇷 Argentina).
2. Escribes países que formen una cadena por fronteras compartidas.
3. Llegas al destino usando la menor cantidad de países posible.
4. **El primer intento del día es gratis.** Pistas y reintentos se pagan en **USDT**, y el ganador del día se lleva el **pot**.

Un semáforo (verde / amarillo / rojo) te indica si cada país acerca, va de lado o aleja del destino.

---

## 💰 Modelo económico (on-chain, en Celo)

| Acción | Precio |
|---|---|
| Primer intento del día | **Gratis** |
| Reintento (mejorar tu marca) | 0.10 USDT |
| Pista — inicial del siguiente país | 0.05 USDT |
| Pista — silueta del siguiente país | 0.05 USDT |
| Pista — silueta de todos los países | 0.10 USDT |

Cada pago se reparte **80% al pot del día / 20% al protocolo**. Al cerrar el día (UTC), el **ganador se lleva todo el pot** (*winner-takes-all*) y lo reclama desde la propia app.

- **Pagos sin fricción:** vía MiniPay con *fee abstraction* (CIP-64) — el usuario paga el fee de red en USDT y **nunca ve "gas" ni CELO**.
- **Localización Colombia:** saldo en **COPm** (peso colombiano de Mento) y un **selector USDT / COP** que muestra todos los montos convertidos a pesos (solo visualización; el token siempre es USDT).
- **4 idiomas:** español, inglés, portugués y francés (nombres de países vía `Intl.DisplayNames`).

---

## 🏗️ Arquitectura

Monorepo de tres capas. Hoy todas las piezas del ciclo de juego + premio están en producción.

```
frontle/
├── frontend/   # Next.js 16 — UI del juego (MiniPay WebView) + lógica del juego
├── supabase/   # Ranking, ganadores y cierre diario (Edge Function + cron)
└── contracts/  # FrontleGame en Celo (Foundry) — pagos y pot diario
```

### Flujo de un día

```
   Jugador                MiniPay / Celo                 Supabase
   ───────                ──────────────                 ────────
   juega y paga  ──▶  payAttempt / buyHint  ──▶  +80% pot   submitScore (ranking)
   pista/reintento     (USDT, sin gas visible)
                                                  ┌────────────────────────────┐
   00:10 UTC (cron) ─────────────────────────────│ Edge Function `close-day`  │
                                                  │ 1. lee al ganador (ranking)│
                                                  │ 2. rollDay(día, ganador)   │── on-chain
                                                  │ 3. registra en `winners`   │
                                                  └────────────────────────────┘
   ganador abre app ──▶ "Reclamar premio" ──▶  claim(día)  ──▶  recibe el pot
```

- **`frontend/`** — Next.js + TypeScript + Tailwind v4 + viem. El grafo de fronteras, BFS de ruta óptima, reto determinista por fecha (todos juegan lo mismo) e i18n son lógica pura en `app/lib/`. Auto-connect dentro de MiniPay (`window.ethereum`, sin librerías de wallet).
- **`supabase/`** — tabla `scores` (ranking diario, identidad por wallet), tabla `winners` (índice de ganadores para la UI) y la Edge Function **`close-day`**: un oráculo que, una vez al día por `pg_cron`, lee al ganador del ranking y lo graba on-chain con `rollDay` para habilitar su reclamo. La fuente de verdad del premio siempre es el contrato.
- **`contracts/`** — `FrontleGame` en Celo Mainnet (verificado en Blockscout). Maneja `payAttempt`/`buyHint`, el pot diario, `rollDay` (solo operador) y `claim` (el ganador retira). Ver [`contracts/README.md`](contracts/README.md) para direcciones de tokens y despliegue con Foundry.

---

## 📦 Stack

- **Frontend:** Next.js 16 · TypeScript · Tailwind CSS v4 · `viem` + `@celo/abis`
- **Mapa:** `d3-geo` + `topojson-client`
- **Backend:** Supabase (Postgres + RLS, Edge Functions en Deno, `pg_cron` + `pg_net`)
- **Blockchain:** Celo Mainnet · USDT (6 dec) con adapter de `feeCurrency` · COPm (Mento)
- **Wallet:** MiniPay (`window.ethereum`, sin librerías de conexión)
- **Deploy:** Vercel (auto-deploy desde GitHub)

---

## 🚀 Desarrollo

```bash
cd frontend
npm install
npm run dev      # http://localhost:3000
npm run build    # build de producción
```

Para probar **dentro de MiniPay** se necesita un dispositivo físico + ngrok (los emuladores no funcionan). El juego es completamente jugable en navegador; la capa de pagos requiere MiniPay.

**Backend (Supabase):** las migraciones (`supabase/migrations/`) crean `winners` y el cron diario; la Edge Function `close-day` se despliega aparte. Requiere los secrets `OPERATOR_PRIVATE_KEY`, `GAME_ADDRESS` y (opcional) `CELO_RPC_URL`.

---

## ✅ Estado

- [x] Frontend completo: juego, mapa, i18n (4 idiomas), ranking, diseño
- [x] Contrato `FrontleGame` desplegado y **verificado en Celo Mainnet**
- [x] Pagos reales en **USDT** desde MiniPay (sin gas visible), probados end-to-end
- [x] Pot diario en vivo + **reclamo de premio** on-chain por el ganador
- [x] Backend Supabase: ranking, ganadores y **cierre diario automático** (cron + oráculo)
- [x] Localización Colombia: saldo COPm + selector de visualización USDT / COP
- [ ] Demo Day — 19 de junio 2026

---

🤖 Desarrollado con [Claude Code](https://claude.com/claude-code)
