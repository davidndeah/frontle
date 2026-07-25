// ============================================================
//  Frontle — Racha (Bordy). Decide cuándo un acierto se siente como
//  "racha" (festejo grande) en vez de "acierto" (hop normal).
//
//  Tres condiciones independientes, cualquiera activa "racha":
//   · Racha diaria: el jugador ya tiene racha de días jugados (>0) —
//     ganar CUALQUIER juego mientras esa racha está viva se celebra grande.
//   · Racha de aciertos: dos verdes SEGUIDOS en la misma cadena (Reto
//     diario, Regiones, Práctica). El primero es "acierto"; el segundo
//     (y los siguientes mientras la racha no se corte) son "racha".
//   · Racha de rondas: en modos repetibles de una sola ronda (Bandera,
//     Contorno, Práctica), la primera ronda ganada de la sesión es
//     "acierto"; la segunda ronda ganada seguida (y las siguientes) son
//     "racha" — a menos que la racha diaria ya la vuelva racha desde la
//     primera.
// ============================================================

export type GuessQuality = "green" | "yellow" | "red";
export type WinMood = "acierto" | "racha";

/** ¿Corresponde festejo grande al ganar, dado el estado de rachas? */
export function winMood(dailyStreak: number, roundsWonBefore = 0): WinMood {
  return dailyStreak > 0 || roundsWonBefore > 0 ? "racha" : "acierto";
}

/**
 * Mood de un acierto verde INTERMEDIO (no el que gana la partida): racha
 * si el guess anterior de la cadena también fue verde. `undefined` (cadena
 * vacía o el anterior no fue verde) = acierto normal.
 */
export function greenGuessMood(prevQuality: GuessQuality | undefined): WinMood {
  return prevQuality === "green" ? "racha" : "acierto";
}
