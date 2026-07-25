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
