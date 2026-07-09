# 🤝 Handoff — Terminar el "Modo Regiones" (para el agente de Claude de Santiago)

> **Cómo usar este archivo:** pégalo (o su ruta) como contexto en tu sesión de Claude Code, dentro del repo `frontle`. Es un prompt autocontenido con lo hecho, los archivos que ya existen y el paso a paso de lo que falta. David dejó el 60% listo; falta la integración de UI y el ranking.

---

## 🎯 Objetivo

**"Frontle Regions — Ambassadors Edition"**: un nuevo modo donde conectas subdivisiones (departamentos/estados) en vez de países. Es **gratis** (sin pot on-chain), reto diario por región, con su propio ranking. Celebra a los embajadores de Celo (cada país = regalo a su comunidad) y responde al feedback del equipo de MiniPay ("routes between states, provinces and counties as additional levels").

Países meta del lanzamiento (embajadores del tweet de Celo): 🇨🇴 Colombia, 🇺🇸 USA, 🇳🇬 Nigeria, 🇬🇭 Ghana, 🇦🇷 Argentina, 🇧🇷 Brasil (Indonesia = "coming soon", es archipiélago).

---

## ✅ Lo que YA está hecho y mergeado a `main` (PRs #1–#4)

Todo bajo `frontend/app/lib/regions/` y `frontend/public/`. **Reutiliza el motor del juego mundial** — misma semántica de semáforo, victoria y pistas.

| Archivo | Qué exporta / contiene |
|---|---|
| `app/lib/regions/types.ts` | `RegionDef`, `RegionEntity` |
| `app/lib/regions/colombia.ts` | `COLOMBIA` — 32 entidades (31 deptos + Bogotá D.C.), 74 fronteras. **Validado** (simetría + conectividad) |
| `app/lib/regions/usa.ts` | `USA` — 48 estados contiguos, 105 fronteras, aliases en español |
| `app/lib/regions/index.ts` | `REGIONS`, `REGION_IDS`, `regionGraph(id)`, `resolveRegionEntity(id, input)`, `suggestRegionEntities(id, input)`, `normalizeName()` |
| `app/lib/regionGame.ts` | **El motor.** `dailyRegionChallenge(regionId, seed?)`, `randomRegionChallenge(id)`, `tryRegionGuess(state, raw, entity)`, `regionQuality`, `nextRegionHint`, `regionShortestPath`, tipos `RegionChallenge`/`RegionPlayState`/`RegionGuessResult`/`RegionChainItem` |
| `public/maps/co.json`, `public/maps/us.json` | GeoJSON de las subdivisiones. `properties.name` = nombre canónico exacto del grafo; `properties.code` = slug |
| `public/flags/{co,us}/<code>.png` | Banderas reales de cada subdivisión (Wikidata P41) |
| `gen-region-maps.mjs`, `gen-region-flags.mjs` | Generadores (se corren una vez; los outputs van commiteados) |

**Retos de ejemplo (deterministas):** hoy → co: `Antioquia → Guainía` (óptimo 3) · us: `Kansas → Washington` (3).

### ⚠️ Detalle pendiente de las banderas de Colombia
`public/flags/co/` tiene **30/32** (a `gen-region-flags.mjs` lo interrumpieron por rate-limit de Wikimedia). Para completar: `cd frontend && node gen-region-flags.mjs` (tiene **resume** — solo baja las que faltan; y **backoff** para el 429). Faltan ~Bogotá y 1 más.

---

## 🔨 Lo que FALTA (tu trabajo) — en PRs pequeños para la cadencia de Talent

> Regla de oro: **commits pequeños y diarios + PRs** (los PRs cuentan como stat en Talent/Proof of Ship). Haz `git pull` antes de cada push (David y tú chocan seguido en `page.tsx`).

### PR #5 — Componente `RegionMap` (autocontenido, sin tocar `page.tsx`)
Clona `app/components/WorldMap.tsx` a `app/components/RegionMap.tsx`, pero:
- Carga el GeoJSON local (`/maps/${regionId}.json`) en vez del world-atlas.
- `fitExtent` a las entidades del reto (origen+destino) igual que hoy.
- Mantén el **graticule**, el glow del semáforo, el pan/zoom y los botones. Mismos colores (`COLORS` por `Status`).
- Props: `{ regionId, statusByEntity, silhouettes, showAllOutlines, resetKey }`.
- Verifícalo con un preview aislado (Playwright screenshot) antes de integrar.

### PR #6 — Chip regional + i18n del modo
- `RegionChip` (o extiende el `CountryChip`): usa `<img src={/flags/${regionId}/${code}.png}>`; si 404, cae a marcador con inicial + color del semáforo.
- Añade claves i18n del modo en `app/lib/i18n.ts` (es/en/fr/pt): título del modo, nombre de subdivisiones, coach del modo. (Santiago es dueño de i18n — hazlo aquí para no dejar strings sueltos.)

