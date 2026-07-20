# Feature: Niveles de dificultad + pot repartido (handoff)

> Documento para continuar el desarrollo en otra sesión. Estado a **2026-07-04**.

## Qué es

Frontle pasa de **un reto/día con un ganador** a **3 retos/día por dificultad**
(fácil / medio / difícil), cada uno con su **ranking**, y el pot diario on-chain
se **reparte entre los 3 ganadores de nivel** (antes iba 100% a uno solo).

Contexto: ya no es hackathon; competimos en **Proof of Ship** (top 10). El
objetivo es sostener/subir usuarios + transacciones + cadencia de shipping.

## Decisiones confirmadas por el usuario

1. **Dificultad por rareza/fama.** 3 retos independientes/día. Fácil = países
   muy reconocidos (set curado); medio/difícil = el resto partido por
   conectividad (más conectado → medio, más aislado → difícil).
2. **El pot funciona igual que hoy** (fees → 20% protocolo / 80% pot; la
   plataforma puede sembrar con `fundPot`). Lo único que cambia es el **reparto**.
3. **Tabla de reparto del pot del día** (cubre los 8 casos):

   | Ganadores presentes | Difícil | Medio | Fácil |
   |---|---|---|---|
   | Difícil + Medio + Fácil | 50% | 35% | 15% |
   | Falta Fácil (15% sube a Medio) | 50% | 50% | — |
   | Falta Medio (35% sube a Difícil) | 85% | — | 15% |
   | Falta Difícil (regla del equipo) | — | 75% | 25% |
   | Solo un nivel con ganador | 100% a ese |||
   | Nadie | pot queda sin repartir → `recoverUnrolledPot` (owner) |||

   Regla general de "nivel vacío": su parte **sube al nivel inmediato más
   difícil** que sí tenga ganador (falta fácil→medio, falta medio→difícil);
   el caso "falta difícil" usa la regla especial 75/25.

## Riesgo de cumplimiento (recordatorio)

Repartir dinero de jugadores hacia ganadores puede considerarse **apuesta** y
MiniPay lo restringe. Mitigación: enmarcar como **torneo con premio base
sembrado** por la plataforma (`fundPot`). Ver memoria `frontle-economy-model-decision`.

---

## ✅ HECHO

### 1. Contrato v2 — `contracts/src/FrontleGame.sol`
- El pot por día se mantiene; cambia el modelo de ganador único a **3 niveles**.
- **Niveles (uint8):** `LEVEL_EASY=0`, `LEVEL_MEDIUM=1`, `LEVEL_HARD=2`.
- **`rollDay(day, hardWinner, medWinner, easyWinner)`** (`onlyOperator`):
  `address(0)` = nivel sin ganador. El contrato calcula los montos con
  `_computeShares` (la tabla de arriba) desde `pot[day]` → el operador solo
  aporta las 3 direcciones, no puede manipular montos. Revierte `NoWinners` si
  las 3 son cero.
- **`claim(day, level)`** — cada ganador cobra su parte.
- **`recoverUnrolledPot(day, to)`** (`onlyOwner`) — días sin ganador: recupera
  el premio base sembrado y bloquea reclamos posteriores.
- Storage nuevo: `winnerOf[day][level]`, `prize[day][level]`, `claimed[day][level]`,
  `rolled[day]`. `pot`, `fundPot`, `_collect`, pagos y admin **sin cambios**.
- Constructor **sin cambios** → `contracts/script/Deploy.s.sol` sirve tal cual.
- **Tests:** `contracts/test/FrontleGame.t.sol` — **45 tests, todos verdes**
  (un test por fila de la tabla + reverts + 2 fuzz de conservación del pot).
  Correr: `cd contracts && forge test`.

### 2. Juego — `frontend/app/lib/game.ts`
- Tipo `Difficulty = "easy" | "medium" | "hard"`, `DIFFICULTIES`.
- `DailyChallenge` ahora incluye `level`.
- **Fama = set curado `FAMOUS_ANCHORS`** (fácil); el resto se parte por grado
  del grafo (mitad superior → medio, inferior → difícil). Reparto actual:
  **easy 66 / medium 44 / hard 43**.
