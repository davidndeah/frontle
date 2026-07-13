# PLAN — Nuevos modos: Adivina la bandera · Adivina el contorno

> Dos modos de "adivinar el país" que comparten motor: se muestra un estímulo
> (bandera o silueta) y el jugador escribe el país, con una **escalera de pistas
> culturales** que enseñan del país (la idea de David). Diseñado con Opus para
> ejecución de Fable. Continúa el estilo de los PLAN-* del repo.

---

## 1. La gran idea: pistas que enseñan cultura

El diferenciador. Cada pista revela un poco más, ordenadas de **vaga → obvia**,
y de paso enseñan. Ej.: *"Conocido por su café de altura"* → Colombia.

**Escalera de pistas unificada (misma para ambos modos):**
| # | Pista | Origen | Coste de autoría |
|---|-------|--------|------------------|
| 1 | Dato cultural vago (*"produce mucho café"*) | Autoría | Alto |
| 2 | **Continente** | Derivado (mapa continente) | Bajo (1 vez) |
| 3 | **Nº de fronteras terrestres** (o "es una isla") | Derivado (`neighbors`) | 0 |
| 4 | Dato cultural más revelador | Autoría | Alto |
| 5 | **Inicial** del nombre localizado | Derivado | 0 |
| 6 | **El otro visual**: en modo bandera → muestra el contorno; en modo contorno → muestra la bandera | Gratis (los dos modos se cruzan) | 0 |

> Las pistas 2, 3, 5, 6 son **gratis y derivadas** (no requieren contenido). Solo
> las culturales (1, 4) se escriben — y son las que dan el sabor. Un país sin datos
> culturales autorados usa solo las pistas estructurales (degradación elegante).

**Cada pista usada resta estrellas** (menos pistas + menos tiempo = mejor). Así el
jugador aprende pero se premia recordar.

---

## 2. Arquitectura compartida (no duplicar código)

Un solo componente `app/components/CountryQuizGame.tsx` con prop `mode: "flag" | "outline"`:
- **Estímulo:** `mode==="flag"` → `<Flag>` grande (flagcdn SVG, ya existe); `mode==="outline"` → `<CountryOutline>` (nuevo, ver §4).
- **Input + autocompletar:** reusar `resolveLocalized` / `suggestLocalized` / `countryName` (idénticos al modo mundial).
- **Escalera de pistas:** hook/función `quizHints(country, locale, mode)` que devuelve la lista ordenada (culturales + derivadas).
- **Victoria / estrellas / timer / SFX / share:** clonar el patrón de `PracticeGame`/`RegionGame`.
- **Elección de país:** reusar `tierOf`/dificultad de `game.ts` para elegir por nivel (easy = países famosos, hard = raros), y `randomChallenge`-style para endless; `dateSeed()` para el diario (fase 2).

Ventaja: los dos modos son **el mismo componente** parametrizado. Un solo lugar para pistas, victoria y estrellas.

---

## 3. Datos culturales (el trabajo de contenido — decisión de David)

`app/lib/countryFacts.ts`:
```ts
import type { Locale } from "./i18n";
// Clave = ISO2. Pistas ordenadas de vaga a reveladora. Autorado para un set
// curado; los que falten usan solo pistas estructurales.
export const COUNTRY_FACTS: Record<string, Partial<Record<Locale, string[]>>> = {
  CO: { es: ["Su café de altura es famoso", "Cuna del realismo mágico"], en: ["Known for high-altitude coffee", "Birthplace of magical realism"], /* pt, fr */ },
  // …
};
export function factsFor(code: string, locale: Locale): string[] { /* con fallback a en */ }
```

**Estrategia de autoría (rápida):**
1. Empezar por un **set curado de ~50 países reconocibles** (los de dificultad easy/medium), 2 datos cada uno, ordenados vago→revelador.
2. Escribir en **ES**, luego traducir el bloque completo en **1 pasada** a en/pt/fr (receta de `PLAN-I18N.md`).
3. Ampliar por tandas. Los no cubiertos degradan a pistas estructurales.

**⚠️ Riesgo de exactitud:** un dato falso es vergonzoso y daña la credibilidad. Todo dato generado por modelo debe **revisarlo David** antes de mergear (o restringir a hechos muy establecidos: café/Colombia, tango/Argentina, pirámides/Egipto…).

