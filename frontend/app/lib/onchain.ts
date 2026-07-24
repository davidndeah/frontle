// ============================================================
//  Frontle — Actividad on-chain para /stats
//  Recorre las transacciones de ambos contratos vía la API pública de
//  Blockscout (sin clave) y agrega: total, usuarios únicos, desglose por
//  método y tasa de fallos.
//
//  Por qué Blockscout y no los contadores del propio explorador: el endpoint
//  /counters devuelve transactions_count: 0 para el v2, que es falso. La lista
//  paginada de /transactions sí es correcta.
//
//  Sobre las comisiones de red: Blockscout las reporta en unidad nativa y no
//  expone `fee_currency`, así que antes se omitían para no publicar un número
//  indefendible. El listing las exige EN USD, y eso sí se puede: se convierte
//  con un precio externo y se muestra solo el importe en dólares — nunca el
//  token, que en Mini Apps está prohibido enseñar. Si el precio no responde,
//  se devuelve null y la métrica no se pinta: preferimos un hueco a un número
//  inventado.
// ============================================================

const BLOCKSCOUT = "https://celo.blockscout.com/api/v2";

// Precio del token nativo, solo para convertir comisiones a USD. DefiLlama es
// la fuente que recomienda la propia skill de Celo y no pide clave.
const PRICE_URL = "https://coins.llama.fi/prices/current/coingecko:celo";

// Stablecoin único del juego. El listing pide el volumen POR stablecoin; aquí
// solo hay una, así que la cifra es completa por definición.
const VOLUME_TOKEN = "USDT";

// Tope de páginas por contrato. Cada página son 50 tx. Evita que la página se
// quede colgada pidiendo el historial entero según crezca el juego.
const MAX_PAGES = 6;

export interface MethodCount {
  method: string;
  count: number;
}

export interface ChainActivity {
  txTotal: number;
  uniqueUsers: number; // wallets distintas que hicieron acciones DE JUGADOR
  failedRate: number; // 0..1, sobre todas las transacciones
  byMethod: MethodCount[]; // de mayor a menor
  truncated: boolean; // se alcanzó MAX_PAGES: los totales son un piso, no el total
  // Transacciones por periodo (últimas 24 h / 7 d / 30 d). Blockscout devuelve
  // de la más nueva a la más vieja, así que estos tramos son exactos mientras
  // el corte por páginas caiga más atrás que la ventana; si no, `truncated`.
  txDay: number;
  txWeek: number;
  txMonth: number;
  /** Volumen movido en el stablecoin del juego (entradas + salidas). */
  volume: number;
  volumeToken: string;
  /** Comisiones de red pagadas POR JUGADORES, en USD. null = sin precio. */
  feesUsd: number | null;
}

interface BsTx {
  method: string | null;
  status: string | null;
  from?: { hash?: string };
  timestamp?: string | null;
  fee?: { value?: string } | null;
}

interface BsTransfer {
  transaction_hash?: string;
  total?: { value?: string; decimals?: string | number };
  token?: { symbol?: string };
  from?: { hash?: string };
  to?: { hash?: string };
}

// Lo que hace un JUGADOR. Solo estas cuentan para "wallets únicas": incluir
// las de administración sumaría nuestras propias direcciones (el operador que
// cierra el día, el dueño que ajusta tarifas) al conteo de usuarios.
const USER_METHODS: Record<string, string> = {
  buyHint: "Pistas",
  payAttempt: "Reintentos",
  claim: "Premios reclamados",
  // Compra de monedas de la liga (contrato semanal). Sin esta entrada caía en
  // "Administración" y su comprador no contaba como usuario único.
  buyCoins: "Monedas",
};

// Lo que hacemos nosotros. Se muestra agrupado, no oculto.
const ADMIN_METHODS = new Set([
  "rollDay",
  "fundPot",
  "setFees",
  "setHintFee",
  "setOperator",
  "withdrawProtocol",
  "transferOwnership",
  "renounceOwnership",
]);

const ADMIN_LABEL = "Administración";

// Un selector sin decodificar (0x…) también cae en administración: los tres
// métodos de jugador siempre se decodifican, así que lo que queda es nuestro.
function labelFor(method: string | null): string {
  if (!method) return ADMIN_LABEL;
  if (USER_METHODS[method]) return USER_METHODS[method];
  if (method.startsWith("0x") || ADMIN_METHODS.has(method)) return ADMIN_LABEL;
  return method;
}

const isUserMethod = (method: string | null): boolean => !!method && method in USER_METHODS;

