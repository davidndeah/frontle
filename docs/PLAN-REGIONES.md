# PLAN — Añadir las regiones (países) que faltan

> Objetivo: escalar el modo Regiones de 2 países (Colombia, USA) a N países
> gastando **el mínimo de tokens**. Estrategia: el modelo caro (actual) hace
> **una sola vez** la parte compleja (tooling); el modelo barato (Fable)
> **repite** una receta trivial por país.

---

## 1. Por qué esta división ahorra tokens

El costo real de añadir un país está en dos cosas:

1. **Autoría del grafo de adyacencias** (qué subdivisión limita con cuál). Para
   Colombia/USA se hizo **a mano** (32 y 48 entidades con sus vecinos). Repetir
   eso a mano por país = miles de tokens y errores.
2. **El tooling** que automatiza lo anterior.

**Solución:** derivar la adyacencia **automáticamente desde la geometría** del
mapa (dos subdivisiones son vecinas si comparten frontera). Eso convierte cada
país nuevo en "correr un script + registrar + verificar" — trabajo repetitivo y
barato, ideal para Fable.

| Fase | Quién | Qué |
|------|-------|-----|
| **Paso 0 — tooling** (una vez) | **Modelo actual (caro)** | Construir `gen-region.mjs`: deriva adyacencia + emite datos + descarga banderas. Validar con 1 país piloto. |
| **Pasos 1..N — por país** | **Fable (barato)** | Añadir config, correr el script, registrar, verificar, commit. |

---

## 2. Estado actual (lo que YA existe)

- **Datos:** `frontend/app/lib/regions/{colombia,usa}.ts` (`RegionDef` con `entities[]`, cada una con `name`, `code`, `neighbors[]`, `aliases?`).
- **Registro:** `frontend/app/lib/regions/index.ts` → `REGIONS = { co, us }`. Añadir un país = 1 import + 1 línea aquí.
- **Tipos:** `frontend/app/lib/regions/types.ts` (`RegionEntity`, `RegionDef`).
- **Mapas:** `frontend/public/maps/{co,us}.json` (GeoJSON, `properties.name` = nombre canónico, `properties.code` = slug). Generados por `gen-region-maps.mjs`.
- **Banderas subdivisiones:** `frontend/public/flags/{co,us}/<code>.png`. Generadas por `gen-region-flags.mjs` (SPARQL Wikidata).
- **Banderas nacionales:** `frontend/public/flags/national/{co,us}.png` (flagcdn).
- **Render:** `RegionMap.tsx` (juego) y `RegionMapPreview.tsx` (selector) — usan `geoMercator` (no distorsiona). El selector en `page.tsx` (dropdown de país + mapa) **lista automáticamente cualquier país en `REGIONS`**, así que no hay que tocar la UI.

**Conclusión:** la UI y el render ya escalan solos. Solo falta **generar los datos** por país.

---

## 3. Paso 0 — Generador consolidado `gen-region.mjs` (modelo actual)

> **NOTA (ya construido y validado):** `gen-region.mjs` ya existe y se validó de
> punta a punta con **Argentina**. La fuente de datos es **Natural Earth 1:10m
> admin_1** (no geoBoundaries: éste tiene huecos — p.ej. le falta Entre Ríos en
> Argentina). NE se descarga una vez y se cachea en `_ne_admin1.geojson`
> (gitignored). El filtro por país es `properties.adm0_a3 === iso3`.

`frontend/gen-region.mjs`, dado un `id` de país en su config, hace **todo**:

1. **Descarga** el GeoJSON ADM1 (Natural Earth 10m, cacheado) y filtra por país.
2. **Deriva la adyacencia** desde la geometría:
   - Convertir el FeatureCollection a TopoJSON con `topojson-server` → `topology()` (construye arcos compartidos).
   - `topojson-client` → `neighbors(geometrías)` devuelve, por índice, las subdivisiones que comparten arco = vecinas. (Cae a heurística de vértices compartidos con tolerancia si hiciera falta.)
3. **Emite** `frontend/app/lib/regions/<id>.ts` (un `RegionDef` completo: `entities` con `name`/`code`/`neighbors`), y `frontend/public/maps/<id>.json`.
4. **Descarga banderas**: subdivisiones (reusar la lógica SPARQL de `gen-region-flags.mjs` con el `Qid` del país) → `public/flags/<id>/`, y la nacional (flagcdn con el `iso2`) → `public/flags/national/<id>.png`.
5. **Valida**: grafo simétrico + conexo (BFS); reporta subdivisiones sin vecinos (islas/exclaves a excluir).

