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
