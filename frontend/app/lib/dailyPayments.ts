// ============================================================
//  Frontle — Aviso al servidor de los pagos del juego diario
//  Pistas y reintentos se pagan con un `USDT.transfer` a la tesorería (una
//  sola confirmación, a pedido de MiniPay). El dinero del pot diario ya no
//  entra por el contrato, así que hay que avisar a `credit-coins`
//  (kind "daily") para que lo reenvíe al pot con `fundPot`.
//
//  Al jugador no le cambia nada: la pista ya se mostró. Si el aviso falla,
//  el hash queda en localStorage y se reintenta al abrir la app — el servidor
//  es idempotente por hash, reintentar nunca reenvía dos veces.
// ============================================================

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPA_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const PENDING_KEY = "frontle-daily-pay-pending";
// Un hash que el servidor nunca acepte no debe quedarse para siempre.
const PENDING_MAX = 20;

function pendingList(): string[] {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(PENDING_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function savePending(list: string[]): void {
  try {
    if (list.length) localStorage.setItem(PENDING_KEY, JSON.stringify(list.slice(-PENDING_MAX)));
    else localStorage.removeItem(PENDING_KEY);
  } catch {}
}

/** Guarda el hash ANTES de esperar el receipt: si esa espera se cae, el pago ya salió. */
export function rememberDailyPayment(txHash: string): void {
  const list = pendingList();
  if (!list.includes(txHash)) savePending([...list, txHash]);
}

// true = el servidor lo registró (o lo rechazó para siempre): sale de la lista.
async function report(txHash: string): Promise<boolean> {
  if (!SUPA_URL || !SUPA_KEY) return false;
  try {
    const r = await fetch(`${SUPA_URL}/functions/v1/credit-coins`, {
      method: "POST",
      headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ txHash, kind: "daily" }),
    });
    // 404 = aún sin confirmar; 5xx = fallo del servidor → reintentar luego.
    // 400 = la tx no es un pago válido: reintentarla no la arreglaría.
    return r.ok || r.status === 400;
  } catch {
    return false;
  }
}

/** Avisa de un pago ya confirmado. No lanza nunca. */
export async function reportDailyPayment(txHash: string): Promise<void> {
  rememberDailyPayment(txHash);
  if (await report(txHash)) savePending(pendingList().filter((t) => t !== txHash));
}

/** Reintenta los avisos pendientes (llamar al abrir la app). No lanza nunca. */
export async function retryDailyPayments(): Promise<void> {
  const list = pendingList();
  if (list.length === 0) return;
  const left: string[] = [];
  for (const tx of list) if (!(await report(tx))) left.push(tx);
  savePending(left);
}
