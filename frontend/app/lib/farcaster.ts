// ============================================================
//  Frontle — Mini App de Farcaster (carga diferida del SDK)
//
//  El SDK aporta ~525 KB al JS inicial de `/` y sirve para UNA cosa: avisarle
//  al cliente de Farcaster que la app ya pintó, para que suelte el splash.
//  Fuera de Farcaster —MiniPay, navegador normal— es peso muerto, y MiniPay
//  exige que el JS inicial de cada ruta se mantenga bajo 2 MB. De ahí que el
//  import sea dinámico Y vaya detrás de un pre-chequeo que no carga nada:
//  mismo patrón que PrivyGate con el SDK de Privy.
// ============================================================

import { isMiniPay } from "./minipay";

// Pre-chequeo sin SDK. Es el mismo corto-circuito que hace `sdk.isInMiniApp()`
// (node_modules/@farcaster/miniapp-sdk/dist/sdk.js): un Mini App siempre corre
// embebido, o en un iframe (cliente web) o en un WebView de React Native (app
// móvil). Si no es ninguno de los dos no hay a quién avisarle, y el chunk ni
// se pide. MiniPay se excluye explícito: es un WebView nativo que nunca va a
// hospedar un Mini App de Farcaster, y es justo donde el peso importa.
function mightBeMiniApp(): boolean {
  if (typeof window === "undefined") return false;
  if (isMiniPay()) return false;
  const w = window as unknown as { ReactNativeWebView?: unknown };
  return Boolean(w.ReactNativeWebView) || window !== window.parent;
}

// Le avisa al cliente de Farcaster que la app está lista para mostrarse. Es
// no-op fuera de un Mini App y nunca lanza: el splash de Farcaster no puede
// romper el juego.
export async function signalMiniAppReady(): Promise<void> {
  if (!mightBeMiniApp()) return;
  try {
    const { sdk } = await import("@farcaster/miniapp-sdk");
    await sdk.actions.ready();
  } catch {
    /* silencioso */
  }
}
