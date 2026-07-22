# Métricas reales del leaderboard de Proof of Ship — Frontle vs. Top 10

> Extraído directo de talent.app (grantId=1289, campaña **Junio 2026**, ya cerrada y
> **pagada el 3 jul**; "Last updated Jun 22"). Es la data COMPLETA y comparable más
> reciente. La campaña **Julio (1–27, en curso)** es la que estamos corriendo ahora.
> Archivos hermanos: [`MECANICAS.md`](MECANICAS.md), [`FRONTEND.md`](FRONTEND.md).
> Fuente: leaderboard + "Activity Breakdown" por proyecto + página de cada proyecto
> (sección **Onchain**, ventana **30D**, "through yesterday"). Actualizado 2026-07-13.

---

## 🔴 Foto VIVA — Onchain últimos 30 días (de la página de cada proyecto)

Cada proyecto en talent.app muestra sus métricas onchain de 7D/30D/90D/1Y. Esta es la
comparación **actual** (no la de junio). Es la que importa para la campaña de julio.

| # | Proyecto | Transacciones 30D | DAU/wallets 30D | Gas Fees 30D | Repo GitHub |
|---|---|---|---|---|---|
| 1 | Tycoon | 29K (+939%) | 4K | 399.82 CELO | SaboStudios/Tycoon · aji70/Tycoon |
| 2 | PlayChessify | 4K (+12%) | 2K | 80.08 CELO | jadonamite/playchessify |
| 3 | Action-order | 2K (−47%) | 709 | 15.54 CELO | Calebux/CELO-cards |
| 4 | GameArena | 2K (−48%) | **228** | 42.72 CELO | HACK3R-CRYPTO/Gamerstew |
| 5 | **Chessciito** | **68** (−16%) | **25** | 0.39 CELO | akawolfcito/chesscito |
| 6 | Zorrito | 5K (−34%) | 5K | 301.39 CELO | artugrande/zorritoclaude |
| 7 | **Gambit** | **70** (+84%) | **27** | 3.31 CELO | Spagero763/gambit |
| 8 | chessxu | 7K (−65%) | 6K | 150.83 CELO · STX | morelucks/chessxu |
| 9 | Abapay | 5K (+943%) | 2K | 22.31 CELO | investorphem/AbaPay |
| — | 🟣 **Frontle (live)** | **147** | **58** | **1.56 CELO** | davidndeah/frontle |

> **El giro clave:** Frontle (147 tx / 58 wallets) tiene **MÁS actividad onchain que
> #5 Chessciito (68/25) y #7 Gambit (70/27)** — y comparable o mejor que #4 GameArena
> (228 DAU). Sin embargo Frontle está **#14 (vivo)** y ellos en el Top 10. La brecha
> **NO es de traction onchain** → es **revisión humana de calidad + actividad de GitHub**.
>
> Esto confirma la hipótesis: el mes pasado la revisión humana subió el score de Frontle.
> Chessciito y Gambit son productos MUY pulidos (educación MiniPay-first; arcade con
> WeeklyCup) → ganan en la revisión de calidad y en commits, no en volumen.
>
> **Objetivo realista y ALCANZABLE:** cerrar cerca del Top 10. La palanca no es igualar
> los 5K tx de Tycoon/Zorrito/chessxu (imposible en 2 semanas) sino **ganar donde ganan
> Chessciito/Gambit: calidad de producto + commits diarios + Celo commits bien atribuidos**,
> manteniendo el onchain creciendo (ya vamos por encima de 2 del Top 10).
>
> ⚠️ **Alerta de tendencia:** Frontle viene **cayendo** (top 11 → 13 → 14 en días recientes).
> El score algorítmico (onchain+github vivo) se está quedando atrás mientras otros suman
> a diario. Hay que frenar eso YA con commits diarios + más tx, y confiar en que la
> revisión humana de fin de mes reconozca la calidad (como pasó en junio).

### Data Sources de Frontle (ya configurados ✅)
Contrato v2 `0xadca…f2bebe` · v1 `0x7ea1…b2fa09` · repo `davidndeah/frontle` (público).
Los tres están enlazados en la página del proyecto. *(Ver nota sobre "Celo Commits = 0"
abajo: aunque el repo está enlazado ahora, en junio no atribuyó commits de Celo — verificar
que en julio sí los cuente.)*

---

## Fórmula de scoring OFICIAL (del modal "How do I rank?" de Talent)

El ranking = **impacto + actividad** en la ventana de campaña. Componentes exactos:

**GitHub:** `Total commits` · `Celo commits` · `Commits to other repositories` · `Active days`
**Onchain:** `Unique wallets` · `Transactions` · `Fees` · `Excluded contracts` · `cUSD volume`
**Booster:** `MiniPay Integration Booster`
**Descalifican:** `No Public GitHub Repositories` · `No Celo Mainnet Contract`

