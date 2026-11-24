// deno test identity_test.ts
import { CLAIMS_PER_IP_HOUR, IDENTITY_TAG, makeIdentity, type ProofTx, sha256Hex } from "./identity.ts";

const USDT = "0x48065fbbe25f71c9282ddf5e1cd6d6a887483d5e";
const TREASURY = "0x54e83c8d7b7a77cbf0a2842c1a82d51be8814dd0";
const ALICE = "0x" + "a".repeat(40);
const BOB = "0x" + "b".repeat(40);
const SECRET = "secreto-de-alice-123";
const OTHER = "secreto-del-atacante";
const TX = "0x" + "1".repeat(64);
const NOW = new Date("2026-11-22T20:00:00Z");

function eq(a: unknown, b: unknown, msg: string) {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${msg}: ${JSON.stringify(a)} !== ${JSON.stringify(b)}`);
}

function world(txs: Record<string, ProofTx> = {}) {
  const secrets = new Map<string, string>();
  const claims: { ip: string; at: string }[] = [];
  const proofs = new Set<string>();
  const handle = makeIdentity({
    usdt: USDT,
    treasury: TREASURY,
    now: () => NOW,
    readTx: (h) => Promise.resolve(txs[h] ?? null),
    store: {
      secretHash: (p) => Promise.resolve(secrets.get(p) ?? null),
      insertSecret: (p, h) => Promise.resolve(void (secrets.has(p) || secrets.set(p, h))),
      setSecret: (p, h) => Promise.resolve(void secrets.set(p, h)),
      claimsFromIp: (ip, since) => Promise.resolve(claims.filter((c) => c.ip === ip && c.at >= since).length),
      logClaim: (ip) => Promise.resolve(void claims.push({ ip, at: NOW.toISOString() })),
      useProof: (tx) => Promise.resolve(proofs.has(tx) ? false : (proofs.add(tx), true)),
    },
  });
  return { secrets, call: (a: string, b: Record<string, unknown>, ip = "ip1") => handle(a, b, ip).then((r) => r!) };
}

async function proofInput(secret: string, to = TREASURY): Promise<string> {
  const h = await sha256Hex(secret);
  return "0xa9059cbb" + to.slice(2).padStart(64, "0") + "0".repeat(64) + IDENTITY_TAG + h + "deadbeef"; // + atribución
}

Deno.test("el primero que registra se queda la wallet; el segundo no", async () => {
  const w = world();
  eq((await w.call("claim_secret", { player: ALICE, secret: SECRET })).body, { ok: true, mine: true }, "primero");
  eq((await w.call("claim_secret", { player: ALICE, secret: SECRET })).body, { ok: true, mine: true }, "mismo dispositivo");
  eq((await w.call("claim_secret", { player: ALICE, secret: OTHER })).body, { ok: true, mine: false }, "otro dispositivo");
});

Deno.test("una IP no puede registrar cientos de wallets", async () => {
  const w = world();
  for (let i = 0; i < CLAIMS_PER_IP_HOUR; i++) {
    const p = "0x" + i.toString(16).padStart(40, "0");
    eq((await w.call("claim_secret", { player: p, secret: OTHER })).status, 200, `registro ${i}`);
  }
  const r = await w.call("claim_secret", { player: ALICE, secret: OTHER });
  eq([r.status, r.body.error], [429, "rate_limited"], "pasado el tope");
  eq((await w.call("claim_secret", { player: ALICE, secret: SECRET }, "ip2")).body.mine, true, "otra IP sí puede");
});

Deno.test("una wallet ya registrada no gasta tope", async () => {
  const w = world();
  await w.call("claim_secret", { player: ALICE, secret: SECRET });
  for (let i = 0; i < CLAIMS_PER_IP_HOUR + 5; i++) {
    eq((await w.call("claim_secret", { player: ALICE, secret: SECRET })).status, 200, `confirmación ${i}`);
  }
});

Deno.test("el dueño recupera su wallet con la tx de prueba", async () => {
  const w = world({ [TX]: { from: ALICE, to: USDT, input: await proofInput(SECRET), success: true, timestampS: NOW.getTime() / 1000 - 60 } });
  await w.call("claim_secret", { player: ALICE, secret: OTHER }); // el atacante llegó primero
  eq((await w.call("recover_secret", { player: ALICE, secret: SECRET, tx: TX })).body, { ok: true }, "recupera");
  eq((await w.call("claim_secret", { player: ALICE, secret: SECRET })).body.mine, true, "ahora es suyo");
  eq((await w.call("claim_secret", { player: ALICE, secret: OTHER })).body.mine, false, "el atacante ya no");
  eq((await w.call("recover_secret", { player: ALICE, secret: SECRET, tx: TX })).body.error, "proof_used", "una sola vez");
});

Deno.test("la prueba no sirve para otra wallet, otro secret ni otro destino", async () => {
  const fresh = NOW.getTime() / 1000 - 60;
  const w = world({
    [TX]: { from: ALICE, to: USDT, input: await proofInput(SECRET), success: true, timestampS: fresh },
    ["0x" + "2".repeat(64)]: { from: ALICE, to: USDT, input: await proofInput(SECRET, BOB), success: true, timestampS: fresh },
    ["0x" + "3".repeat(64)]: { from: ALICE, to: BOB, input: await proofInput(SECRET), success: true, timestampS: fresh },
    ["0x" + "4".repeat(64)]: { from: ALICE, to: USDT, input: await proofInput(SECRET), success: false, timestampS: fresh },
    ["0x" + "5".repeat(64)]: { from: ALICE, to: USDT, input: await proofInput(SECRET), success: true, timestampS: fresh - 3 * 3600 },
  });
  eq((await w.call("recover_secret", { player: BOB, secret: SECRET, tx: TX })).body.error, "not_your_tx", "wallet ajena");
  eq((await w.call("recover_secret", { player: ALICE, secret: OTHER, tx: TX })).body.error, "not_a_proof", "otro secret");
  eq((await w.call("recover_secret", { player: ALICE, secret: SECRET, tx: "0x" + "2".repeat(64) })).body.error, "not_a_proof", "no va a la tesorería");
  eq((await w.call("recover_secret", { player: ALICE, secret: SECRET, tx: "0x" + "3".repeat(64) })).body.error, "not_a_proof", "no es USDT");
  eq((await w.call("recover_secret", { player: ALICE, secret: SECRET, tx: "0x" + "4".repeat(64) })).body.error, "tx_failed", "tx fallida");
  eq((await w.call("recover_secret", { player: ALICE, secret: SECRET, tx: "0x" + "5".repeat(64) })).body.error, "proof_expired", "vieja");
  eq((await w.call("recover_secret", { player: ALICE, secret: SECRET, tx: "0x" + "6".repeat(64) })).body.error, "tx_not_found", "no existe");
});

Deno.test("otras acciones no son de identidad", async () => {
  const w = world();
  const r = await makeIdentity({ usdt: USDT, treasury: TREASURY, readTx: () => Promise.resolve(null), store: {} as never })("rush_status", {}, "ip");
  eq(r, null, "devuelve null");
  eq((await w.call("claim_secret", { player: ALICE, secret: "corto" })).body.error, "bad_secret", "secret corto");
});
