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
//  Lo que NO se calcula aquí, a propósito:
//   · Comisiones de red en USD. Blockscout reporta `fee.value` en la unidad
//     nativa, pero con CIP-64 el usuario paga en USDT. Convertir exigiría un
//     precio externo, y mostrar CELO está prohibido en Mini Apps. Se omite en
//     vez de publicar un número que no podemos defender.
//   · Volumen por stablecoin. Solo se usa USDT; las cifras de dinero ya salen
//     del contrato (pot, premios, comisión), que es la fuente de verdad.
// ============================================================

const BLOCKSCOUT = "https://celo.blockscout.com/api/v2";

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
}

interface BsTx {
  method: string | null;
  status: string | null;
  from?: { hash?: string };
}

// Lo que hace un JUGADOR. Solo estas cuentan para "wallets únicas": incluir
// las de administración sumaría nuestras propias direcciones (el operador que
// cierra el día, el dueño que ajusta tarifas) al conteo de usuarios.
const USER_METHODS: Record<string, string> = {
  buyHint: "Pistas",
  payAttempt: "Reintentos",
  claim: "Premios reclamados",
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

export async function getChainActivity(addresses: string[]): Promise<ChainActivity | null> {
  try {
    const pages = await Promise.all(addresses.map(fetchTxs));
    const txs = pages.flatMap((p) => p.txs);
    if (txs.length === 0) return null;

    const senders = new Set<string>();
    const methods = new Map<string, number>();
    let failed = 0;

    for (const tx of txs) {
      const from = tx.from?.hash?.toLowerCase();
      if (from && isUserMethod(tx.method)) senders.add(from);
      if (tx.status !== "ok") failed++;
      const label = labelFor(tx.method);
      methods.set(label, (methods.get(label) ?? 0) + 1);
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
    };
  } catch (err) {
    console.error("[stats] no se pudo leer la actividad on-chain:", err);
    return null;
  }
}
