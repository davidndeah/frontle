// ============================================================
//  Frontle — Login por correo (Privy): configuración y bus de eventos
//
//  Privy pesa ~1.27 MB y solo sirve para dar wallet a quien no la tiene.
//  Dentro de MiniPay el wallet viene inyectado, así que ahí es código muerto
//  — y MiniPay es justo quien impone el límite de 2 MB de JS inicial.
//
//  Para poder cargarlo aparte hace falta romper una atadura: los hooks de
//  Privy (`useLogin`) exigen tener al `PrivyProvider` de ancestro. Si el
//  provider envuelve la página, no se puede montar tarde sin desmontar y
//  remontar todo el árbol (y perder el estado de la partida).
//
//  La salida es este bus: los botones piden el login lanzando un evento, y
//  quien lo escucha es `PrivyGate` — un componente aislado que sí vive dentro
//  del provider. Así el provider no envuelve nada de la página.
// ============================================================

export const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID || "";

// ¿Hay App ID configurado? Sin él, Privy no puede inicializar y el juego
// funciona igual con MiniPay o con una extensión de wallet.
export const PRIVY_ENABLED = Boolean(PRIVY_APP_ID);

const LOGIN_EVENT = "frontle:email-login";
const LOGOUT_EVENT = "frontle:logout";

// Lo llama cualquier botón de "Entrar con correo". No necesita hooks ni
// contexto: si no hay nadie escuchando (p. ej. dentro de MiniPay, donde
// PrivyGate no se monta), el evento simplemente se pierde.
export function requestEmailLogin(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(LOGIN_EVENT));
}

// Lo usa PrivyGate. Devuelve la función para desuscribirse.
export function onEmailLoginRequest(handler: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(LOGIN_EVENT, handler);
  return () => window.removeEventListener(LOGIN_EVENT, handler);
}

// Salir de la sesión de correo. Mismo bus que el login y por la misma razón:
// `usePrivy().logout` exige el provider de ancestro, y el provider vive
// aislado en PrivyGate para no arrastrar 1.27 MB al árbol de la partida.
//
// Solo aplica a Privy: la wallet de MiniPay o de una extensión la inyecta el
// navegador y la dapp no puede (ni debe) desconectarla.
export function requestLogout(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(LOGOUT_EVENT));
}

// Lo usa PrivyGate. Devuelve la función para desuscribirse.
export function onLogoutRequest(handler: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(LOGOUT_EVENT, handler);
  return () => window.removeEventListener(LOGOUT_EVENT, handler);
}