**Config por país** (dentro del script o `region-config.json`):
```js
{
  id: "ar",              // slug corto (viaja al ranking)
  iso3: "ARG",           // geoBoundaries ADM1
  qid: "Q414",           // Wikidata (banderas subdivisiones)
  iso2: "ar",            // flagcdn (bandera nacional)
  title: "Argentina",    // etiqueta UI
  entityNoun: "provincias",
  excludeIslands: true,  // descarta subdivisiones sin frontera terrestre
}
```

Dependencias: `topojson-client` ya está; añadir `topojson-server` si falta
(`npm i -D topojson-server`).

**Validar el Paso 0 con 1 país piloto** (recomendado: **Argentina**, provincias
limpias y contiguas) de punta a punta antes de entregar a Fable.

---

## 4. Receta por país (Fable — repetir y barato)

Para cada país nuevo:

1. Añadir su fila a la config de `gen-region.mjs` (ver tabla §5).
2. `node gen-region.mjs <id>` (desde `frontend/`).
3. Registrar en `frontend/app/lib/regions/index.ts`: `import { XXX } from "./<id>"` + añadir `<id>: XXX` a `REGIONS`.
4. Abrir el `<id>.ts` generado y revisar SOLO: nombres raros del dataset, islas que quedaron sin vecinos, adyacencias obviamente falsas (ver §6). Ajustes mínimos a mano si hace falta.
5. `npx tsc --noEmit -p tsconfig.json` (0 errores) + levantar la app y ver el mapa en el selector.
6. **Commit pequeño por país** (mantener la cadencia alta de commits/PRs para Proof of Ship).

No hay que tocar `page.tsx` ni la UI: el selector ya itera sobre `REGIONS`.

---

## 5. Países objetivo (config pre-rellenada)

Prioridad: **países de los embajadores de Celo** (para el video celebratorio y
el tag en X). Cada país necesita 3 datos: geoBoundaries ISO3, Wikidata Qid,
flagcdn ISO2.

| id | País | iso3 | Qid | iso2 | entityNoun |
|----|------|------|-----|------|------------|
| ng | Nigeria | NGA | Q1033 | ng | estados |
| gh | Ghana | GHA | Q117 | gh | regiones |
| ar | Argentina | ARG | Q414 | ar | provincias |
| br | Brasil | BRA | Q155 | br | estados |

Ampliables igual (buscar iso3/Qid/iso2): Alemania (DEU/Q183/de), España
(ESP/Q29/es), Austria (AUT/Q40/at), Bulgaria (BGR/Q219/bg), China (CHN/Q148/cn),
México (MEX/Q96/mx), etc.

---

## 6. Riesgos y ajustes conocidos (revisar por país)

- **Islas / exclaves sin frontera terrestre** → excluir del grafo (como San
  Andrés en Colombia, o Alaska/Hawái en USA). El validador los marca por quedar
  con 0 vecinos.
- **Nombres del dataset ≠ nombre local** (idioma, tildes, "State of…") → añadir
  `aliases` o normalizar. `normalizeName` ya cubre tildes/mayúsculas.
- **Adyacencias por río / borde muy corto** → la derivación por geometría las
  capta si los polígonos se tocan; si el dataset tiene huecos, revisar a mano los
  casos dudosos.
- **Conectividad**: el grafo debe ser conexo (todo país alcanzable) o el reto
  diario puede generar pares imposibles. El validador lo comprueba con BFS.

---

## 7. Qué hacer TÚ (humano) — resumen operativo

1. **Con el modelo actual (ahora):** pedir que construya `gen-region.mjs` (Paso 0)
   y lo valide con **Argentina** de punta a punta (datos + mapa + banderas +
   render en el selector). Commit.
2. **Cambiar a Fable.**
3. **Por cada país restante**, darle a Fable un mensaje corto tipo:
   > "Añade la región **Nigeria** siguiendo `docs/PLAN-REGIONES.md` §4 y §5
   > (fila ng). Corre el generador, registra en index.ts, verifica con tsc y en
   > el selector, y haz un commit pequeño."
4. Revisar cada país en el preview de la rama. Cuando estén los 4 embajadores,
   grabar el video celebratorio y taggear a los embajadores en X.

---

## 8. Notas de ramas

- Todo el trabajo de regiones vive en `feat/regiones-audio-practica` (o la rama
  que se defina). **No mergear a `main`** hasta visto bueno (MiniPay revisa
  producción). Preview por rama en Vercel.
