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
import GlobeLoader, { withMinDelay } from "./GlobeLoader";
import { Podium, RankRow, RANK_GRID, type LeaderEntry } from "./Leaderboard";

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
      const rows = await withMinDelay(getWeeklyRanking());
      if (!alive) return;
      setEntries(rows);
      setLoaded(true);
      const n = await getNamesFor(rows.map((r) => r.playerId));
      if (alive) setNames(n);
      // Sin esto un fallo dejaría el loader girando para siempre. Marcar
      // `loaded` enseña la tabla vacía, que al menos es un final.
    })().catch(() => alive && setLoaded(true));
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
  // El podio son los 3 primeros; el resto va como tabla, hasta el 10.º.
  const podium = entries.slice(0, 3);
  const rest = entries.slice(3, 10);

  // Premio de cada puesto del podio. Solo hay premio que enseñar si el pot
  // existe y tiene fondos; con 0 sembrado, prometerlo sería mentir.
  const premioTotal = pot ?? 0;
  const conPremio = premioTotal > 0;
  const premioDe = (i: number) => (premioTotal * WEEKLY_PODIUM_SHARE[i]) / 100;

  // Traduce una fila de la liga al modelo común del leaderboard. `pos` es el
  // índice global (0 = primero) y solo sirve para saber si toca premio.
  const toEntry = (e: WeeklyEntry, pos: number): LeaderEntry => {
    const mine = e.playerId === me;
    // Nombre de perfil si lo hay; si no, la dirección truncada — MiniPay la
    // admite como pista secundaria, nunca como identidad principal.
    const name = names[e.playerId] || shortId(e.playerId);
    return {
      id: e.playerId,
      label: mine ? tr.liga.youNamed(name) : name,
      mine,
      stat: (
        <>
          {e.xp} <span className="text-[10px] opacity-70">XP</span>
        </>
      ),
      sub: conPremio && pos < WEEKLY_PODIUM_SHARE.length ? fmt(premioDe(pos)) : undefined,
    };
  };

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
          {/* Bloque de acento macizo, no un tinte: el premio es lo que hay
              que ver primero al abrir la liga. */}
          <p className="brutal-sm rounded-lg bg-gold px-3 py-2 text-center text-sm font-black text-surface">
            {tr.liga.prize(fmt(premioTotal))}
          </p>
          <div className="grid grid-cols-3 gap-1.5">
            {WEEKLY_PODIUM_SHARE.map((_, i) => (
              <div key={i} className="brutal-sm rounded-lg bg-surface px-2 py-1.5 text-center">
                {/* Mismo distintivo que el podio (nº en círculo), para que las
                    dos lecturas del reparto se reconozcan entre sí. */}
                <span
                  className={`mx-auto grid h-5 w-5 place-items-center rounded-full border-2 border-deep font-display text-[10px] font-black text-surface ${
                    i === 0 ? "bg-gold" : "bg-lavender"
                  }`}
                >
                  {i + 1}
                </span>
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

      {/* La tabla es de todos, se compita o no, así que el loader tampoco
          depende de `joined`: sin él la liga aparecía en blanco hasta que
          llegaba la consulta. */}
      {!loaded && <GlobeLoader label={tr.liga.loading} size="sm" className="py-3" />}

      {joined && loaded && entries.length === 0 && (
        <p className="text-sm text-neutral-300 text-center py-3">{tr.liga.empty}</p>
      )}

      {/* Podio (1-3). El escalonado y el orden del DOM los resuelve Podium. */}
      {podium.length > 0 && <Podium items={podium.map((e, i) => toEntry(e, i))} />}

      {/* --- Tabla (4 en adelante) ------------------------------------------
          Una card por jugador en el lenguaje neo-brutalista que la app ya usa
          en botones y niveles: borde grueso, sombra dura desplazada, esquinas
          poco redondeadas. La fila propia va en bloque dorado sólido (no un
          tinte al 10%): en la referencia el acento es macizo, y así se
          encuentra sin buscarla. */}
      {rest.length > 0 && (
        <div className="mt-2 flex flex-col gap-1.5">
          <div className={`${RANK_GRID} px-2 text-[10px] uppercase tracking-widest text-neutral-400`}>
            <span>{tr.liga.colRank}</span>
            <span>{tr.colPlayer}</span>
            <span className="text-right">{tr.liga.colPoints}</span>
          </div>
          <ol className="flex flex-col gap-1.5">
            {rest.map((e, i) => (
              <RankRow key={e.playerId} pos={i + 4} entry={toEntry(e, i + 3)} />
            ))}
          </ol>
        </div>
      )}

      {/* Tu fila, si quedaste fuera del top visible. Se separa con un “···”
          para que no se lea como el puesto siguiente al último de la tabla. */}
      {myIndex >= 10 && (
        <div className="mt-1.5 flex flex-col gap-1.5">
          <p className="text-center text-xs leading-none text-neutral-500" aria-hidden>
            ···
          </p>
          <RankRow pos={myIndex + 1} entry={toEntry(entries[myIndex], myIndex)} />
        </div>
      )}
    </section>
  );
}
