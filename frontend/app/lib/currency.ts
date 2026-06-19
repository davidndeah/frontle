// ============================================================
//  Frontle — Moneda de visualización
//  El token real del juego SIEMPRE es USDT; esto es solo para que el
//  usuario (en especial el de Colombia) pueda VER los montos en COPm.
//  No cambia ninguna transacción on-chain.
//
//  Tasa: COPm (cCOP de Mento) está peguado 1:1 al peso colombiano, así
//  que usamos la tasa fiat USD→COP en vivo como tasa de COPm. Es
//  equivalente a la on-chain (± spread del peg, por eso el "≈"). No hay
//  quote on-chain directo de cCOP: no tiene pool en el Broker de Mento
//  ni feed activo en SortedOracles. Si se quiere purismo on-chain en el
//  futuro, habría que resolver el rateFeedId de Mento v3 para COP/USD.
// ============================================================

export type DisplayCurrency = "USDT" | "COPM";

// Tasa USD→COP de respaldo si la API falla (aprox.). 1 USDT ≈ 1 USD ≈ 1 COPm·tasa.
const COP_FALLBACK = 4000;

// Tasa de cambio USD→COP en vivo, sin API key. Cae al fallback si falla.
// COPm sigue al peso, así que esta tasa vale como tasa de COPm.
export async function getUsdToCopmRate(): Promise<number> {
  try {
    const r = await fetch("https://open.er-api.com/v6/latest/USD");
    const j = await r.json();
    const cop = Number(j?.rates?.COP);
    return cop > 0 ? cop : COP_FALLBACK;
  } catch {
    return COP_FALLBACK;
  }
}

// Formatea un monto en USDT según la moneda de visualización.
//   USDT → "0.08 USDT"
//   COPM → "≈ 320 COPm"  (estimado, redondeado; COPm ≈ peso)
export function formatMoney(usdt: number, currency: DisplayCurrency, copmRate: number): string {
  if (currency === "COPM") {
    const copm = usdt * copmRate;
    return `≈ ${copm.toLocaleString("es-CO", { maximumFractionDigits: 0 })} COPm`;
  }
  return `${usdt.toFixed(2)} USDT`;
}
