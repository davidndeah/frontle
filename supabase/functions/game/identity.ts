// ============================================================
//  Frontle — Identidad del dispositivo (el `secret` de lib/secret.ts)
//
//  El secret liga una wallet a un dispositivo: lo exigen el gasto de monedas,
//  los congeladores de racha y Flag Rush. MiniPay prohíbe `personal_sign`, así
//  que no hay firma con la que probar que la wallet es tuya al registrarlo.
//
//   · {action:"claim_secret", player, secret} → {mine}
//       Primera escritura gana, como antes (claim_player_secret), pero ahora
//       por aquí y con un tope de registros NUEVOS por IP y hora: sin él, un
//       script registraba el secret de cientos de wallets ajenas (salen en el
//       ranking) y las dejaba sin poder gastar ni jugar Flag Rush.
//       `mine` = el secret de esa wallet es este (recién creado o de antes).
//
//   · {action:"recover_secret", player, secret, tx} → {ok}
//       Recuperar la wallet en este dispositivo sin comprar monedas: `tx` es
//       un USDT.transfer de 0 a la tesorería hecho POR esa wallet, con la
//       etiqueta IDENTITY_TAG y el sha256 del secret al final del calldata.
//       Solo el dueño de la wallet puede emitirla, y liga ESE secret y no
//       otro. Cuesta la comisión de red y una confirmación.
// ============================================================

export const IDENTITY_TAG = "4652544c05"; // "FRTL" + propósito 05 = identidad
export const CLAIMS_PER_IP_HOUR = 20; // margen para muchos jugadores tras una misma IP (redes móviles)
export const PROOF_MAX_AGE_S = 2 * 3600;

const WALLET = /^0x[0-9a-f]{40}$/;
const TX = /^0x[0-9a-f]{64}$/;
const TRANSFER_SELECTOR = "0xa9059cbb";
// transfer(address,uint256) = 4 + 32 + 32 bytes. La etiqueta va justo después
// (posición fija: detrás puede venir la atribución ERC-8021 de Celo).
const TRANSFER_INPUT_LEN = 2 + (4 + 64) * 2;

export interface IdentityStore {
  secretHash(player: string): Promise<string | null>;
  /** Inserta si no hay ninguno (on conflict do nothing). */
  insertSecret(player: string, hash: string): Promise<void>;
  /** Reemplaza el de la wallet (recuperación). */
  setSecret(player: string, hash: string): Promise<void>;
  claimsFromIp(ipHash: string, sinceIso: string): Promise<number>;
  logClaim(ipHash: string, player: string): Promise<void>;
  /** false si esa tx ya se usó para recuperar. */
  useProof(tx: string, player: string): Promise<boolean>;
}

export interface ProofTx {
  from: string;
  to: string | null;
  input: string;
  success: boolean;
  timestampS: number;
}

export interface IdentityDeps {
  store: IdentityStore;
  readTx: (hash: string) => Promise<ProofTx | null>;
  usdt: string;
  treasury: string;
  now?: () => Date;
}

type Reply = { status: number; body: Record<string, unknown> };
const ok = (body: Record<string, unknown> = {}): Reply => ({ status: 200, body: { ok: true, ...body } });
const fail = (error: string, status = 400): Reply => ({ status, body: { ok: false, error } });

export async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

const goodSecret = (s: unknown): s is string => typeof s === "string" && s.length >= 16 && s.length <= 200;

// ¿El calldata es transfer(treasury, x) seguido de IDENTITY_TAG + hash?
export function proofMatches(input: string, treasury: string, hash: string): boolean {
  const d = input.toLowerCase();
  if (!d.startsWith(TRANSFER_SELECTOR)) return false;
  const to = d.slice(10 + 24, 10 + 64);
  if (`0x${to}` !== treasury.toLowerCase()) return false;
  const tag = d.slice(TRANSFER_INPUT_LEN, TRANSFER_INPUT_LEN + IDENTITY_TAG.length);
  const h = d.slice(TRANSFER_INPUT_LEN + IDENTITY_TAG.length, TRANSFER_INPUT_LEN + IDENTITY_TAG.length + 64);
  return tag === IDENTITY_TAG && h === hash;
}

export function makeIdentity({ store, readTx, usdt, treasury, now = () => new Date() }: IdentityDeps) {
  return async function handle(action: string, body: Record<string, unknown>, ipHash: string): Promise<Reply | null> {
    if (action === "claim_secret") {
      const player = String(body.player ?? "").toLowerCase();
      if (!WALLET.test(player)) return fail("bad_player");
      if (!goodSecret(body.secret)) return fail("bad_secret");
      const h = await sha256Hex(body.secret);
      const existing = await store.secretHash(player);
      if (existing) return ok({ mine: existing === h });

      const since = new Date(now().getTime() - 3600_000).toISOString();
      if ((await store.claimsFromIp(ipHash, since)) >= CLAIMS_PER_IP_HOUR) return fail("rate_limited", 429);
      await store.insertSecret(player, h);
      await store.logClaim(ipHash, player);
      // Dos dispositivos a la vez: gana el primero que llegó a la base.
      return ok({ mine: (await store.secretHash(player)) === h });
    }

    if (action === "recover_secret") {
      const player = String(body.player ?? "").toLowerCase();
      const tx = String(body.tx ?? "").toLowerCase();
      if (!WALLET.test(player)) return fail("bad_player");
      if (!goodSecret(body.secret)) return fail("bad_secret");
      if (!TX.test(tx)) return fail("bad_tx");
      const h = await sha256Hex(body.secret);

      const t = await readTx(tx);
      if (!t) return fail("tx_not_found", 404);
      if (!t.success) return fail("tx_failed");
      if (t.from.toLowerCase() !== player) return fail("not_your_tx", 403);
      if ((t.to ?? "").toLowerCase() !== usdt.toLowerCase()) return fail("not_a_proof");
      if (!proofMatches(t.input, treasury, h)) return fail("not_a_proof");
      if (t.timestampS < now().getTime() / 1000 - PROOF_MAX_AGE_S) return fail("proof_expired");
      if (!(await store.useProof(tx, player))) return fail("proof_used", 409);

      await store.setSecret(player, h);
      return ok();
    }

    return null;
  };
}
