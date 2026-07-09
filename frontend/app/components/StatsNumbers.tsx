"use client";

import { useEffect, useState } from "react";
import { getPublicStats, type PublicStats } from "../lib/payments";
import { getCommunityStats, type CommunityStats } from "../lib/ranking";

// El cuerpo de /stats: tres secciones de métricas (Hoy · Comunidad · Economía).
// Los números salen del contrato (RPC público) y de la vista `public_stats`
// de Supabase. Ninguna de las dos fuentes necesita wallet ni claves privadas.
export default function StatsNumbers() {
  const [chain, setChain] = useState<PublicStats | null>(null);
  const [community, setCommunity] = useState<CommunityStats | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    Promise.all([getPublicStats(), getCommunityStats()]).then(([c, s]) => {
      setChain(c);
      setCommunity(s);
      setDone(true);
    });
  }, []);

  const usdt = (n: number) =>
    n.toLocaleString("es", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const num = (n: number) => n.toLocaleString("es");

  return (
    <div className="flex flex-col gap-6">
      <Section title="Hoy" aside={chain ? `día #${chain.day} · UTC` : undefined} cols={3}>
        <Stat label="Premio" value={chain && usdt(chain.potToday)} unit="USDT" done={done} />
        <Stat label="Partidas" value={community && num(community.playsToday)} done={done} />
        <Stat label="Jugadores" value={community && num(community.playersToday)} done={done} />
      </Section>

      <Section title="Comunidad" aside={community ? `desde el ${fmtDate(community.firstPlay)}` : undefined}>
        <Stat label="Partidas" value={community && num(community.plays)} done={done} />
        <Stat label="Jugadores" value={community && num(community.players)} done={done} />
        <Stat label="Días jugados" value={community && num(community.daysPlayed)} done={done} />
        <Stat label="Países" value={community && num(community.countriesReached)} done={done} />
      </Section>

      <Section title="Economía" aside="contratos v1 + v2">
        <Stat label="Premios repartidos" value={chain && usdt(chain.prizesPaid)} unit="USDT" done={done} />
        <Stat label="Días cerrados" value={chain && num(chain.daysClosed)} done={done} />
        <Stat
          label="Fondos de los jugadores"
          value={chain && usdt(chain.playerFunds)}
          unit="USDT"
          hint="premio de hoy + premios sin reclamar"
          done={done}
        />
        <Stat
          label="Comisión de plataforma"
          value={chain && usdt(chain.protocolFees)}
          unit="USDT"
          hint="el 20% de mantenimiento, aparte del premio"
          done={done}
        />
      </Section>
    </div>
  );
}

function fmtDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("es", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

function Section({
  title,
  aside,
  cols = 2,
  children,
}: {
  title: string;
  aside?: string;
  cols?: 2 | 3;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="flex items-baseline justify-between gap-3 mb-2 px-0.5">
        <h2 className="font-display text-xs font-bold uppercase tracking-[0.18em] text-[#c4b5fd]">{title}</h2>
        {aside && <span className="text-[10px] text-neutral-500 tabular-nums">{aside}</span>}
      </div>
      <div className={`grid gap-2 ${cols === 3 ? "grid-cols-3" : "grid-cols-2"}`}>{children}</div>
    </section>
  );
}

// `value` null = aún cargando (o la fuente no respondió, si `done`).
function Stat({
  label,
  value,
  unit,
  hint,
  done,
}: {
  label: string;
  value: string | null;
  unit?: string;
  hint?: string;
  done: boolean;
}) {
  return (
    <div className="panel p-3 flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-wider text-neutral-400 leading-tight">{label}</span>
      {value !== null ? (
        <span className="font-display text-2xl font-bold text-white tabular-nums leading-none">
          {value}
          {unit && <span className="ml-1 text-xs font-semibold text-neutral-400">{unit}</span>}
        </span>
      ) : done ? (
        <span className="font-display text-2xl font-bold text-neutral-600 leading-none">—</span>
      ) : (
        <span className="h-6 w-16 rounded bg-white/10 animate-pulse" />
      )}
      {hint && <span className="text-[10px] text-neutral-500 leading-tight">{hint}</span>}
    </div>
  );
}