async function fetchTxs(address: string): Promise<{ txs: BsTx[]; truncated: boolean }> {
  const txs: BsTx[] = [];
  let params = "";
  for (let page = 0; page < MAX_PAGES; page++) {
    const r = await fetch(`${BLOCKSCOUT}/addresses/${address}/transactions?filter=to${params}`);
    if (!r.ok) break;
    const j = await r.json();
    const items: BsTx[] = Array.isArray(j?.items) ? j.items : [];
    txs.push(...items);
    const next = j?.next_page_params;
    if (!next) return { txs, truncated: false };
    params = `&${new URLSearchParams(next as Record<string, string>).toString()}`;
  }
  return { txs, truncated: true };
}

// Transferencias del stablecoin que tocan un contrato (entran o salen).
async function fetchTransfers(address: string): Promise<BsTransfer[]> {
  const out: BsTransfer[] = [];
  let params = "";
  for (let page = 0; page < MAX_PAGES; page++) {
    const r = await fetch(`${BLOCKSCOUT}/addresses/${address}/token-transfers?type=ERC-20${params}`);
    if (!r.ok) break;
    const j = await r.json();
    const items: BsTransfer[] = Array.isArray(j?.items) ? j.items : [];
    out.push(...items);
    const next = j?.next_page_params;
    if (!next) break;
    params = `&${new URLSearchParams(next as Record<string, string>).toString()}`;
  }
  return out;
}

// Precio del token nativo en USD. null si la fuente falla: sin él no se
// publica una cifra de comisiones a ojo.
async function fetchNativePrice(): Promise<number | null> {
  try {
    const r = await fetch(PRICE_URL);
    const j = await r.json();
    const price = Number(j?.coins?.["coingecko:celo"]?.price);
    return Number.isFinite(price) && price > 0 ? price : null;
  } catch {
    return null;
  }
}

export async function getChainActivity(addresses: string[]): Promise<ChainActivity | null> {
  try {
    const [pages, transferLists, nativePrice] = await Promise.all([
      Promise.all(addresses.map(fetchTxs)),
      Promise.all(addresses.map(fetchTransfers)),
      fetchNativePrice(),
    ]);
    const txs = pages.flatMap((p) => p.txs);
    if (txs.length === 0) return null;

    const senders = new Set<string>();
    const methods = new Map<string, number>();
    let failed = 0;
    let feeWei = BigInt(0);

    const ahora = Date.now();
    const DIA = 86_400_000;
    let txDay = 0;
    let txWeek = 0;
    let txMonth = 0;

    for (const tx of txs) {
      const esUsuario = isUserMethod(tx.method);
      const from = tx.from?.hash?.toLowerCase();
      if (from && esUsuario) senders.add(from);
      if (tx.status !== "ok") failed++;
      const label = labelFor(tx.method);
      methods.set(label, (methods.get(label) ?? 0) + 1);

      // Solo las comisiones que pagó un JUGADOR: las nuestras (cerrar el día,
      // sembrar el pot) no son coste del usuario y falsearían la cifra.
      if (esUsuario && tx.fee?.value) {
        try {
          feeWei += BigInt(tx.fee.value);
        } catch {}
      }

      const t = tx.timestamp ? Date.parse(tx.timestamp) : NaN;
      if (Number.isFinite(t)) {
        const edad = ahora - t;
        if (edad <= DIA) txDay++;
        if (edad <= 7 * DIA) txWeek++;
        if (edad <= 30 * DIA) txMonth++;
      }
    }

    // Una transferencia entre dos contratos nuestros sale en las dos listas:
    // se deduplica por hash + partes + importe para no contarla dos veces.
    const vistas = new Set<string>();
    let volume = 0;
    for (const tr of transferLists.flat()) {
      if (tr.token?.symbol !== VOLUME_TOKEN) continue;
      const clave = `${tr.transaction_hash}|${tr.from?.hash}|${tr.to?.hash}|${tr.total?.value}`;
      if (vistas.has(clave)) continue;
      vistas.add(clave);
      const dec = Number(tr.total?.decimals ?? 6);
      volume += Number(tr.total?.value ?? 0) / 10 ** dec;
    }

    const byMethod = [...methods.entries()]
      .map(([method, count]) => ({ method, count }))
      .sort((a, b) => b.count - a.count);

    return {
      txTotal: txs.length,
      uniqueUsers: senders.size,
      failedRate: txs.length ? failed / txs.length : 0,
      byMethod,
      truncated: pages.some((p) => p.truncated),
      txDay,
      txWeek,
      txMonth,
      volume,
      volumeToken: VOLUME_TOKEN,
      // El token nativo lleva 18 decimales; el resultado se expresa en USD.
      feesUsd: nativePrice === null ? null : (Number(feeWei) / 1e18) * nativePrice,
    };
  } catch (err) {
    console.error("[stats] no se pudo leer la actividad on-chain:", err);
    return null;
  }
}
