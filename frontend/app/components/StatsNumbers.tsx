"use client";

import { useEffect, useState } from "react";
import { getPublicStats, type PublicStats } from "../lib/payments";

// Las 4 métricas de /stats. Se leen del contrato por RPC público (sin wallet).
export default function StatsNumbers() {
  const [stats, setStats] = useState<PublicStats | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    getPublicStats().then((s) => (s ? setStats(s) : setFailed(true)));
  }, []);

  const usdt = (n: number) =>
    `${n.toLocaleString("es", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT`;

  return (
    <>
      <section className="grid grid-cols-2 gap-3">
        <Stat label="Premio de hoy" value={stats && usdt(stats.potToday)} failed={failed} />
        <Stat label="Fondos de los jugadores" value={stats && usdt(stats.playerFunds)} failed={failed} />
        <Stat label="Premios repartidos" value={stats && usdt(stats.prizesPaid)} failed={failed} />
        <Stat label="Días cerrados" value={stats && String(stats.daysClosed)} failed={failed} />
      </section>

      {stats && (
        <p className="text-[11px] text-neutral-500 text-center -mt-1 leading-relaxed">
          Histórico completo desde el 17 de junio de 2026, sumando los contratos v1 y v2. Día actual: #{stats.day}{" "}
          (UTC).
          <br />
          Comisión de plataforma acumulada, aparte de los fondos de los jugadores:{" "}
          <b className="text-neutral-400">{usdt(stats.protocolFees)}</b>.
        </p>
      )}
    </>
  );
}

// `value` null = aún cargando, o el RPC falló.
function Stat({ label, value, failed }: { label: string; value: string | null; failed: boolean }) {
  return (
    <div className="panel p-3 flex flex-col gap-1">
      <span className="text-[11px] text-neutral-400 leading-tight">{label}</span>
      {value !== null ? (
        <span className="font-display text-lg font-bold text-white tabular-nums leading-tight">{value}</span>
      ) : failed ? (
        <span className="text-sm text-neutral-500">No disponible</span>
      ) : (
        <span className="h-6 w-20 rounded bg-white/10 animate-pulse" />
      )}
    </div>
  );
}
