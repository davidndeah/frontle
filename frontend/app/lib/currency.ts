// ============================================================
//  Frontle — Moneda de visualización
//  El token real SIEMPRE es USDT; esto es solo para que el usuario
//  (en especial el de Colombia) pueda VER los montos convertidos a
//  pesos. No cambia ninguna transacción on-chain.
// ============================================================

export type DisplayCurrency = "USDT" | "COP";

// Tasa USD→COP de respaldo si la API falla (aprox.). 1 USDT ≈ 1 USD.
const COP_FALLBACK = 4000;

// Tasa de cambio USD→COP en vivo, sin API key. Cae al fallback si falla.
export async function getUsdToCopRate(): Promise<number> {
  try {
    const r = await fetch("https://open.er-api.com/v6/latest/USD");
    const j = await r.json();
    const cop = Number(j?.rates?.COP);
    return cop > 0 ? cop : COP_FALLBACK;
  } catch {
    return COP_FALLBACK;
  }
}

// Formatea un monto en USDT según la moneda elegida.
//   USDT → "0.08 USDT"
//   COP  → "≈ 320 COP"  (aproximado, redondeado)
export function formatMoney(usdt: number, currency: DisplayCurrency, copRate: number): string {
  if (currency === "COP") {
    const cop = usdt * copRate;
    return `≈ ${cop.toLocaleString("es-CO", { maximumFractionDigits: 0 })} COP`;
  }
  return `${usdt.toFixed(2)} USDT`;
}