- **`dailyChallenge(seed, level)`** genera el reto del nivel desde su pool con
  semilla mezclada por nivel (`seedForLevel`). 4 capas de fallback → siempre
  devuelve un reto conectable. Banda de intermedios 2–7.
- **`dailyChallenges(seed)`** → los 3 retos del día. `tierOf(name)` para depurar.
- `randomChallenge(level)` acepta nivel.

### 3. Ranking — `frontend/app/lib/ranking.ts` + Supabase
- Migración **`add_level_to_scores` aplicada a producción** (proyecto
  `vrpaesidjdgmkicwlebi`): `scores.level text NOT NULL DEFAULT 'medium'` con
  check `IN ('easy','medium','hard')` + índice `scores_day_level_rank_idx`
  sobre `(day, level, countries, time_ms)`. Las 34 filas viejas quedaron `medium`.
- `ScoreEntry.level?: Difficulty` (si falta → `medium`).
- `submitScore` envía `level`; localStorage separado por nivel
  (`frontle-ranking-${day}-${level}`).
- `getRanking(day, level = "medium", limit)` filtra por `&level=eq.${level}`.

### 4. UI — `frontend/app/page.tsx` + `frontend/app/lib/i18n.ts`
- i18n: `levels {easy,medium,hard}` + `chooseLevel` en los 4 idiomas.
- Estado `level` (default `easy`). Componente **`LevelSelect`** (segmentado).
- **Cargador único** `useEffect([day, level])`: reto + partida guardada + mejor
  marca + ranking del nivel. **Persistencia por nivel**: `frontle-game-${day}-${level}`,
  `frontle-best-${day}-${level}`.
- `pushScore` envía y recarga con `level`. `RankingCard` muestra el nivel activo.
- **Verificado:** `npx tsc --noEmit` limpio y `npm run build` OK. (Los avisos de
  lint restantes son preexistentes: `Date.now`/`setState-en-efecto`.)

### 5. Pagos — `frontend/app/lib/payments.ts` ✅ (código listo; falta swap de dirección)
- `gameAbi` ya es la del v2: `claim(day, level)`, `winnerOf(day,level)`,
  `prize(day,level)`, `claimed(day,level)`. `pot`/`currentDay`/`rolled(day)` siguen.
- `getClaimablePrizes(entries, addr)` va **por (día, nivel)**: lee
  `winnerOf(day,level)==yo && rolled(day) && !claimed(day,level)` y devuelve
  `prize(day,level)` (no el pot entero). `claimPrize(day, level)`.
- `ClaimablePrize` / nuevo `ClaimableEntry` llevan `level`. Mapeo
  `LEVEL_INDEX {easy:0, medium:1, hard:2}` (= constantes del contrato).
- ⚠️ **Único pendiente:** cambiar `GAME_ADDRESS` a la dirección del v2 al desplegar
  (marcado con `TODO(v2)` en el archivo).

### 6. `winners` (Supabase) + Edge Function `close-day` ✅ (código listo; falta aplicar en prod)
- **Frontend hecho:** `getMyWinDays` (ranking.ts) devuelve `{day, level}[]`;
  `page.tsx` (`loadPrizes`/`handleClaim`/`PrizesCard`) opera por (día, nivel)
  (estado `claimingKey = "${day}-${level}"`, cada premio muestra su nivel).
- **`close-day` reescrita:** calcula el top de los 3 rankings (`scores` por
  `day` + `level`), firma `rollDay(day, hard, med, easy)` con `address(0)` para
  niveles sin ganador, e inserta 1 fila/nivel en `winners`. Sigue idempotente y
  respeta los dos formatos de día (`scores.day`=YYYYMMDD, contrato/`winners`=días
  UTC). Ver memoria `frontle-close-day-oracle`.
- **Migración escrita** en `supabase/migrations/0003_winners_add_level.sql`:
  añade `level` (default `medium`, check easy/medium/hard) y PK compuesta
  `(day, level)`. Las 6 filas viejas quedan `medium`. **Aún NO aplicada a prod.**