> ⚠️ **NO aparece "descargas de npm"** como métrica. El roadmap la listaba como
> métrica directa de PoS — es incorrecto. El paquete npm ayuda como *commits/actividad
> de GitHub*, no como downloads. Publicarlo sigue valiendo (actividad + credibilidad),
> pero no mueve una métrica propia.

---

## Resultado Junio 2026 (final, pagado)

Frontle terminó **#10 → $250** (de **314 proyectos**). El Top 10 fue casi todo
"Gaming & Interactive": #1 Tycoon · #2 PlayChessify · #3 Action-order · #4 GameArena ·
#5 Chessciito · #6 Zorrito · #7 Gambit · #8 chessxu · #9 Abapay · **#10 Frontle**.

## Tabla comparativa (Junio, grantId=1289)

| Métrica | 🟣 **Frontle #10** | Abapay #9 | Tycoon #1 |
|---|---|---|---|
| Github: Celo Commits | **0** | 0 | 164 |
| Commits to Other Repos | 33 | 180 | 48 |
| Github: Total Commits | 33 | 180 | 212 |
| Github: Active Days | 3 | 7 | 16 |
| Onchain: Transactions | 36 | 611 | 240 |
| **Onchain: Unique Wallets** | **10** | 238 | 231 |
| Onchain: Fees (raw wei) | 300882094813271550 | 5251255922228295000 | 1404222498597518600 |
| Onchain: Fees (÷1e18) | ~0.30 | ~5.25 | ~1.40 |

## Links de proyecto (talent.app `/~/projects/<id>`) — para llegar a repos

| # | Proyecto | Project ID |
|---|---|---|
| 1 | Tycoon | `2aac332e-7b51-44f1-b18f-33ae86929bde` |
| 2 | PlayChessify | `33939a71-4802-4601-b254-998bb3be0249` |
| 3 | Action-order | `f3c81122-6c78-4dcf-9644-ee6771f92070` |
| 4 | GameArena | `b9cb38a3-b542-43f0-8da0-3aca3d15c677` |
| 5 | Chessciito | `e850a453-2b0c-4080-a070-781d712791a7` |
| 6 | Zorrito | `e77b0eed-fd21-4a70-be2a-b73e2a4358dd` |
| 7 | Gambit | `8cf96395-1abc-41b3-bc3f-f061cc97691c` |
| 8 | chessxu | `07610fca-f702-457a-ae04-5ca46d41aefc` |
| 9 | Abapay | `7cfda667-281d-476f-80a3-1e2ba5b933af` |
| 10 | **Frontle** | `2db5479e-ac79-4949-ac0e-c26fecf7803e` |

---

## Los 2 hallazgos que cambian el plan

### 1. 🟠 instrumentación: `Celo Commits = 0` para Frontle
Los 33 commits de Frontle cayeron TODOS en "Commits to other repositories" y **0 en
"Celo Commits"**. Tycoon (#1) tiene **164 Celo commits**. Talent no reconoce el repo de
Frontle como repo "de Celo" → perdemos la métrica de GitHub más valiosa.
- **Causa probable:** el data source del proyecto en talent.app no apunta bien al repo
  monorepo / no detecta el contrato-Celo dentro del path (Celopedia: *"si contribuyes a
  un monorepo, incluye la ruta directa al MiniPay Hook en los Data Sources"*).
- **Acción:** revisar/arreglar los Data Sources del proyecto en talent.app (repo correcto
  + ruta del hook MiniPay + contrato v2). Es la corrección de mayor ROI y no requiere código.
- **Matiz:** Abapay (#9) también tiene 0 Celo commits y aun así entró al Top 10 → se puede
  compensar con onchain, pero arreglar esto nos sube "gratis".

### 2. 🔴 traction: `Unique Wallets = 10` (el verdadero cuello de botella)
Todo el Top 10 tiene **200+ wallets únicas** (Tycoon 231, Abapay 238). Frontle: **10**.
Esta es LA brecha. El score onchain manda: Abapay llegó a #9 casi solo por traction
(611 tx, 238 wallets) pese a 0 Celo commits.
- **Acción #1 del mes:** conseguir **usuarios reales que hagan tx** (pistas/reintentos de
  pago). Pasar de 10 → 50+ wallets mueve el ranking más que cualquier feature.
- Sembrar pots con `fundPot` + "torneo diario" + push a amigos/comunidad/Telegram PoS.

### Contexto que juega a favor en Julio
- Frontle en **junio** tuvo solo **3 días activos / 33 commits**. En **julio** ya lleva
  ~11 días con commits y 100+ commits → la métrica de GitHub de julio será MUY superior
  sola. El foco debe ir a **wallets/tx** (donde seguimos en 10) y a **arreglar el data
  source** (Celo commits).

---

## Pendiente de confirmar
- **Dónde se trackea la campaña de Julio (1–27).** grantId=1289 es Junio (pagado). Hay que
  confirmar el grant activo de julio y que Frontle esté submitteado ahí con los data sources
  correctos. (En el panel "Your projects" Frontle aparece **#14** — posiblemente la posición
  viva de julio, fuera del Top 10 todavía.)
