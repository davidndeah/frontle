// ============================================================
//  Frontle — Integración con MiniPay
//  Detección del entorno y deeplinks oficiales.
//
//  Por qué importa: sin `isMiniPay()` la app no puede entrar al catálogo de
//  descubrimiento de MiniPay, y el hook cuenta como booster del score de
//  Proof of Ship. Dentro de MiniPay además cambian tres cosas:
//    · La wallet se conecta sola: no se muestra botón de conectar.
//    · Nunca se enseña CELO: MiniPay paga la comisión de red con el
//      stablecoin (CIP-64) y oculta el token al usuario.
//    · Si el saldo no alcanza, se manda al deeplink de recarga, no a un error.
//
//  Docs: https://docs.minipay.xyz/getting-started/wallet-connection.html
// ============================================================

// MiniPay inyecta `ethereum.isMiniPay === true`. Se comprueba en cada llamada
// (no se cachea) porque el provider puede llegar después del primer render.
export function isMiniPay(): boolean {
  if (typeof window === "undefined") return false;
  const eth = (window as unknown as { ethereum?: { isMiniPay?: boolean } }).ethereum;
  return eth?.isMiniPay === true;
}

// Deeplink de recarga. `tokens` filtra qué stablecoins ofrece la pantalla.
// Lista canónica: https://docs.minipay.xyz/technical-references/deeplinks.html
export const ADD_CASH_URL = "https://link.minipay.xyz/add_cash?tokens=USDT";

// Abre la pantalla de recarga de MiniPay. Fuera de MiniPay el enlace no
// resuelve a nada útil, así que el llamador debe comprobar `isMiniPay()`.
export function openAddCash(): void {
  if (typeof window !== "undefined") window.location.href = ADD_CASH_URL;
}