### PR #7 — Integración en el flujo `Jugar` (la PR grande de `page.tsx`)
El Home ya tiene el **selector de modos en pasos**: `jugarStep: "modes" | "level" | "reto"`. Hoy la card "Reto diario" lleva al flujo mundial y hay una card **"Nuevos modos · coming soon"** (búscala en `page.tsx`, sección `jugarStep === "modes"`).
- Convierte esa card en un submenú de regiones: 🇨🇴 Colombia · 🇺🇸 USA · … con la bandera emoji del país.
- Al elegir región → estado paralelo al mundial pero con `regionGame.ts`:
  - `regionState: RegionPlayState`, `dailyRegionChallenge(regionId)`
  - `tryRegionGuess` en el submit; el resto (cronómetro, chips, pistas gratis con `nextRegionHint`, WinCard, SFX) **se reutiliza**.
- Persistencia por (día, región): claves `frontle-region-${day}-${regionId}` (juego) y `-best-`.
- **Modo gratis:** oculta el pot/premios/reintento-pago en este modo. Sí muestra cronómetro, estrellas y compartir.
- Reusa `Coachmarks`, `sfx.ts`, el header, el bottom-nav.

### PR #8 — Ranking regional (backend)
- Migración Supabase `00XX_scores_add_mode.sql`: `alter table scores add column mode text default 'world'` (valores: `world`, `region:co`, `region:us`, …). El front manda `mode`; `getRanking(day, level, mode)` filtra por él.
- Reusa TODO el `RankingCard`. El tab Ranking necesita un selector de modo/región (además del de nivel del modo mundial — en regiones puede no haber niveles, decide: reto único por región).
- **Ojo:** el modo regional NO usa el contrato (es gratis). No toques `payments.ts` ni `close-day`.

### PR #9+ — Escalar a los 6 embajadores (rápido, ~40 min c/u)
**NO escribas las adyacencias a mano.** Deriva del GeoJSON: dos subdivisiones son vecinas si sus polígonos comparten ≥2 vértices (o un segmento). Pasos por país:
1. Baja el ADM1 GeoJSON (geoBoundaries: `https://www.geoboundaries.org/api/current/gbOpen/<ISO3>/ADM1/`).
2. Script que calcula adyacencias por geometría compartida → genera `regions/<pais>.ts`.
3. **Valida** con el mismo criterio que CO/US (simetría + conectividad — hay un script de referencia; David lo corrió en `validate_regions.py`, recréalo).
4. Mapa (`gen-region-maps.mjs`, añade la fuente) + banderas (`gen-region-flags.mjs`, añade el Q-id del país: Nigeria Q1033, Ghana Q117, Argentina Q414, Brasil Q155).
5. Registra en `regions/index.ts`.
- Islas/sea-links (Argentina→Tierra del Fuego, etc.): añade el par al grafo a mano como hicimos con Gibraltar en el mundo.
- **Indonesia**: déjala como "coming soon" en la UI (archipiélago, requiere ferris curados).

---

## 🎬 Cierre del update (cuando el modo funcione)
- **Video** (~40s): reusa el pipeline `build-video.mjs` + `frontle_score.wav`. Estética Violeta Prisma + Bordy. Secuencia: hook → recap de features nuevos → **el mapa muta país por país con el handle del embajador en pantalla** → CTA + QR.
- **Tweet**: quote al tweet de embajadores de Celo, taggeando @Celo @CeloDevs @camilosaka @defimessiah1 @godza256 @ArtuGrande @benibauer3 @africanbuilder_ @SZapelao @ezema_precious. Ángulo: *"You gave us communities. We built them worlds."*

---

## 📚 Contexto estratégico (léelo antes de priorizar)
- `docs/ROADMAP.md` — reglas y **métricas exactas de Proof of Ship S2** (tx, usuarios únicos, días con commits, NPM), feedback de MiniPay, y el plan jul–sept. **Season 2 cierra 31 jul; tracking hasta 27 jul.**
- `docs/benchmark/FRONTEND.md` — qué hace bonito a los 8 proyectos del top 10 (estética, mascota, onboarding, motion).
- `docs/benchmark/MECANICAS.md` — su gamificación y contratos (streaks, WeeklyCup, reclaim, referidos, agente ERC-8004).
- `docs/design/DESIGN-SYSTEM.md` — tokens Violeta Prisma, componentes, reglas de copy MiniPay.

## 🧰 Comandos
```bash
cd frontend
npx tsc --noEmit -p tsconfig.json   # typecheck (mantenlo en 0)
npm run build                        # build de prod
node gen-region-flags.mjs            # completar banderas faltantes (resume)
```
