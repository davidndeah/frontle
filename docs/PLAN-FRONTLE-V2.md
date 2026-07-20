# PLAN — Frontle v2: liga semanal, XP y mercado de monedas

> La versión 2 del juego. Decisiones de Santiago (2026-07-19) sobre el análisis de
> [[PLAN-COPA-SEMANAL]] (`docs/PLAN-COPA-SEMANAL.md`), que queda como documento de
> contexto/referencias; **este archivo es la especificación que manda**.
> Estilo `PLAN-*` del repo. Cumplimiento: `.agents/skills/celopedia-skill/references/minipay-requirements.md`.

---

> ## 🚧 Estado de ejecución (rama `v2`, sin mergear a main)
> - ✅ **Fase 1** — XP en los 4 modos + ranking semanal en seco (migración 0008 en prod).
> - ✅ **Fase 2** — monedas: `coin_ledger`, tienda, pistas de la liga (migración 0009 + edge function `credit-coins`).
> - ✅ **Fase 3** — racha real con congelar/reparar (migración 0010). Incluye el arreglo de
>   una vulnerabilidad de la Fase 2: los gastos ahora exigen identidad verificada.
> - ✅ **Fase 4** — contrato `FrontleWeekly` escrito y **24/24 tests en verde** (69/69 en total).
>   ⏳ **Pendiente manual de Santiago:** desplegarlo, verificarlo y configurar las 2 variables
>   (ver §9). Mientras no exista, la compra de monedas sigue por el camino interino
>   (transfer a la wallet del operador) y el edge function acepta ambos.
> - ✅ **Fase 5** — wallet obligatoria para competir (migración 0013). Las divisiones
>   se implementaron y luego se **retiraron** (migración 0014): con el volumen actual
>   va **un solo ranking semanal global** que premia al top 3. Pendiente el anti-sybil
>   con humano verificado (Self/GoodID), que necesita decisión de producto.

## 1. Resumen ejecutivo

Frontle v2 añade **una liga semanal tipo Duolingo** encima del juego actual:
todos los modos (incluidos los gratis) emiten **XP** que posiciona al jugador en un
**ranking semanal**; al cerrar la semana, los 3 primeros reparten un **pot real**
(50 / 30 / 10, con 10% de recaudo para el protocolo) desde **un contrato nuevo**
(`FrontleWeekly`). Además llega un **mercado de monedas de juego** para la liga y
sus modos: el jugador compra monedas por adelantado (esa venta fondea el pot
semanal) y paga pistas, reintentos y reparaciones de racha **al instante, sin
transacción en medio del juego**. El reto diario y sus compras en USDT **no se
tocan** — cada economía fondea su propio pot.

## 2. Lo que NO cambia (v1 sigue intacta)

- **Reto diario** con 3 niveles, mismo reto para todos, ranking diario por
  (países, tiempo) — igual que hoy.
- **Pot diario on-chain** repartido entre los ganadores de nivel (50/35/15, contrato
  v2 actual) y su flujo de fees 80% pot / 20% protocolo.
- **Las compras del diario no se tocan:** pistas y reintentos del reto diario se
  siguen pagando **directo en USDT** (con la pausa del cronómetro ya implementada)
  y siguen fondeando el pot diario. **Las monedas NO aplican en el reto diario** —
  las dos economías no se cruzan.
- **Sistema de rachas** (días consecutivos resolviendo el diario) con sus hitos.

## 2b. Regla universal de intentos

**En todos los modos — incluido el reto diario — el primer intento es gratis**
(como hoy). **El segundo intento se paga**, cada uno en la moneda de su economía:

| Modo | 1er intento | 2do intento en adelante |
|---|---|---|
| Reto diario | Gratis | **0.10 USDT** directo (como hoy, al pot diario) |
| Regiones / Quiz / Práctica (liga) | Gratis | **5 🪙** ($0.05) por intento, al ledger |

Hoy los modos gratis tienen intentos ilimitados; en v2 adoptan esta regla — es la
fuente de gasto de monedas que sostiene el pot semanal.

## 3. Liga semanal

### 3.1 Ciclo

- **Semana de lunes 00:00 UTC a domingo 23:59 UTC** (mismo reloj UTC del reto diario).
- El XP se acumula durante la semana y **se resetea al abrir la siguiente**.
- Al cierre, el operador ejecuta el rollo semanal (mismo patrón operador + cron de
  `close-day`); los ganadores **reclaman su premio** desde la app (claim manual,
  como los premios diarios).

### 3.2 Premios del pot semanal