**No lo caza `i18n-lint`** (es `.ts` de datos, no JSX) — está bien, pero mantener claves paralelas por país entre idiomas.

---

## 4. Pieza nueva: `CountryOutline` (modo contorno)

Renderiza la **silueta** de un país (relleno, sin fronteras internas ni etiquetas):
1. Cargar **una vez** `world-atlas@2/countries-110m.json` (ya lo usa `WorldMap`, ~100 KB; cachear en memoria). 110m basta para siluetas.
2. Reutilizar el **matching de nombres** de `WorldMap` (`NE_ALIAS` + índice) — extraer esa lógica a un helper compartido `app/lib/atlas.ts` (`featureForCountry(name)`) para no duplicar.
3. Proyectar el feature con `geoMercator().fitExtent(...)` (igual que `RegionMapPreview`) y pintar el path relleno del color del tema, fondo neutro.
4. Filtrar microstados en dificultad baja (siluetas imposibles) usando los tiers.
Opcional (fase 2): normalizar orientación para no dar pistas de rotación; con 110m no hace falta.

---

## 5. Pistas derivadas (gratis, sin contenido)

- **Continente:** añadir `app/lib/continents.ts` = `Record<ISO2, "AF"|"EU"|"AS"|"NA"|"SA"|"OC"|"AN">` (~150 líneas, 1 vez) + nombres de continente en i18n (7 × 4 idiomas, trivial). No hay campo continente hoy (solo comentarios en `countries.ts`).
- **Fronteras:** `getCountry(name).neighbors.length` → *"Limita con N países"* o *"Es una isla / sin fronteras"* si 0.
- **Inicial:** `countryName(name, locale).charAt(0)`.
- **Cruce de modos:** en bandera, la pista final es el contorno (`<CountryOutline>`); en contorno, es la bandera (`<Flag>`).

---

## 6. Integración en el selector de modos

En `page.tsx` (paso `jugarStep === "modes"`), reemplazar la tarjeta "Más modos (coming soon)" por **dos tarjetas**:
- 🏳️ **Adivina la bandera** → `setQuizMode("flag")`
- 🗺️ **Adivina el contorno** → `setQuizMode("outline")`

Estado `quizMode: "flag" | "outline" | null`, y en el tab Jugar: `quizMode && <CountryQuizGame mode={quizMode} locale={locale} onExit={...} />`. Selector de dificultad dentro del modo (como práctica). Todas las cadenas nuevas van a `i18n` (4 idiomas) + `i18n-lint` verde.

---

## 7. Fases (para PRs pequeños y valor temprano)

**Fase 1 — jugable (endless):**
1. `atlas.ts` (helper de matching) + `CountryOutline`.
2. `continents.ts` + i18n de continentes.
3. `quizHints()` (solo derivadas al principio).
4. `CountryQuizGame` (endless, random por dificultad) + tarjetas del selector + i18n.
5. `countryFacts.ts` set curado ES→4 idiomas + enganchar en la escalera.

**Fase 2 — retención:**
6. Versión **diaria determinista** (seed) por modo → compartible + rankeable. Depende de la columna `mode` en Supabase (tarea S1 de `PLAN-LISTING.md`; confirmar si ya existe).
7. **Score card** compartible (bandera/silueta oculta + estrellas).
8. Ampliar `countryFacts` por tandas.

Cada punto = su PR pequeño (rama corta → PR → merge), para mantener la métrica.

---

## 8. Verificación por ítem
- `tsc --noEmit` 0 · `i18n-lint` verde.
- **Bandera:** con la app en ES, se ve la bandera; escribir "colom" sugiere "Colombia"; ganar muestra estrellas; las pistas nombran continente/fronteras correctos.
- **Contorno:** la silueta se renderiza reconocible (probar Colombia, Italia, Chile) y sin distorsión; pista final muestra la bandera.
- **Pistas culturales:** en los 4 idiomas, ordenadas vago→obvio, y todas VERÍDICAS (revisión de David).

---

## 9. Decisiones fijadas (David)
1. **Datos culturales:** los **genero yo** (curados, hechos muy establecidos) y **David revisa la exactitud** antes de mergear. Primera tanda en `countryFacts.ts`.
2. **Fase:** **endless primero** (jugable ya, con dificultad); diario + ranking + score card en fase 2.
3. Alcance inicial: tanda de ~30 países famosos, ampliable por tandas.
