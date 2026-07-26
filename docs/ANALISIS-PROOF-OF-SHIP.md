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

