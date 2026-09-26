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
  timestamp?: string | null;
  method?: string | null;
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

// Desde sep-2026 pistas, reintentos y monedas se pagan con un USDT.transfer
// directo a la tesorería (una sola confirmación, a pedido de MiniPay): no
// pasan por los contratos, así que se leen de las transferencias que entran
// a la tesorería. Qué se pagó exactamente va en el calldata, que Blockscout
// no trae en esta lista; se agrupan en una sola fila.
const DIRECT_LABEL = "Pagos directos (pistas, reintentos y monedas)";
// La tesorería también recibe NUESTRO dinero (fondeo, swaps). Para no
// contarlo como de jugadores: solo desde que existen los pagos directos,
// solo `transfer` llano, y nada por encima de lo que un jugador puede pagar
// (el paquete más caro son 2.50 USDT).
const DIRECT_SINCE = Date.parse("2026-09-25T00:00:00Z");
const DIRECT_MAX_USDT = 10;
const TRANSFER_METHODS = new Set(["transfer", "0xa9059cbb"]);

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

// Transferencias del stablecoin que tocan una dirección. `filter` = "to"
// para solo las que entran (la tesorería); sin él, entran y salen.
async function fetchTransfers(address: string, filter?: "to"): Promise<{ items: BsTransfer[]; truncated: boolean }> {
  const out: BsTransfer[] = [];
  let params = filter ? `&filter=${filter}` : "";
  for (let page = 0; page < MAX_PAGES; page++) {
    const r = await fetch(`${BLOCKSCOUT}/addresses/${address}/token-transfers?type=ERC-20${params}`);
    if (!r.ok) break;
    const j = await r.json();
    const items: BsTransfer[] = Array.isArray(j?.items) ? j.items : [];
    out.push(...items);
    const next = j?.next_page_params;
    if (!next) return { items: out, truncated: false };
    params = `${filter ? `&filter=${filter}` : ""}&${new URLSearchParams(next as Record<string, string>).toString()}`;
  }
  return { items: out, truncated: true };
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

// `treasury`: dirección que recibe los pagos directos (ver DIRECT_LABEL).
export async function getChainActivity(addresses: string[], treasury?: string): Promise<ChainActivity | null> {
  try {
    const [pages, transferLists, inflows, nativePrice] = await Promise.all([
      Promise.all(addresses.map(fetchTxs)),
      Promise.all(addresses.map((a) => fetchTransfers(a))),
      treasury ? fetchTransfers(treasury, "to") : Promise.resolve({ items: [] as BsTransfer[], truncated: false }),
      fetchNativePrice(),
    ]);
    const txs = pages.flatMap((p) => p.txs);
    const tesoreria = treasury?.toLowerCase();
    const propias = new Set([...addresses.map((a) => a.toLowerCase()), ...(tesoreria ? [tesoreria] : [])]);
    // Pagos de JUGADORES a la tesorería: USDT que entra desde una dirección
    // que no es nuestra (ni la tesorería ni un contrato, p. ej. un premio
    // reclamado y reenviado).
    const directos = inflows.items.filter((tr) => {
      if (tr.token?.symbol !== VOLUME_TOKEN || propias.has(tr.from?.hash?.toLowerCase() ?? "")) return false;
      if (!TRANSFER_METHODS.has(tr.method ?? "")) return false;
      const t = tr.timestamp ? Date.parse(tr.timestamp) : NaN;
      if (!(t >= DIRECT_SINCE)) return false;
      const monto = Number(tr.total?.value ?? 0) / 10 ** Number(tr.total?.decimals ?? 6);
      return monto > 0 && monto <= DIRECT_MAX_USDT;
    });
    if (txs.length === 0 && directos.length === 0) return null;

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

    for (const tr of directos) {
      const from = tr.from?.hash?.toLowerCase();
      if (from) senders.add(from);
      methods.set(DIRECT_LABEL, (methods.get(DIRECT_LABEL) ?? 0) + 1);
      const t = tr.timestamp ? Date.parse(tr.timestamp) : NaN;
      if (Number.isFinite(t)) {
        const edad = ahora - t;
        if (edad <= DIA) txDay++;
        if (edad <= 7 * DIA) txWeek++;
        if (edad <= 30 * DIA) txMonth++;
      }
    }

    // Una transferencia entre dos contratos nuestros sale en las dos listas:
    // se deduplica por hash + partes + importe para no contarla dos veces.
    // Desde que existen los pagos directos, lo que la tesorería mete en un
    // contrato (su reenvío con fundPot, y la siembra, que on-chain no se
    // distingue) NO es volumen nuevo: ese dinero ya contó al entrar a la
    // tesorería. Lo anterior se deja como estaba para no mover el histórico.
    const vistas = new Set<string>();
    let volume = 0;
    for (const tr of [...transferLists.flatMap((l) => l.items), ...directos]) {
      if (tr.token?.symbol !== VOLUME_TOKEN) continue;
      if (tesoreria && tr.from?.hash?.toLowerCase() === tesoreria && Date.parse(tr.timestamp ?? "") >= DIRECT_SINCE) continue;
      const clave = `${tr.transaction_hash}|${tr.from?.hash}|${tr.to?.hash}|${tr.total?.value}`;
      if (vistas.has(clave)) continue;
      vistas.add(clave);
      const dec = Number(tr.total?.decimals ?? 6);
      volume += Number(tr.total?.value ?? 0) / 10 ** dec;
    }

    const byMethod = [...methods.entries()]
      .map(([method, count]) => ({ method, count }))
      .sort((a, b) => b.count - a.count);

    // Los pagos directos solo aparecen si se confirmaron: no suman fallos.
    // Sus comisiones de red no vienen en esta lista y no entran en feesUsd.
    const txTotal = txs.length + directos.length;
    return {
      txTotal,
      uniqueUsers: senders.size,
      failedRate: txTotal ? failed / txTotal : 0,
      byMethod,
      truncated: pages.some((p) => p.truncated) || inflows.truncated,
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
