# PLAN — Copa Frontle Semanal: unificar modos, puntos y pot

> **Doble propósito:** (a) plan de producto para unificar la gamificación bajo un pot
> semanal, y (b) **input para generar la presentación/pitch de "lo que se viene"** —
> la sección §8 trae el design de la app para que las slides salgan con la identidad real.
> Continúa el estilo de los `PLAN-*` del repo. Fuentes: `docs/benchmark/MECANICAS.md`,
> `NIVELES.md`, memoria de decisiones económicas, y la skill celopedia
> (`references/minipay-requirements.md`, patrones de growth).

---

## 1. Frontle en una frase

**El Wordle de geografía en MiniPay: conecta países por sus fronteras y compite
cada día por un premio real en stablecoins sobre Celo.**

- Live en Celo Mainnet con usuarios y dinero real · Top 10 de Proof of Ship
- Contrato v2 verificado (niveles + pot repartido) · Supabase como backend · 4 idiomas
- Preparando el listing de descubrimiento de MiniPay (16M+ wallets)

## 2. Lo que ya construimos (estado real de main)

### Modos de juego

| Modo | Costo | Pot | Puntos Frontle |
|---|---|---|---|
| **Reto diario** — 3 niveles (fácil/medio/difícil), mismo reto para todos | Gratis el 1er intento; pistas y reintentos en USDT | ✅ on-chain, split 50/35/15 por nivel | ✅ |
| **Regiones** — subdivisiones de un país (nuevo) | Gratis | ❌ | ❌ |
| **Quiz de banderas** (nuevo) | Gratis | ❌ | ❌ |
| **Quiz de contornos** (nuevo) | Gratis | ❌ | ❌ |
| **Práctica** — retos aleatorios infinitos | Gratis | ❌ | ❌ |

### Capa de gamificación (mergeada 2026-07-16, 10 PRs)

- ⭐ **Estrellas por precisión** (1–3 según distancia a la ruta óptima) con reveal animado
- 🔥 **Racha de días** con celebración de hitos (3 y 7) y contador en el tab Perfil
- 🏅 **Grid de logros** desbloqueables en Perfil ("Ruta óptima", "Sin pistas", "Conecta 2 continentes"…)
- 🎊 **Confeti prisma** al ganar con ruta óptima
- 💎 **Puntos Frontle** persistentes (Supabase, migración 0007) — hoy solo los emite el diario
- 🎁 **Welcome bonus** de 0.10 USDT (faucet por correo) para jugar sin depositar
- 🤖 **Bordy** — la mascota/tutor que guía el onboarding
- Bottom-nav "con vida": badges de reto pendiente, pop del tab activo, iconos SVG propios

### Economía actual

- Pagos (pistas/reintentos) en USDT → **80% al pot del día, 20% al protocolo**
- Pot diario repartido entre los ganadores de los 3 niveles (50/35/15, con reglas de
  nivel vacío); la plataforma puede sembrar con `fundPot`
- Comisión de red en stablecoin (CIP-64) — el usuario nunca ve CELO ni "gas"

## 3. El diagnóstico (por qué este plan)

Tenemos **cuatro modos nuevos que generan engagement pero viven desconectados de la
economía**: no emiten puntos, no alimentan ningún premio, no empujan a volver mañana.
Y el pot solo existe en el diario.

**La respuesta NO es un pot por modo** — eso fragmenta la liquidez (pots pequeños no
emocionan), multiplica el trabajo del oráculo de cierre y agrava el riesgo de lectura
como "apuesta" en el review de MiniPay. La respuesta es **una capa que unifique**:
el patrón que el benchmark del top 10 identificó como "el ciclo semanal por encima
del diario" (`WeeklyCup` de Gambit, ladders de GameArena, premio semanal de Zorrito).

## 4. Lo que se viene: la Copa Frontle Semanal

### La arquitectura en 4 piezas

1. **Los puntos Frontle se vuelven la moneda transversal.** Todos los modos emiten
   puntos: el diario los que ya da; Regiones/Quiz/Práctica una cantidad menor y **con
   tope diario** (ej. máx 30 pts/día de modos gratis) para que no se farmeen. La
   persistencia ya existe (migración 0007).
2. **Leaderboard semanal de puntos.** Cierra el domingo con la misma infraestructura
   de `close-day` (pg_cron + operador). Contrato: reutilizar el v2 con un weekId, o un
   `WeeklyCup` dedicado (calco del patrón Gambit).
3. **Pot semanal top-3 con split 50/30/20.** Más ganadores, menos parecido a apuesta,
   más retención (patrón Gambit documentado en el benchmark).
4. **Fondeo = premio sembrado.** El pot semanal se alimenta de una fracción del
   `protocolAccrued` de la semana + siembra de la plataforma via `fundPot`. Encuadre:
   **torneo con premio de la casa**, no redistribución de apuestas — la mitigación de
   cumplimiento ya documentada. Los jugadores gratis compiten sin haber pagado nunca,
   lo que refuerza ese encuadre.