| Posición | Parte del pot |
|---|---|
| 🥇 1er puesto | **50%** |
| 🥈 2do puesto | **30%** |
| 🥉 3er puesto | **10%** |
| Recaudo del protocolo | **10%** |

- Desempate: si dos jugadores terminan con el mismo XP, gana quien lo alcanzó primero
  (timestamp del último evento de XP).
- Niveles vacíos no aplican aquí (siempre hay top-3 si hay ≥3 jugadores con XP);
  con menos de 3 participantes, las partes vacantes **se acumulan al pot de la
  semana siguiente**.

### 3.3 Fondeo del pot (contrato propio)

- El pot semanal vive en **un contrato separado** (`FrontleWeekly`) — el contrato
  del diario no se modifica.
- **Siembra de la plataforma** (`fundPot` semanal) — el premio base garantizado.
- **Ventas de monedas:** el 100% de cada compra de monedas entra al pot de la
  semana en curso en `FrontleWeekly`; el recaudo del protocolo sale del 10% en el
  reparto.
- Encuadre de cumplimiento: **torneo con premio sembrado por la casa**. Los modos
  que dan XP son gratis — nadie paga por competir; las monedas compran
  *consumibles del juego*, no entradas al torneo. (Ver la nota de riesgo en
  [[frontle-economy-model-decision]] y `PLAN-COPA-SEMANAL.md` §5.)

### 3.4 Un solo ranking, sin divisiones (decisión 2026-07-20)

- **Una sola tabla semanal global**: se reinicia cada lunes y premia a los 3
  primeros por XP. Nada de divisiones mientras no haya volumen — partir la liga
  en 4 dejaba cohortes de una o dos personas, sin competencia real y con el pot
  yendo a un grupo casi vacío. (El código de divisiones se retiró en la
  migración 0014; queda en el historial por si vuelve.)
- **Competir exige wallet**, igual que el ranking diario: sin ella no se emite XP
  (impuesto con un check en la base, no solo en el cliente). Jugar sigue siendo
  libre para cualquiera; lo que requiere identidad es entrar a la tabla.
- **El incentivo**: más XP = jugar más y mejor. Las monedas ayudan a jugar más
  (pistas y nuevos intentos en los modos de la liga), y cada compra engorda el
  pot de esa misma semana.

### 3.5 Futuro (no bloquea)

- **Divisiones** con ascenso/descenso cuando el volumen de jugadores lo pida.
- **1 entrada por humano verificado** (Self / GoodID) antes de que los premios
  crezcan. Requiere integrar un proveedor externo — decisión pendiente.

## 4. Sistema de XP

### 4.1 Dónde y cuánto se gana

El reto diario da XP según **dos ejes: el nivel jugado y la calidad de la
solución (las estrellas de precisión que ya existen)**:

| Fuente | XP | Tope |
|---|---|---|
| Reto diario resuelto — **fácil** | **10** | por nivel/día |
| Reto diario resuelto — **medio** | **20** | por nivel/día |
| Reto diario resuelto — **difícil** | **30** | por nivel/día |
| Solución ⭐⭐⭐ (ruta óptima) | **+10** | por nivel/día |
| Solución ⭐⭐ (+1 país sobre la óptima) | **+5** | por nivel/día |
| Solución ⭐ (+2 países) | **+0** | resolver ya paga el XP base |
| Bonus sin pistas | **+5** | por nivel/día |
| **Racha mantenida** (resolver el diario del día) | **+5** | 1/día |
| Hito de racha (7, 30, 100 días) | **+20** | 1 por hito |
| **Regiones** — completar un país | **10** | 1 país con XP/día |
| **Quiz banderas** — por acierto | **2** | máx 10 XP/día |
| **Quiz contornos** — por acierto | **2** | máx 10 XP/día |
| **Práctica** — reto resuelto | **5** | máx 15 XP/día |

- Máximo teórico/día de modos **gratis**: 10+10+10+15 + 5 racha = **50 XP**.
- Máximo teórico/día jugando **todo** (3 niveles del diario con bonos): ~**125 XP**.
  El diario paga más que el farmeo gratis — por diseño: es el modo que monetiza.

### 4.2 Reglas de integridad

1. **El XP no se compra** — ni con monedas ni con USDT. Nunca. Es la moneda del
   ranking y comprarla mataría la liga (y el encuadre de torneo de habilidad).
2. Los topes diarios se validan **en el servidor** (mismo modelo que
   `player_progress`: el cliente reporta eventos, el servidor deriva y capea).
3. El XP semanal vive en Supabase (`xp_events` → vista semanal agregada); el
   contrato solo recibe a los 3 ganadores en el rollo (patrón `rollDay` actual:
   el operador aporta direcciones, el contrato calcula montos).

