# PLAN — Nuevo modo: Adivina el lugar (por foto)

> Diseño propio, inspirado solo en la **idea general** de "foto → adivinar dónde queda"
> (ver [docs/design/arcadia-review.md](./design/arcadia-review.md) para por qué NO se copia
> nada de código/datos de terceros). Continúa el estilo de los `PLAN-*.md` del repo — mismo
> formato que `PLAN-MODOS-QUIZ.md`.

---

## 1. La idea

Un modo de opción múltiple: se muestra la foto de un lugar real (monumento, paisaje, ciudad) y
el jugador elige, entre 4 opciones, el **país** donde queda. Reutiliza el lenguaje visual que
Frontle ya tiene (Bordy, streaks, estrellas) en vez de inventar uno nuevo.

Encaja con el resto del juego: Frontle ya enseña geografía por fronteras (reto diario) y por
banderas/contornos (`CountryQuizGame`); esto suma la dimensión visual/cultural — "¿reconoces
este lugar?" — sin duplicar ningún modo existente.

**Nombre de trabajo:** "Adivina el lugar" (evitar "GeoGuess" — es el nombre del modo de Arcadia,
mejor no coincidir ni de nombre).

---

## 2. Arquitectura compartida (no duplicar código)

Un componente nuevo `app/components/PlaceGuessGame.tsx`, clonando el patrón que ya usan
`CountryQuizGame.tsx`/`PracticeGame.tsx`/`RegionGame.tsx` en vez de inventar uno:

- **Estímulo:** imagen a pantalla completa (como `imageUrl` en Arcadia, pero con banco propio —
  ver §3). Reusar el patrón de carga/skeleton que ya tiene `CountryOutline.tsx`.
- **Opciones:** 4 botones de país (reusar `resolveLocalized`/`countryName` de `lib/i18n.ts` para
  que las opciones salgan en el idioma del jugador).
- **Dificultad:** reusar `Difficulty` (`"easy" | "medium" | "hard"`) y el patrón de `tierOf` de
  `lib/game.ts` — cada entrada del banco propio lleva un tier igual de simple, sin inventar un
  motor de dificultad nuevo (el de Arcadia es justo lo que la licencia protege explícitamente).
- **Racha/streak:** reusar `winMood`/`greenGuessMood` de `lib/streakMood.ts` tal cual — el nuevo
  modo es "repetible de una sola ronda", el mismo caso que ya cubre `roundsWonBefore` en
  `PracticeGame`/`CountryQuizGame`.
- **Tutorial:** sumar `"place"` a `CoachMode` en `lib/onboarding.ts` (hoy es
  `"region" | "practice" | "flag" | "outline"`) y su propio recorrido de `Coachmarks`.
- **Selección de nivel, monedas, ranking, compartir:** clonar tal cual de `PracticeGame`/
  `CountryQuizGame` (`LevelSelect`, `CoinShop`, `ScoreCard`) — cero motor nuevo, solo el
  estímulo (imagen) y el banco de datos son nuevos.

---

## 3. Banco de datos: esquema propio + fotos con licencia clara

**Esquema** (`app/lib/places.ts`, formato propio — no el de `data/geo.json` de Arcadia):

```ts
export interface PlaceEntry {
  id: string;
  country: string;       // debe existir en COUNTRY_NAMES o ISLAND_NAMES
  imageUrl: string;       // propia, no hotlinkeada de Arcadia ni de nadie
  credit?: string;        // atribución si la licencia de la foto lo exige
  decoys: string[];       // 3 países señuelo, mismo continente para que sea difícil de verdad
  tier?: Difficulty;      // igual que quiz.ts — ausente = medium
}
```

**De dónde salen las fotos (pendiente de decisión de David):**
1. **Wikimedia Commons** — enorme catálogo de fotos de lugares con licencia CC (BY / BY-SA / dominio
   público). Requiere guardar el `credit` de cada una (autor + licencia) — el esquema ya lo contempla.
   Filtrar por licencias que permitan uso comercial sin compartir el código (CC-BY, CC0, dominio
   público; evitar ShareAlike si complica términos legales del proyecto).
2. **Fotos propias / banco pagado** (Unsplash+/Shutterstock) — más control de estilo/calidad, pero
   cuesta tiempo o dinero.
3. **Empezar chico**: ~30-50 lugares muy reconocibles (Torre Eiffel, Cristo Redentor, Machu Picchu,
   Times Square…) con Wikimedia, igual que `PLAN-MODOS-QUIZ.md` arrancó con "~50 países curados"
   para los datos culturales. Ampliar por tandas.

**Riesgo a evitar:** el LICENSE de Arcadia prohíbe explícitamente "scraping/extracting/bulk-downloading"
su banco — ni las URLs de sus imágenes ni sus IDs de lugares se deben mirar siquiera como referencia
de qué fotografiar. El banco de Frontle se arma de cero, con fuentes propias verificables.

---

## 4. Preguntas abiertas (decisión de David)

- ¿Cuántos lugares para el lanzamiento — 30, 50, más? (arrancar chico, ampliar por tandas, como
  hizo `countryFacts.ts`).
- ¿Wikimedia Commons alcanza en calidad/variedad, o vale la pena un banco pagado desde el día 1?
- ¿El modo entra al reto diario (determinista por fecha, como `dailyChallenge()`) o solo como modo
  repetible tipo Bandera/Contorno? Empezar por repetible es menos riesgo (no hay "reto del día
  arruinado" si falta contenido).
- ¿Señuelos (`decoys`) se autoran a mano por entrada, o se derivan (mismo continente, aleatorios)?
  Autorarlos a mano da mejor dificultad pero cuesta más tiempo por entrada.

## 5. Siguiente paso

Este plan es solo diseño — no hay código todavía. El primer paso real sería: David decide la
fuente de fotos (§3) y cura las primeras ~10-15 entradas a mano (mismo patrón que el arranque de
`countryFacts.ts` en `PLAN-MODOS-QUIZ.md`); con esas, se puede prototipar `PlaceGuessGame.tsx`
clonando `CountryQuizGame.tsx` y validar que el patrón de §2 funciona antes de escalar el banco.