### El puente cripto / no-cripto sale gratis de este diseño

Un jugador sin wallet acumula puntos jugando quizzes y regiones, sube en la copa, y
si queda top-3 **necesita wallet para cobrar**. Ese es el mejor momento de onboarding
que existe — *"ganaste dinero real, crea tu cuenta con tu correo"* — y Privy ya está
integrado exactamente para eso. Cobrar un premio convierte mejor que cualquier banner.

```
  Quizzes / Regiones / Práctica (gratis)      ← adquisición (no-cripto)
                 │  puntos
                 ▼
      Reto diario (gratis → pagos USDT)       ← monetización
                 │  puntos × racha
                 ▼
      COPA SEMANAL (pot top-3 sembrado)       ← retención + conversión a wallet
```

## 5. Qué aplicar para atraer jugadores (con referencias)

### Para no-cripto (adquisición y retención)

| Mecánica | Referencia | Por qué funciona |
|---|---|---|
| **Ligas semanales con divisiones** (ascenso/descenso) | Duolingo (cohortes de 30, Bronce→Diamante) | Compites contra tu nivel, no contra el #1 global; la cola larga no se desmotiva |
| **Streak freeze comprable con puntos** | Duolingo | Perder una racha de 15 días duele; protegerla da a los puntos un sink con valor emocional |
| **Tarjeta de resultado compartible** | Wordle (el grid de emojis fue TODO su growth); el roadmap de Gambit lo llama "the Wordle loop" | "🇧🇷→🇩🇪 en 4 países ⭐⭐⭐ 🔥12" + link = viralidad a costo cero |
| **Modos gratis como top-of-funnel** | GeoGuessr, Kahoot | El quiz casual trae al jugador casual; el competitivo lo retiene. Regiones/Quiz no necesitan pot propio: alimentan la copa |

### Para cripto-nativos

| Mecánica | Referencia | Por qué funciona |
|---|---|---|
| **Racha on-chain con multiplicador** (racha ≥7 → ×1.5 puntos en la copa) | Zorrito (streak on-chain, bonus al día 5) | Une la mecánica de retención más fuerte con la economía |
| **Duelo por código de sala** con wager opcional | Tycoon / Gambit (challenge links) | El modo viral de WhatsApp en los mercados MiniPay. 🔶 Requiere backend |
| **Transparencia verificable**: /stats público + dashboard Dune | GameArena, Gambit, Zorrito | Los cripto-nativos confían en lo que pueden auditar |
| **Anti-sybil con humano verificado** (1 entrada/humano en la copa) | Gambit WeeklyCup (GoodID), Self | Imprescindible antes de que puntos gratis muevan dinero real |

### Encuadre del premio (válvula de cumplimiento)

**PoolTogether / prize-linked savings** (y Zorrito en nuestra cohorte): el premio
sale del yield o de la casa, nunca del principal de los jugadores. Si MiniPay objeta
el modelo, la copa 100% sembrada por protocolo es la posición defendible: los fees
del diario son compras de producto (pistas), no entradas a un sorteo.

## 6. Roadmap por fases

| Fase | Qué | Costo/riesgo |
|---|---|---|
| **1 · Ya** | Puntos en Regiones/Quiz/Práctica con tope diario + tarjeta compartible | Frontend puro, 2 PRs pequeños |
| **2 · Siguiente** | Copa semanal v1 **off-chain**: leaderboard de puntos + premio sembrado pagado con el flujo de premios existente | Valida la mecánica sin tocar contrato |
| **3 · Después** | Contrato `WeeklyCup` (o v2 con weekId) + streak freeze + multiplicador de racha | Contrato pequeño, patrón probado |
| **4 · Con tracción** | Ligas con divisiones · duelos por sala 🔶 · verificación Self/GoodID para premios | Backend + integración identidad |

---

## 7. Mensajes para el pitch

**Pitch corto (≤140):**
> Frontle: el Wordle de geografía en MiniPay. Conecta países por sus fronteras y
> gana cada día — y ahora cada semana — un premio en stablecoins sobre Celo.

**La narrativa de "lo nuevo" en 3 actos:**
1. *"Frontle ya no es un reto: es un mundo"* — 5 modos: el diario con premio, regiones
   de tu país, quizzes de banderas y contornos, práctica infinita.
2. *"Todo lo que juegas, suma"* — cada modo da puntos Frontle; tu racha los multiplica.
3. *"La Copa Semanal"* — los puntos de la semana compiten por un pot real top-3.
   Juegas gratis, ganas de verdad, cobras con tu correo.