## 5. Mercado de monedas 🪙

**Moneda de juego prepagada** (nombre visible: *monedas*). Se compran con USDT en
la tienda y se gastan al instante — sin transacción on-chain en medio del juego.

**Ámbito: la liga semanal y sus modos (Regiones, quizzes, Práctica) + los ítems de
racha.** El reto diario queda fuera: allí se sigue pagando directo en USDT (§2).
La compra de monedas es la transacción on-chain (va al pot semanal, §3.3); el
gasto es un débito instantáneo en el ledger.

### 5.1 Paridad y paquetes

**1 moneda = $0.01 USDT** (calibrada con los precios actuales del juego).

| Paquete | Monedas | Precio | Bonus |
|---|---|---|---|
| Puñado | 50 🪙 | 0.50 USDT | — |
| Bolsa | 110 🪙 | 1.00 USDT | +10% |
| Cofre | 300 🪙 | 2.50 USDT | +20% |

- **Bienvenida:** 10 🪙 gratis a cada cuenta nueva (una pista + margen), además del
  bono USDT actual del faucet.
- Las monedas **no se retiran, no se transfieren y no compran XP** — son crédito
  interno de consumibles, no un token (clave para MiniPay y para no crear un
  mercado secundario).

### 5.2 Qué se puede comprar y a qué precio

| Ítem | Monedas | Equivalente | Dónde aplica |
|---|---|---|---|
| Pista en modos de la liga (inicial / silueta del siguiente) | **3 🪙** | $0.03 | Regiones · quizzes · Práctica |
| Pista fuerte en modos de la liga (silueta de todos / equivalente del modo) | **5 🪙** | $0.05 | Regiones · Práctica |
| **Nuevo intento en modos de la liga** (el 1º es gratis, §2b) | **5 🪙** | $0.05 | Regiones · quizzes · Práctica |
| **Congelar racha** (1 día sin jugar no la rompe) | **15 🪙** | $0.15 | racha del diario; máx 2 equipadas (patrón Duolingo) |
| **Reparar racha perdida** (ventana de 48h) | **25 🪙** | $0.25 | racha ≤ 7 días |
| Reparar racha larga (ventana de 48h) | **50 🪙** | $0.50 | racha > 7 días (vale más, cuesta más) |

- **Las pistas y reintentos del reto diario NO se pagan con monedas** — allí sigue
  el flujo USDT directo actual (0.05/0.05/0.10 pista, 0.10 reintento) hacia el pot
  diario. Sin solapamiento entre economías.
- Los ítems de racha son *meta* (se compran fuera de cualquier reto en curso), por
  eso viven en monedas aunque la racha sea del diario.
- Las pistas de la liga son más baratas que las del diario a propósito: en la liga
  no compiten contra un premio diario en tiempo real.
- La reparación de racha restaura la racha **y** su elegibilidad al +5 XP diario,
  pero **no** paga retroactivamente el XP de los días perdidos.

### 5.3 Contabilidad (server-authoritative)

- Compra: `requestPayment` on-chain (flujo actual) → edge function acredita el
  paquete en `coin_ledger` al confirmarse la tx.
- Gasto: el cliente pide el gasto, **el servidor valida saldo y aplica** (misma
  filosofía que el progreso: el cliente nunca asevera saldos).
- `coin_ledger` es append-only: compras (+), gastos (−), bienvenida (+). El saldo
  es la suma — auditable y sin estados que corromper.

## 6. Flujo del dinero (v2 completo)

```
RETO DIARIO (contrato actual, sin cambios)
  Pista/reintento directo en USDT    →  80% pot diario · 20% protocolo

LIGA SEMANAL (contrato nuevo: FrontleWeekly)
  Compra de monedas (USDT)           →  100% pot semanal
  Gasto de monedas (pistas liga,
  reintentos liga, ítems de racha)   →  débito en ledger (off-chain, instantáneo)
  Reparto al cierre                  →  50% 🥇 · 30% 🥈 · 10% 🥉 · 10% protocolo

Siembra de plataforma (fundPot)      →  cada contrato por separado, a discreción
```

## 7. Implementación por fases

