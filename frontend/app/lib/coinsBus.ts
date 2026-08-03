// ============================================================
//  Frontle — Monedas: precios y bus de avisos (módulo HOJA)
//
//  Esto vivía dentro de `lib/coins.ts`, pero ese módulo importa `payments.ts`
//  y con él entra viem (~248 KB). `streak.ts` solo necesitaba de allí dos
//  cosas que no tocan la cadena para nada — la tabla de precios y el aviso de
//  "el saldo cambió" — y bastaba con eso para arrastrar viem al bundle inicial
//  por la ruta page.tsx → streak.ts → coins.ts → payments.ts.
//
//  ⚠️ Este archivo NO debe importar nada. Es lo que lo mantiene fuera del
//  camino de viem; en cuanto le añadas un import, la cadena vuelve a existir.
//  `coins.ts` reexporta todo esto, así que quien ya importaba de allí sigue
//  funcionando igual.
// ============================================================

// Ítems de gasto. Deben coincidir con el check `coin_shape` de coin_ledger,
// hoy en la 0015 — NO en la 0009, que es donde nacieron: el congelador bajó de
// 15 a 5 🪙 en la 0015 y aquí se quedó en 15. El servidor manda (fija el precio
// en `buy_streak_freeze`), así que el desajuste solo mentía en pantalla.
export const COIN_COSTS = {
  spend_hint: 3,
  spend_hint_strong: 5,
  spend_attempt: 5,
  spend_freeze: 5,
  spend_repair: 25,
  spend_repair_long: 50,
} as const;

export type SpendKind = keyof typeof COIN_COSTS;

// --- Aviso de "el saldo cambió" ---------------------------------------------
// El contador del header vive en page.tsx, pero se gasta desde dentro de los
// modos (pistas, reintentos) y desde la tarjeta de racha, que no lo conocen.
// Un evento de ventana evita pasar callbacks por tres niveles de props: quien
// mueva monedas avisa, y quien muestre saldo se entera. Mismo patrón que el
// bus de lib/privy.ts.
const COINS_EVENT = "frontle:coins";

export function notifyCoinsChanged(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(COINS_EVENT));
}

export function onCoinsChanged(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(COINS_EVENT, cb);
  return () => window.removeEventListener(COINS_EVENT, cb);
}