**Cifras para slides** (buscar los valores frescos en `/stats` y Blockscout antes de
presentar): jugadores DAU/MAU, retención D1/D7/D30, transacciones on-chain, pot
repartido acumulado, % de fallos de tx.

---

## 8. Design de la app (para generar las slides con la identidad real)

> Fuente: la paleta **"Violeta Prisma"** en producción (`frontend/app/globals.css` +
> `page.tsx`). El `docs/design/DESIGN-SYSTEM.md` v1 documenta tokens de una iteración
> anterior (fondo negro glass); **para material nuevo usar lo de esta sección**.
> Exploración de paletas alternativas en `docs/design/palette-variants.html` (EXP-1).

### 8.1 Paleta

| Token | Hex | Uso en slides |
|---|---|---|
| Fondo profundo | `#160833` | Fondo de slide |
| Superficie | `#1c0b3e` | Cards, paneles, bloques de contenido |
| Violeta marca | `#6c2bd9` | Elementos de marca, halos |
| Lavanda | `#b79ced` | Bordes (al 25–40%), texto de acento, títulos de sección |
| **Acento amarillo** | `#fcff52` | CTAs, highlights, el "botón Jugar" — usar con moderación |
| Texto | `#ffffff` / neutral-300/400 | Principal / secundario / metadatos |

**Semáforo del juego** (funcional, reconocible para quien ya jugó):
`#22d3ee` cyan = origen · `#e879f9` fucsia = destino · `#22c55e` verde = óptimo ·
`#eab308` amarillo = desvío · `#ef4444` rojo = lejos · `#fbbf24` ámbar = premio/pot.

**Gradiente prisma** (`cyan→verde→ámbar→fucsia`, ~100deg): SOLO para marca y
celebración — el logo "FRONTLE", el slide de cierre, el momento "Copa Semanal".
Nunca en UI/slides utilitarios. Esta regla es identidad, respetarla en las slides.

### 8.2 Tipografía y forma

- Marca "FRONTLE": display 900, tracking amplio, gradiente prisma
- Títulos: bold blanco · labels/metadatos: 10–11px uppercase tracking `0.18em` lavanda
- Números (pot, timer, ranking): **monoespaciada tabular** — los números son protagonistas
- Radios generosos (cards 16px, pills 20–24px), bordes `lavanda al 25%`, fondo violeta
- Layout móvil-primero: las capturas de la app van en marcos de teléfono a 360×640

### 8.3 Motivos visuales disponibles

- **Bordy** (mascota): `frontend/public/bordy-m2.webp` + burbujas de diálogo — humaniza
  los slides de onboarding/tutorial
- **Mapa mundial** con la cadena de países iluminada (el momento "aha" del juego)
- **Banderas emoji grandes** enfrentadas (🇨🇴 → 🇦🇷) — el formato "VS" del reto
- **Estrellas ⭐ y racha 🔥** — los iconos de la gamificación
- **Confeti prisma** — la celebración (reservar para el slide del pot/copa)

### 8.4 Tono y reglas de copy (obligatorias — requisito del listing MiniPay)

- Cercano, 2ª persona, cero jerga. Bordy puede narrar.
- **Decir:** "comisión de red" · "depositar/retirar" · "stablecoin / dólares digitales"
- **NUNCA decir:** "gas" · "onramp/offramp" · "cripto" · ni mostrar el token CELO
- Identidad = alias o bandera; nunca una dirección `0x…` como identificador principal
- Idiomas del mercado: es / en / pt / fr

### 8.5 Estructura sugerida de la presentación

1. **Portada** — logo prisma sobre `#160833`, pitch de una frase
2. **El juego hoy** — captura del reto + semáforo (qué es Frontle en 10 segundos)
3. **Tracción** — cifras de /stats en mono tabular sobre cards `#1c0b3e`
4. **El problema** — "5 modos, una sola economía conectada" (diagrama del funnel §4)
5. **Lo nuevo: los modos** — grid con Regiones/Quizzes/Práctica (capturas en marcos)
6. **Lo nuevo: puntos + racha** — "todo lo que juegas, suma" (⭐🔥💎)
7. **La Copa Semanal** — el slide estrella: gradiente prisma permitido, pot top-3,
   confeti — el único slide "de celebración"
8. **Cripto y no-cripto** — el puente: juega gratis → gana → cobra con tu correo
9. **Referencias/credibilidad** — Duolingo/Wordle/patrones de la cohorte top 10
10. **Roadmap** — las 4 fases de §6 como timeline
11. **Cierre** — logo prisma + link + QR (`frontend/public/qr.png`)

---

*v1 — 2026-07-18. Análisis y unificación por Fable sobre el estado real de main
(`c15d76f`). Fuente de mecánicas: `docs/benchmark/MECANICAS.md` · economía: `NIVELES.md`
· cumplimiento: `.agents/skills/celopedia-skill/references/minipay-requirements.md`.*