| Fase | Entregable | Alcance |
|---|---|---|
| **1** | XP en todos los modos + topes, vista semanal, UI del ranking semanal (sin premio) | Supabase (`xp_events` + vistas) y frontend. Valida la liga en seco. |
| **2** | Tienda de monedas + `coin_ledger` + pistas/reintentos con monedas en los modos de la liga | Edge function de acreditación; UI de tienda; el diario no se toca. |
| **3** | Congelar/reparar racha con monedas | Lógica de racha en servidor + UI en el strip de racha. |
| **4** | Contrato `FrontleWeekly` (pot semanal, `rollWeek(w, first, second, third)` con 50/30/10/10, claim, `recoverUnrolledPot`) + cierre semanal en el cron | Foundry + operador. Mientras no exista, el premio semanal se paga con el flujo de premios actual sembrado a mano. |
| **5** | v2.1: divisiones, verificación de humano, notificaciones del cierre | Cuando haya tracción. |

Cada fase es shippeable sola y suma commits a Proof of Ship. Gates de siempre:
`tsc` limpio, reglas MiniPay (la tienda dice *monedas* y *depositar*, nunca
palabras prohibidas), móvil 360×640, `prefers-reduced-motion` en animaciones nuevas.

## 8. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Farmeo de XP en modos gratis | Topes diarios por modo validados en servidor (§4.2) |
| Sybil (multicuentas por el premio semanal) | Corto plazo: XP gratis capeado hace caro el ataque; medio plazo: 1 entrada por humano (Self/GoodID) antes de subir premios |
| Lectura de "apuesta" en el review de MiniPay | Competir es gratis; monedas = consumibles; premio sembrado por la casa; recaudo explícito del 10% (§3.3) |
| Monedas como cuasi-token | No retirables, no transferibles, no compran XP; solo consumibles in-app (§5.1) |
| Confusión entre las dos economías | Separación estricta por modalidad: diario = USDT directo, liga = monedas. Nunca conviven en la misma pantalla |
| Comprar pistas de la liga como atajo de XP | Las pistas ayudan a resolver pero el XP de los modos gratis está capeado por día (§4.1) — pagar no rompe el tope |

---

## 9. Despliegue de `FrontleWeekly` (pendiente manual)

El contrato está en `contracts/src/FrontleWeekly.sol` con su script y sus tests.
**Requiere la cuenta desplegadora de Santiago**, por eso no está desplegado.

```bash
cd contracts
forge test --match-contract FrontleWeekly     # 24/24 en verde

# .env: OPERATOR=0x54E8…DD0 · TOKEN_ADDRESS=0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e
# MIN_PURCHASE=100000 (0.10 USDT, 6 dec) · PROTOCOL_BPS=1000 (10%)
forge script script/DeployWeekly.s.sol --rpc-url celo --account frontle-deployer --broadcast

forge verify-contract <addr> src/FrontleWeekly.sol:FrontleWeekly --chain-id 42220 \
  --verifier etherscan --verifier-url "https://api.etherscan.io/v2/api?chainid=42220"
```

Tras desplegar, dos variables activan el camino definitivo (el código ya las lee):

| Dónde | Variable | Valor |
|---|---|---|
| Vercel (frontend) | `NEXT_PUBLIC_WEEKLY_ADDRESS` | dirección del contrato |
| Supabase (secrets) | `WEEKLY_ADDRESS` | la misma dirección |

Sin ellas, la compra de monedas hace un transfer a la wallet del operador y el
premio semanal se siembra a mano — todo lo demás (XP, liga, monedas, racha)
funciona igual.

**Cierre semanal:** ✅ hecho. `supabase/functions/close-week` está desplegada y
agendada por cron los **lunes 00:20 UTC** (10 min después del `close-day` de ese
día, porque ambas firman con la misma wallet y dos tx simultáneas se pisarían el
nonce). Lee el top-3 de `weekly_xp`, llama `rollWeek` y registra el podio en
`weekly_winners` (migración 0011). Es idempotente y, sin `WEEKLY_ADDRESS`,
responde `skipped` sin tocar nada — probado en producción.

Dos detalles que quedaron resueltos ahí:
- **Los dos números de semana**: el lunes de la semana `w` del contrato es el día
  `7w-3` desde el epoch (cayó en jueves). La conversión está verificada.
- **Jugadores sin wallet**: el XP se gana con identidad anónima, pero on-chain solo
  se premia a una dirección. Igual que `close-day`, se saltan y el puesto pasa al
  siguiente elegible; la respuesta los lista en `notPayable` para atenderlos a mano.
  Es el punto que conviene revisar si la liga crece con muchos jugadores sin wallet.

---

*v1 del plan — 2026-07-19. Decisiones de producto: Santiago. Especificación: Fable.
Contexto y referencias de mecánicas: `docs/PLAN-COPA-SEMANAL.md` y
`docs/benchmark/MECANICAS.md`. Direcciones y contratos: `NIVELES.md`.*
