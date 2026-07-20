# PLAN — Frontle v2: liga semanal, XP y mercado de monedas

> La versión 2 del juego. Decisiones de Santiago (2026-07-19) sobre el análisis de
> [[PLAN-COPA-SEMANAL]] (`docs/PLAN-COPA-SEMANAL.md`), que queda como documento de
> contexto/referencias; **este archivo es la especificación que manda**.
> Estilo `PLAN-*` del repo. Cumplimiento: `.agents/skills/celopedia-skill/references/minipay-requirements.md`.

---

## 1. Resumen ejecutivo

Frontle v2 añade **una liga semanal tipo Duolingo** encima del juego actual:
todos los modos (incluidos los gratis) emiten **XP** que posiciona al jugador en un
**ranking semanal**; al cerrar la semana, los 3 primeros reparten un **pot real**
(50 / 30 / 10, con 10% de recaudo para el protocolo). Además llega un **mercado de
monedas de juego**: el jugador compra monedas por adelantado y paga pistas,
reintentos y reparaciones de racha **al instante, sin transacción en medio del reto**.

## 2. Lo que NO cambia (v1 sigue intacta)

- **Reto diario** con 3 niveles, mismo reto para todos, ranking diario por
  (países, tiempo) — igual que hoy.
- **Pot diario on-chain** repartido entre los ganadores de nivel (50/35/15, contrato
  v2 actual) y su flujo de fees 80% pot / 20% protocolo.
- **Sistema de rachas** (días consecutivos resolviendo el diario) con sus hitos.
- Pago directo en USDT de pistas/reintentos **sigue disponible** (con la pausa del
  cronómetro ya implementada) — las monedas son el camino rápido, no el único.

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

### 3.3 Fondeo del pot

- **Siembra de la plataforma** (`fundPot` semanal) — el premio base garantizado.
- **Ventas de monedas:** el 100% de cada compra de monedas entra al pot de la
  semana en curso; el recaudo del protocolo sale del 10% en el reparto.
- Encuadre de cumplimiento: **torneo con premio sembrado por la casa**. Los modos
  que dan XP son gratis — nadie paga por competir; las monedas compran
  *consumibles del juego*, no entradas al torneo. (Ver la nota de riesgo en
  [[frontle-economy-model-decision]] y `PLAN-COPA-SEMANAL.md` §5.)

### 3.4 Futuro (v2.1, no bloquea)

- **Divisiones con ascenso/descenso** (cohortes de ~30, patrón Duolingo) cuando el
  volumen de jugadores lo amerite.
- **1 entrada por humano verificado** (Self/GoodID) antes de que los premios crezcan.

## 4. Sistema de XP

### 4.1 Dónde y cuánto se gana

| Fuente | XP | Tope |
|---|---|---|
| Reto diario resuelto — **fácil** | **10** | por nivel/día |
| Reto diario resuelto — **medio** | **20** | por nivel/día |
| Reto diario resuelto — **difícil** | **30** | por nivel/día |
| Bonus ruta óptima (⭐⭐⭐) | **+10** | por nivel/día |
| Bonus ⭐⭐ (+1 país sobre la óptima) | **+5** | por nivel/día |
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
la tienda y se gastan al instante dentro del juego — **sin transacción on-chain en
medio del reto**, que era el dolor que la pausa del cronómetro mitiga; con monedas
la pausa ni siquiera hace falta porque el gasto es inmediato.

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

| Ítem | Monedas | Equivalente | Nota |
|---|---|---|---|
| Pista: inicial del siguiente país | **5 🪙** | $0.05 | mismo precio actual |
| Pista: silueta del siguiente país | **5 🪙** | $0.05 | mismo precio actual |
| Pista: silueta de todos | **10 🪙** | $0.10 | mismo precio actual |
| Reintento del reto diario | **10 🪙** | $0.10 | mismo precio actual |
| **Congelar racha** (1 día sin jugar no la rompe) | **15 🪙** | $0.15 | máx 2 equipadas (patrón Duolingo) |
| **Reparar racha perdida** (ventana de 48h) | **25 🪙** | $0.25 | racha ≤ 7 días |
| Reparar racha larga (ventana de 48h) | **50 🪙** | $0.50 | racha > 7 días (vale más, cuesta más) |

- El pago directo en USDT de pistas/reintentos sigue existiendo al mismo precio —
  monedas = conveniencia (instantáneo), no descuento ni exclusividad.
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
Pago directo pista/reintento (USDT)  →  80% pot diario · 20% protocolo   (v1, sin cambios)
Compra de monedas (USDT)             →  100% pot semanal                 (nuevo)
Reparto semanal                      →  50% 🥇 · 30% 🥈 · 10% 🥉 · 10% protocolo
Siembra de plataforma (fundPot)      →  pot diario y/o semanal, a discreción
```

## 7. Implementación por fases

| Fase | Entregable | Alcance |
|---|---|---|
| **1** | XP en todos los modos + topes, vista semanal, UI del ranking semanal (sin premio) | Supabase (`xp_events` + vistas) y frontend. Valida la liga en seco. |
| **2** | Tienda de monedas + `coin_ledger` + gasto instantáneo de pistas/reintentos | Edge function de acreditación; UI de tienda; el flujo USDT directo se conserva. |
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
| Doble economía confusa (USDT directo vs monedas) | Mismos precios en ambos caminos; la tienda comunica "sin esperas dentro del reto" como único diferencial |
| El pot diario pierde fondeo si todos migran a monedas | Monitorear el mix en `/stats`; si el diario se seca, rebalancear (ej. 30% de ventas de monedas al pot diario) — decisión de datos, no de diseño |

---

*v1 del plan — 2026-07-19. Decisiones de producto: Santiago. Especificación: Fable.
Contexto y referencias de mecánicas: `docs/PLAN-COPA-SEMANAL.md` y
`docs/benchmark/MECANICAS.md`. Direcciones y contratos: `NIVELES.md`.*
