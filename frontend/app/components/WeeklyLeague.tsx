"use client";

// ============================================================
//  Frontle v2 — Liga semanal (un solo ranking global)
//  Se reinicia cada lunes y premia a los 3 primeros por XP. El XP se gana
//  jugando: cuanto más juegas (y mejor resuelves), más alto llegas.
//
//  Entrar exige wallet, igual que el ranking diario: sin ella se muestra el
//  CTA de conectar (jugar sigue siendo libre; competir es lo que requiere
//  identidad).
// ============================================================

import { useEffect, useState } from "react";
import type { t } from "../lib/i18n";
import { getWeeklyPot, WEEKLY_PODIUM_SHARE } from "../lib/payments";
import { getNamesFor, shortId } from "../lib/ranking";
import { getWeeklyRanking, hasLeagueIdentity, msToWeekClose, xpPlayerId, type WeeklyEntry } from "../lib/xp";

function fmtClose(ms: number): string {
  const totalH = Math.max(0, Math.floor(ms / 3_600_000));
  const d = Math.floor(totalH / 24);
  const h = totalH % 24;
  return d > 0 ? `${d}d ${h}h` : `${h}h`;
}

export default function WeeklyLeague({
  tr,
  fmt,
  onConnect,
}: {
  tr: ReturnType<typeof t>;
  /** Formateador de dinero de page.tsx (respeta la moneda elegida). */
  fmt: (usdt: number) => string;
  onConnect?: () => void;
}) {
  const [entries, setEntries] = useState<WeeklyEntry[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(false);
  const [pot, setPot] = useState<number | null>(null);
  const joined = hasLeagueIdentity();
  const me = xpPlayerId();

  useEffect(() => {
    let alive = true;
    (async () => {
      const rows = await getWeeklyRanking();
      if (!alive) return;
      setEntries(rows);
      setLoaded(true);
      const n = await getNamesFor(rows.map((r) => r.playerId));
      if (alive) setNames(n);
    })();
    return () => {
      alive = false;
    };
  }, []);

  // El pot vive en otro contrato (FrontleWeekly) y se lee aparte: si aún no
  // está desplegado devuelve null y la liga sigue mostrándose "en seco".
  useEffect(() => {
    let alive = true;
    void getWeeklyPot().then((p) => {
      if (alive) setPot(p);
    });
    return () => {
      alive = false;
    };
  }, []);

  const myIndex = entries.findIndex((e) => e.playerId === me);
  const medals = ["🥇", "🥈", "🥉"];
  // Premio de cada puesto del podio. Solo hay premio que enseñar si el pot
  // existe y tiene fondos; con 0 sembrado, prometerlo sería mentir.
  const premioTotal = pot ?? 0;
  const conPremio = premioTotal > 0;
  const premioDe = (i: number) => (premioTotal * WEEKLY_PODIUM_SHARE[i]) / 100;

  return (
    <section className="panel p-4 flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-display font-bold text-white">⚡ {tr.liga.title}</h2>
        <span className="text-[11px] font-mono text-neutral-300">🕒 {tr.liga.closes(fmtClose(msToWeekClose()))}</span>
      </div>

      {/* Premio de la semana. Mientras el pot no exista (contrato sin
          desplegar) o esté vacío, se mantiene el aviso de temporada seca. */}
      {conPremio ? (
        <>
          <p className="rounded-xl border border-gold/30 bg-gold/10 px-3 py-2 text-center text-sm font-bold text-amber-300">
            {tr.liga.prize(fmt(premioTotal))}
          </p>
          <div className="grid grid-cols-3 gap-1.5">
            {WEEKLY_PODIUM_SHARE.map((_, i) => (
              <div key={i} className="rounded-xl border border-lavender/20 bg-base px-2 py-1.5 text-center">
                <div className="text-base leading-none">{medals[i]}</div>
                <div className="mt-1 font-mono tabular-nums text-xs font-bold text-amber-300">{fmt(premioDe(i))}</div>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-neutral-400">{tr.liga.split}</p>
        </>
      ) : (
        <p className="text-[11px] text-neutral-400">{tr.liga.dry}</p>
      )}

      {/* Sin wallet no se compite (misma regla del ranking diario) */}
      {!joined && (
        <div className="flex flex-col items-center gap-2 py-2">
          <p className="text-sm text-neutral-200 text-center">{tr.liga.needWallet}</p>
          {onConnect && (
            <button
              onClick={onConnect}
              className="brutal-sm brutal-press rounded-lg bg-[#34d399] px-4 py-2 text-xs font-bold text-[#053b27]"
            >
              {tr.connectWallet}
            </button>
          )}
        </div>
      )}

      {joined && loaded && entries.length === 0 && (
        <p className="text-sm text-neutral-300 text-center py-3">{tr.liga.empty}</p>
      )}

      {entries.length > 0 && (
        <ol className="flex flex-col">
          {entries.slice(0, 10).map((e, i) => {
            const mine = e.playerId === me;
            return (
              <li
                key={e.playerId}
                className={`flex items-center gap-2 py-1.5 px-2 rounded-lg ${mine ? "bg-gold/10 border border-gold/30" : ""}`}
              >
                <span className="w-7 text-center text-sm flex-none">{medals[i] ?? `${i + 1}`}</span>
                <span className={`flex-1 truncate text-sm ${mine ? "text-amber-100 font-semibold" : "text-neutral-200"}`}>
                  {mine ? tr.liga.you : names[e.playerId] || shortId(e.playerId)}
                </span>
                <span className="flex flex-col items-end flex-none leading-tight">
                  <span className="font-mono tabular-nums text-sm text-white">
                    {e.xp} <span className="text-[10px] text-neutral-400">XP</span>
                  </span>
                  {/* Lo que se lleva HOY quien va en ese puesto del podio. */}
                  {conPremio && i < WEEKLY_PODIUM_SHARE.length && (
                    <span className="font-mono tabular-nums text-[10px] font-bold text-amber-300">{fmt(premioDe(i))}</span>
                  )}
                </span>
              </li>
            );
          })}
        </ol>
      )}

      {/* Tu fila, si no estás en el top visible */}
      {myIndex >= 10 && (
        <div className="flex items-center gap-2 py-1.5 px-2 rounded-lg bg-gold/10 border border-gold/30">
          <span className="w-7 text-center text-sm flex-none">{myIndex + 1}</span>
          <span className="flex-1 truncate text-sm text-amber-100 font-semibold">{tr.liga.you}</span>
          <span className="font-mono tabular-nums text-sm text-white flex-none">
            {entries[myIndex].xp} <span className="text-[10px] text-neutral-400">XP</span>
          </span>
        </div>
      )}
    </section>
  );
}
