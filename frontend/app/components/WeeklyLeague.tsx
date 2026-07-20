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
import { getNamesFor, shortId } from "../lib/ranking";
import { getWeeklyRanking, hasLeagueIdentity, msToWeekClose, xpPlayerId, type WeeklyEntry } from "../lib/xp";

function fmtClose(ms: number): string {
  const totalH = Math.max(0, Math.floor(ms / 3_600_000));
  const d = Math.floor(totalH / 24);
  const h = totalH % 24;
  return d > 0 ? `${d}d ${h}h` : `${h}h`;
}

export default function WeeklyLeague({ tr, onConnect }: { tr: ReturnType<typeof t>; onConnect?: () => void }) {
  const [entries, setEntries] = useState<WeeklyEntry[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(false);
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

  const myIndex = entries.findIndex((e) => e.playerId === me);
  const medals = ["🥇", "🥈", "🥉"];

  return (
    <section className="panel p-4 flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-display font-bold text-white">⚡ {tr.liga.title}</h2>
        <span className="text-[11px] font-mono text-neutral-300">🕒 {tr.liga.closes(fmtClose(msToWeekClose()))}</span>
      </div>

      <p className="text-[11px] text-neutral-400">{tr.liga.dry}</p>

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
                className={`flex items-center gap-2 py-1.5 px-2 rounded-lg ${mine ? "bg-[#fcff52]/10 border border-[#fcff52]/30" : ""}`}
              >
                <span className="w-7 text-center text-sm flex-none">{medals[i] ?? `${i + 1}`}</span>
                <span className={`flex-1 truncate text-sm ${mine ? "text-amber-100 font-semibold" : "text-neutral-200"}`}>
                  {mine ? tr.liga.you : names[e.playerId] || shortId(e.playerId)}
                </span>
                <span className="font-mono tabular-nums text-sm text-white flex-none">
                  {e.xp} <span className="text-[10px] text-neutral-400">XP</span>
                </span>
              </li>
            );
          })}
        </ol>
      )}

      {/* Tu fila, si no estás en el top visible */}
      {myIndex >= 10 && (
        <div className="flex items-center gap-2 py-1.5 px-2 rounded-lg bg-[#fcff52]/10 border border-[#fcff52]/30">
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
