# Revisión de Arcadia (greyw0rks) — hallazgos

> **Fecha:** 2026-07-25
> **Repos revisados:** `github.com/greyw0rks/Arcadia`, `Arcadia-backend`, `Arcadia-frontend`
> **Motivo:** buscar código/ideas reutilizables para un nuevo modo de juego en Frontle.

## Qué es Arcadia

Un "arcade" de Next.js con staking de casa (house treasury) en **dos chains** (Celo + Stacks):
varios mini-juegos de trivia/opción múltiple bajo un mismo motor. `Arcadia` y `Arcadia-frontend`
son el mismo código que `Arcadia-backend` desplegado con `BACKEND_URL` distinto (front puro vs.
API con estado).

Mini-juegos que corren sobre un motor compartido de opción múltiple (`server/games/choiceGame.ts`):
`capitals` (capital de un país), `geo` / **GeoGuess** (foto → adivinar el lugar), `landmark` (foto →
nombrar el monumento), `logo`, `movie`, `oddoneout`, `riddles`, `trivia`, `truefalse`, `color`, `math`,
`word`. Cada uno es un banco de preguntas (`data/*.json`) + una función `build(roundIndex)`; el motor
compartido resuelve el shuffle con semilla, el no-repetir-dentro-de-sesión, y los tiers de dificultad.

## ⚠️ Bloqueo legal — no se puede reutilizar nada textual

`Arcadia-backend/LICENSE` es una **licencia propietaria, todos los derechos reservados**
(`Arcadia`/`Arcadia-frontend` la referencian igual en su `package.json`: `"license": "SEE LICENSE IN LICENSE"`).
Cláusulas relevantes, citadas:

> "Copying, reproducing, or cloning the Software in whole or in part for any purpose, commercial or otherwise."
> — prohibido, sin excepción de "solo la idea general".

> "Using the game mechanics, multiplier system, session architecture, question banks, difficulty
> engine, or any other distinctive element of Arcadia **to build a competing product**."
> — Frontle es del mismo género (trivia/arcade de geografía con pagos), así que aplicaría directo.

> "Scraping, extracting, or bulk-downloading the question banks, game data, or any other content
> served by the platform." — nada de copiar `data/geo.json`, `data/capitals.json`, `data/landmarks.json`.

El texto además advierte explícitamente sobre acción legal por infracción.

**Decisión:** cero código, cero datos, cero "elementos distintivos" (el motor de tiers, el sistema
de multiplicador, la arquitectura de sesión) de Arcadia entran a Frontle. Lo único que no es
protegible por copyright es la **idea general** de un formato (quiz de opción múltiple con foto) —
y solo eso puede inspirar un diseño propio, construido desde cero.

## Qué sí es aprovechable como idea (no como código)

El modo **GeoGuess** de Arcadia (foto de un lugar → 4 opciones de dónde queda) encaja
temáticamente con Frontle mejor que cualquiera de sus otros mini-juegos, porque Frontle ya es
un juego de geografía. Ver [PLAN-MODO-GEOFOTO.md](../PLAN-MODO-GEOFOTO.md) para el diseño propio,
construido sin tocar nada de Arcadia.
