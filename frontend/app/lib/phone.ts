// ============================================================
//  Frontle — ¿Wallet con teléfono verificado en MiniPay?
//
//  MiniPay registra on-chain (contrato FederatedAttestations) qué wallets
//  verificaron un número de teléfono, bajo su propio emisor. Es la mejor señal
//  de "una persona = una cuenta" que tenemos sin pedir nada al usuario: el
//  98% de los jugadores la tiene y las cuentas falsas del 3-nov-2026 no.
//
//  Para el reto diario y la liga se exige (los cierres lo comprueban también
//  en el servidor). Llamada eth_call a mano para no meter viem en el bundle
//  inicial: el selector y la codificación son fijos.
// ============================================================

const RPC = "https://forno.celo.org";
const FEDERATED_ATTESTATIONS = "0x0aD5b1d0C25ecF6266Dd951403723B2687d6aff2";
const MINIPAY_ISSUER = "7888612486844bb9be598668081c59a9f7367fbc";
const LOOKUP_IDENTIFIERS = "0x6125a6c2"; // lookupIdentifiers(address,address[])

const word = (hex: string) => hex.padStart(64, "0");

// true/false según la cadena; null si no se pudo consultar (red caída): en ese
// caso no se bloquea a nadie — los cierres vuelven a comprobarlo al pagar.
export async function hasMiniPayPhone(address: string): Promise<boolean | null> {
  const addr = address.toLowerCase().replace(/^0x/, "");
  if (!/^[0-9a-f]{40}$/.test(addr)) return null;
  // (address account, address[] trustedIssuers=[MINIPAY_ISSUER])
  const data = LOOKUP_IDENTIFIERS + word(addr) + word("40") + word("1") + word(MINIPAY_ISSUER);
  try {
    const r = await fetch(RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ to: FEDERATED_ATTESTATIONS, data }, "latest"] }),
    });
    const j = await r.json();
    const out: string = j?.result ?? "";
    if (!out.startsWith("0x") || out.length < 2 + 64 * 2) return null;
    const body = out.slice(2);
    // Devuelve (uint256[] countsPerIssuer, bytes32[] identifiers): el primer
    // word es el offset del array de conteos; ahí van su longitud y el valor.
    const off = parseInt(body.slice(0, 64), 16) * 2;
    const len = parseInt(body.slice(off, off + 64), 16);
    if (len < 1) return false;
    return BigInt("0x" + body.slice(off + 64, off + 128)) > BigInt(0);
  } catch {
    return null;
  }
}
