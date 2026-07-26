# Análisis — Proof of Ship julio 2026: por qué Frontle está #10 y qué mueve la aguja

> **Fecha del análisis:** 2026-07-25 (leaderboard "Last updated Jul 25, 2026, 11:59 PM")
> **Posición:** **#10 de 241 proyectos**, categoría Gaming & Interactive.
> **Fuentes:** leaderboard en `talent.app/~/earn/celo-proof-of-ship`, fichas de proyecto en
> Talent App, y la API de GitHub sobre los repos de los 9 proyectos por encima.

---

## 1. Las reglas que de verdad importan

Del [FAQ oficial](https://celoplatform.notion.site/Proof-of-Ship-17cd5cb803de8060ba10d22a72b549f8):

| Regla | Implicación para Frontle |
|---|---|
| Cierre de submissions: **27 de julio, 23:59 GMT** | Lo que no esté commiteado y desplegado antes de esa hora no cuenta. |
| **Top 10 se reparte el 50%** del pool ($5.000); el puesto 11–50 se reparte el otro 50% | Frontle está **justo en el borde**. Caer al #11 pasa de compartir $2.500 entre 10 a compartirlo entre 40 — es la diferencia más cara de toda la tabla. |
| Reparto **proporcional al score**, no plano | No basta con entrar al top 10: la distancia contra el #1 también cuenta. |
| Máximo acumulado por proyecto en la Season 2: **2.000 USDT** | Techo a considerar si Frontle ya cobró en meses anteriores. |
| El hook de MiniPay ya **no es obligatorio, pero es un Booster** del score | Frontle ya lo tiene (`lib/minipay.ts`) — booster asegurado. |
| ⚠️ **"Projects already listed on MiniPay are not eligible to get rewards on Proof of Ship"** | **Riesgo real.** Ver §5. |
| Se exige contrato en **Celo Mainnet verificado** + repo público | Cumplido (3 contratos verificados en Celoscan y Blockscout). |

## 2. Qué mide Talent en la ficha del proyecto

Las fichas muestran tres métricas onchain (ventanas 7D/30D/90D/1Y) más las fuentes de datos
registradas (contratos + repos de GitHub + npm). Comparación directa, ventana de 30 días:

| | Frontle (#10) | TipiTip (#1) |
|---|---|---|
| Transactions | **278** (+672 %) | 683 (−93 %) |
| DAU | **117** (+1.070 %) | 676 (−87 %) |
| Gas fees | 3,50 CELO (+1.063 %) | 7,27 CELO (−91 %) |
| Repos registrados | **1** | 2 |
| Contratos registrados | 3 | 3 |

Lectura: Frontle tiene **menos volumen absoluto pero la mejor tendencia de la tabla** — es de los
pocos proyectos creciendo en tres dígitos mientras el #1 se desploma ~90 % en todo. Además la
intensidad de uso es mejor: 278 tx / 117 DAU ≈ **2,4 transacciones por usuario**, contra ≈1,0 de
TipiTip (un patrón que suele indicar cuentas que tocan el contrato una sola vez).

## 3. Benchmark de actividad en GitHub (1–27 de julio)

Medido con la API de GitHub sobre los repos de cada proyecto del top 10:

| # | Proyecto | Repos | Commits julio | PRs julio |
|---|---|---|---|---|
| 1 | TipiTip | 2 | **1.393** | 100+ |
| 2 | NullState | 2 | 260 | 100+ |
| 3 | Pay For API | 1 | 652 | 0 |
| 4 | PlayChessify | 1 | 429 | 0 |
| 5 | GameArena | — | (repo no público/no compartido) | — |
| 6 | chessxu | 1 | **1.790** | 14 |
| 7 | AbaPay | 1 | 295 | 0 |
| 8 | Langclaw AI | **4** | 638 (281+238+119) | 124 |
| 9 | Micromind | 2 | 333 | 64 |
| **10** | **Frontle** | **1** | **366** | **82** |

Frontle está **en la media de commits** del top 10 y es **segundo en PRs** — la actividad de
GitHub no es la debilidad. Los dos números que despegan (1.393 y 1.790) merecen mirarse de cerca,
y ahí aparece lo del §4.

## 4. Los volúmenes altos no son código: TipiTip está inflando la métrica

**El #1 del leaderboard genera commits sintéticos.** Comprobado contra la API de GitHub, no
inferido:

- Sus últimos commits añaden **un archivo cada uno**, con nombre aleatorio del tipo
  `util_4ae64257.ts`, `util_04cb1b64.ts`, `util_c7d0fa63.ts`.
- El diff de cada uno es de **+1 línea** (algunos +5).
- Cada commit va en **su propio PR** (#1584, #1585, … #1598 consecutivos) y lleva `[skip ci]`
  para que no corra CI.
- Los mensajes se repiten en bucle: *"add retry utility function"*, *"add validation utility"*,
  *"add async helper functions"*, tres o cuatro veces en quince commits.
- El repo tiene hoy **1.156 archivos `util_*.ts`** en la raíz. El contenido es relleno: funciones
  con nombre aleatorio (`fetch_2557d0b6`) que nadie importa.

En contraste, **chessxu (1.790 commits) sí es trabajo real**, solo que partido muy fino:
`+44/−6`, `+15/−5`, `+1/−23`… commits convencionales de features de verdad (límite freemium,
integración de Privy), separando `style:`/`docs:`/`refactor:`/`chore:` de cada cambio.

> **Decisión: Frontle no copia el farming.** No es una postura moral abstracta — es que el
> programa se llama "Proof of **Ship**", los proyectos pasan por *Projects Review* del 28 al 31,
> y un repo con mil archivos basura es trivial de detectar y motivo evidente de descalificación.
> El riesgo es perder todo el premio, no ganar unos puestos.
>
> Lo de chessxu **sí es replicable y legítimo**: dividir el trabajo real en commits atómicos con
> mensajes convencionales. Frontle ya lo viene haciendo (ver el historial de julio).

## 5. Brechas reales contra el top (lo accionable)

### 5.1 — Frontle registra **1 repo**; el top registra 2–4

Es la diferencia estructural más clara de la tabla del §3. Langclaw AI registra 4
(`frontend`, `backend`, `contracts`, `.github`), TipiTip 2, NullState 2, Micromind 2. Frontle
registra solo `davidndeah/frontle` porque **es un monorepo**: frontend, contratos y la librería
viven en el mismo árbol.

**Opción legítima disponible:** `@frontle-game/borders` ya es un paquete npm **publicado y
autónomo** (motor de fronteras puro, sin DOM ni React, con su propio `build`, sus 10 tests y su
README). Sacarlo a su propio repo no sería inflar nada: es una librería real, reutilizable por
terceros, que hoy vive incómoda dentro de un monorepo de app. TipiTip hizo exactamente eso con
`tipitip-npm` ("Mirror of the @tipitip/embed npm package").

⚠️ **Pero no antes del 27.** Mover el paquete a otro repo ahora parte el historial y deja el repo
nuevo con ~1 día de actividad. Es una decisión de arquitectura para agosto, no una jugada de
último minuto.

### 5.2 — npm como fuente de datos

Talent muestra una pestaña **npm** en la ficha del proyecto. `@frontle-game/borders@0.1.0` se
publicó el 25 de julio, así que llega tarde para mover el score de este mes, pero queda
sembrado para agosto. TipiTip lleva su paquete npm registrado como fuente desde antes.

### 5.3 — Lo que Frontle ya tiene y el top no

No todo son brechas. Frontle es de los pocos del top 10 con:
- **Crecimiento positivo** en las tres métricas onchain (el resto del podio cae ~90 %).
- **Tres contratos verificados** en Celoscan *y* Blockscout, con resúmenes automáticos ya
  generados por Talent en dos de ellos.
- Un producto con **retención diaria por diseño** (reto diario + racha), no un flujo de una sola
  transacción.

## 6. ⚠️ El riesgo más caro: listarse en MiniPay antes de cobrar

Regla textual del programa:

> "Projects already listed on MiniPay are not eligible to get rewards on Proof of Ship."

Es decir: **si Frontle queda listado en MiniPay antes del payout, pierde el premio del mes.**

Buena noticia: [`PLAN-LISTING.md`](./PLAN-LISTING.md) ya lo tenía previsto — *"el listing se
finaliza/aplica en **agosto** tras el payout de Proof of Ship S2 (31 jul)"*. Este análisis
**confirma esa decisión con la regla textual en la mano**: no era una precaución de más.

Consecuencia operativa: entre hoy y el payout, **preparar** el listing (materiales, PageSpeed,
agente de soporte) es seguro; **enviarlo/activarlo no**.

## 7. Conclusión

Frontle no está #10 por falta de actividad en GitHub — está en la media del top en commits y es
segundo en PRs. Está #10 porque los de arriba tienen **más volumen onchain absoluto** (aunque en
caída libre) y **más fuentes de datos registradas**.

Las tres palancas ordenadas por relación impacto/riesgo:

1. **No romper nada antes del 27** — el activo más valioso ahora es seguir en el top 10, no
   escalar posiciones. Cualquier cambio grande de arquitectura (§5.1) es de agosto.
2. **Seguir shipeando trabajo real en commits atómicos**, que es lo que ya se hace.
3. **Crecer usuarios reales** — es la única métrica donde la brecha es grande y donde Frontle ya
   tiene la mejor tendencia de la tabla. 117 DAU creciendo bate a 676 desplomándose, si el mes
   que viene la curva sigue.

