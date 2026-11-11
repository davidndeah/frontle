import { unstable_cache } from "next/cache";
import CountUp from "./CountUp";
import { getTxTotal } from "../lib/onchain";
import { CONTRACT_INFO, COIN_TREASURY } from "../lib/payments";
import type { Locale } from "../lib/i18n";

// ============================================================
//  Las dos cifras vivas de la landing, resueltas EN EL SERVIDOR
//
//  · Transacciones: contratos + pagos directos a la tesorería, con la misma
//    definición que /stats pero contando el historial entero (`getTxTotal`).
//  · Jugadores: TODA persona que ha jugado algún modo —reto diario, regiones,
//    quiz o práctica—, no solo el diario: vista `landing_stats` (migración
//    0032), que une `scores` con `xp_events`.
//
//  Por qué aquí y no en el navegador: contar las transacciones son ~15
//  peticiones paginadas a Blockscout. Hacerlas en cada visita (y en cada
//  recarga) es lento para quien entra y castiga a Blockscout. Con
//  `unstable_cache` se calculan una vez y se sirven a todos durante un
//  día; pasado el día se sirve la cifra guardada y se recalcula por
//  detrás, así que nadie vuelve a esperar.
//
//  La página no espera por ellas: van dentro de un <Suspense> (ver page.tsx),
//  así que el resto del HTML sale al instante y las cifras llegan en el mismo
//  stream en cuanto están — sin esperar a hidratar ni a un efecto del cliente.
// ============================================================

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPA_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Los mismos contratos que suma /stats; el semanal solo si está desplegado.
const CONTRACTS = [
  CONTRACT_INFO.address,
  CONTRACT_INFO.addressV1,
  ...(CONTRACT_INFO.addressWeekly ? [CONTRACT_INFO.addressWeekly] : []),
];

// Un fallo LANZA en vez de devolver null: unstable_cache no guarda una
// ejecución que lanza, así que un mal momento de Blockscout o Supabase no deja
// una raya clavada durante un día — la siguiente visita lo reintenta.
const cachedTxTotal = unstable_cache(
  async () => {
    const r = await getTxTotal(CONTRACTS, COIN_TREASURY);
    if (!r) throw new Error("tx total no disponible");
    return r;
  },
  ["landing-tx-total"],
  { revalidate: 86400 },
);

const cachedPlayers = unstable_cache(
  async () => {
    if (!SUPA_URL || !SUPA_KEY) throw new Error("Supabase sin configurar");
    const r = await fetch(`${SUPA_URL}/rest/v1/landing_stats?select=players`, {
      headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
    });
    if (!r.ok) throw new Error(`landing_stats ${r.status}`);
    const j = await r.json();
    const n = Array.isArray(j) && j[0] ? Number(j[0].players) : NaN;
    if (!Number.isFinite(n)) throw new Error("landing_stats sin dato");
    return n;
  },
  ["landing-players"],
  { revalidate: 86400 },
);

const settle = <T,>(p: Promise<T>) => p.catch(() => null);

export default async function LiveFacts({
  locale,
  txLabel,
  playersLabel,
}: {
  locale: Locale;
  txLabel: string;
  playersLabel: string;
}) {
  const [tx, players] = await Promise.all([settle(cachedTxTotal()), settle(cachedPlayers())]);

  return (
    <>
      <div className="fact card">
        <p className="n">
          {/* Si se alcanzó el tope de páginas el total es un piso: "1.234+". */}
          {tx ? <CountUp value={tx.total} locale={locale} suffix={tx.truncated ? "+" : ""} /> : <Missing />}
        </p>
        <p className="k">{txLabel}</p>
      </div>
      <div className="fact card">
        <p className="n">{players !== null ? <CountUp value={players} locale={locale} /> : <Missing />}</p>
        <p className="k">{playersLabel}</p>
      </div>
    </>
  );
}

// Mientras el servidor calcula: un hueco marcado, nunca un número de relleno.
// Una página pública no puede llevar una cifra inventada ni un instante.
export function LiveFactsFallback({
  txLabel,
  playersLabel,
  pending,
}: {
  txLabel: string;
  playersLabel: string;
  pending: string;
}) {
  return (
    <>
      <div className="fact card">
        <p className="n">
          <span className="slot">{pending}</span>
        </p>
        <p className="k">{txLabel}</p>
      </div>
      <div className="fact card">
        <p className="n">
          <span className="slot">{pending}</span>
        </p>
        <p className="k">{playersLabel}</p>
      </div>
    </>
  );
}

// La fuente no contestó: una raya, no "cargando" para siempre.
function Missing() {
  return <span style={{ opacity: 0.35 }}>—</span>;
}