- ⚠️ **Pendientes de deploy** (van juntos con el v2, el nuevo `close-day` firma la
  firma nueva de `rollDay` que solo existe en v2):
  1. Aplicar la migración `0003` (`apply_migration` o `supabase db push`).
  2. Redeploy de la Edge Function `close-day` + set `GAME_ADDRESS` = v2 en secrets.

### 7. Deploy y Proof of Ship (lo hace el usuario, con llaves reales)
- `forge script script/Deploy.s.sol --rpc-url celo --account <deployer> --broadcast`
  (constructor: token USDT, operator, attemptFee, protocolBps). Reconfigurar
  `setHintFee` post-deploy (el Deploy script ya lo hace).
- **Agregar la dirección del v2 como data source** en talent.app (el proyecto
  trackea métricas por contrato; dejar también el viejo para conservar historial).
- Sembrar premio base con `fundPot` si se enmarca como torneo (compliance).

---

## Direcciones y datos clave

- **Contrato v2 (mainnet, NIVELES) — desplegado 2026-07-05:**
  `0xaDcA9A707F394509C8aA906B89B93cb222f2BeBE` — ya cableado en `payments.ts`.
  Deploy tx `0x91ab87910d56f319a1a029afa7b5825a6634288208b90156fb9126e99a24725a`.
- **Contrato viejo (mainnet, ganador único, v1):**
  `0x7Ea1EEB96Caf0b07E47354c349b8FdFC75B2Fa09` — se deja como data source histórica.
- **FrontleWeekly (mainnet, pot semanal de la liga v2) — desplegado 2026-07-20:**
  `0x766A12333AA5249CDEf2259Cc9D3aD0c746c8132` — verificado en Celoscan.
  Deploy tx `0xce5691b24ad31e5ac33bc5d7083df7995bba9bbfc0120d011668537eeb7492d2`
  (bloque 72674170). Parámetros: minPurchase `100000` (0.10 USDT), protocolBps
  `1000` (10%, topado por `MAX_PROTOCOL_BPS`). Reparte 50/30/10 al podio semanal.
  ⚠️ Su índice de semana (`currentWeek()`, lunes a lunes) NO es el `week_start`
  de Supabase: ver `supabase/functions/close-week`.
- **Token USDT (6 dec):** `0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e`
- **feeCurrency (adapter USDT):** `0x0e2a3e05bc9a16f5292a6170456a710cb89c6f72`
- **Operator (firma `rollDay`, necesita CELO para gas):**
  `0x54E83C8D7B7A77cbf0a2842c1a82d51be8814DD0`
- **Chain:** Celo Mainnet `42220`.
- **Supabase project:** `vrpaesidjdgmkicwlebi`.
- **talent.app (Proof of Ship):** proyecto `2db5479e-ac79-4949-ac0e-c26fecf7803e`.

## Orden sugerido para retomar

1. ✅ v2 desplegado a mainnet (`0xaDcA9A70…f2BeBE`, 2026-07-05).
2. ✅ `payments.ts` → `GAME_ADDRESS` = v2.
3. ✅ Migración `winners (day, level)` aplicada a prod (`apply_migration winners_add_level`).
4. ✅ Edge Function `close-day` v2 desplegada (version 6).
   ⏳ **FALTA (manual, usuario):** actualizar el secret `GAME_ADDRESS` = v2 en Supabase
      (`supabase secrets set GAME_ADDRESS=0xaDcA9A707F394509C8aA906B89B93cb222f2BeBE
      --project-ref vrpaesidjdgmkicwlebi`, o por el dashboard). `OPERATOR_PRIVATE_KEY`
      ya está seteado desde el v1.
5. ⏳ Publicar el frontend nuevo (Vercel) para que las tx caigan en el v2.
6. ⏳ Probar reclamo por nivel en MiniPay (dispositivo físico + ngrok).
7. ⏳ Agregar v2 como data source en talent.app (dejar el v1 por historial).

## Comandos

```bash
# Contrato
cd contracts && forge test
# Frontend
cd frontend && npx tsc --noEmit -p tsconfig.json && npm run build
```
