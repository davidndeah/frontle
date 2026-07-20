"use client";

// ============================================================
//  Frontle v2 — Liga semanal (Fase 1: ranking en seco, sin premio)
//  Muestra el top de XP de la semana en curso + tu posición + countdown
//  al cierre (lunes 00:00 UTC). El premio llega en la Fase 4 (contrato
//  FrontleWeekly); mientras tanto el copy lo deja claro (temporada de
//  prueba) para no prometer dinero que aún no se reparte.
// ============================================================

import { useEffect, useState } from "react";
import type { t } from "../lib/i18n";
import { getNamesFor, shortId } from "../lib/ranking";
import { getWeeklyRanking, xpPlayerId, msToWeekClose, type WeeklyEntry } from "../lib/xp";

function fmtClose(ms: number): string {
  const totalH = Math.max(0, Math.floor(ms / 3_600_000));
  const d = Math.floor(totalH / 24);
  const h = totalH % 24;
  return d > 0 ? `${d}d ${h}h` : `${h}h`;
}

export default function WeeklyLeague({ tr }: { tr: ReturnType<typeof t> }) {
  const [entries, setEntries] = useState<WeeklyEntry[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(false);
  const me = xpPlayerId();

  useEffect(() => {
    let alive = true;
    getWeeklyRanking().then(async (rows) => {
      if (!alive) return;
      setEntries(rows);
      setLoaded(true);
      const n = await getNamesFor(rows.map((r) => r.playerId));
      if (alive) setNames(n);
    });
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

      {loaded && entries.length === 0 && (
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
