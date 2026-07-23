// ============================================================
//  Onboarding por modo de juego.
//
//  Cada modo tiene su propio recorrido corto de coachmarks y su propia
//  marca de "ya visto", en vez de un único tutorial global. Dos razones:
//   · Los modos son loops distintos (cadena de países vs. adivinar uno
//     suelto), así que un tutorial único no puede explicarlos todos.
//   · Quien nunca entra a Regiones no debe cargar con su explicación.
//
//  El recorrido se muestra UNA vez por modo y nunca bloquea: son
//  coachmarks sobre la pantalla real, no un modal a pantalla completa.
// ============================================================

/** Modos con recorrido propio. El reto diario usa su propio flujo (más largo). */
export type CoachMode = "region" | "practice" | "quiz";

// Prefijo propio para no chocar con `frontle-coach-hints`, la marca del
// tutorial viejo del reto diario que todavía se lee para migración.
const KEY = (m: CoachMode) => `frontle-coach-modo-${m}`;

/**
 * Si falla el acceso a localStorage (modo privado, storage bloqueado) se
 * devuelve `true`: ante la duda es mejor NO mostrar el tutorial que
 * mostrárselo en bucle a alguien que ya lo vio.
 */
export function modeCoachSeen(mode: CoachMode): boolean {
  try {
    return localStorage.getItem(KEY(mode)) === "1";
  } catch {
    return true;
  }
}

export function markModeCoachSeen(mode: CoachMode): void {
  try {
    localStorage.setItem(KEY(mode), "1");
  } catch {}
}

/**
 * Olvida que el modo ya se vio, para que su recorrido vuelva a salir la
 * próxima vez que se entre. Lo usa "Aprende un modo" del menú de Bordy:
 * navegar al modo con la marca borrada hace que su tutorial salga solo al
 * empezar, sin necesidad de forzarlo desde fuera.
 */
export function clearModeCoachSeen(mode: CoachMode): void {
  try {
    localStorage.removeItem(KEY(mode));
  } catch {}
}
