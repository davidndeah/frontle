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

import { Fragment, useEffect, useState } from "react";
import type { t } from "../lib/i18n";
import { getWeeklyPot, WEEKLY_PODIUM_SHARE } from "../lib/payments";
import { getNamesFor, shortId } from "../lib/ranking";
import { getWeeklyRanking, fmtWeekClose, getLastWeekBoard, getWeeklyStanding, hasLeagueIdentity, msToWeekClose, xpPlayerId, type LastWeekBoard, type WeeklyEntry, type WeeklyStanding } from "../lib/xp";
import GlobeLoader, { withMinDelay } from "./GlobeLoader";
import { Podium, RankRow, RANK_GRID, type LeaderEntry } from "./Leaderboard";

// Línea de corte de la zona de premio: arriba cobran, abajo no. `as="li"`
// cuando va dentro de un <ol>, oculta al lector de pantalla (es decorativa:
// el texto de la regla ya está arriba, en `top3Only` / `lastWeekNote`).
function PrizeCut({ label, as = "div" }: { label: string; as?: "div" | "li" }) {
  const Tag = as;
  return (
    <Tag aria-hidden className="my-0.5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-gold/80">
      <span className="h-0 flex-1 border-t-2 border-dashed border-gold/50" />
      {label}
      <span className="h-0 flex-1 border-t-2 border-dashed border-gold/50" />
    </Tag>
  );
}

// Filas que se enseñan (podio incluido). Más abajo solo aparece la propia.
const TOP = 20;
const MEDALS = ["🥇", "🥈", "🥉"];

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
  // Puesto propio cuando el jugador queda fuera de las filas descargadas.
  const [standing, setStanding] = useState<WeeklyStanding | null>(null);
  // Top 10 de la semana cerrada, con su podio pagado.
  const [last, setLast] = useState<LastWeekBoard | null>(null);
  const joined = hasLeagueIdentity();
  const me = xpPlayerId();

  useEffect(() => {
    let alive = true;
    (async () => {
      const rows = await withMinDelay(getWeeklyRanking(TOP));
      if (!alive) return;
      setEntries(rows);
      setLoaded(true);
      // Fuera del top no hay fila que pintar: se pide solo el puesto (dos
      // conteos), en vez de bajarse la liga entera para encontrarlo.
      if (hasLeagueIdentity() && !rows.some((r) => r.playerId === xpPlayerId())) {
        void getWeeklyStanding().then((st) => alive && setStanding(st));
      }
      // La semana pasada va después: está al final de la pantalla y no debe
      // retrasar la tabla en curso.
      const prev = await getLastWeekBoard();
      if (alive) setLast(prev);
      const n = await getNamesFor([...rows, ...(prev?.entries ?? [])].map((r) => r.playerId));
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
  // El podio son los 3 primeros; el resto va como tabla, hasta el TOP.
  const podium = entries.slice(0, 3);
  const rest = entries.slice(3, TOP);
  // Mi fila fuera del top: con 0 XP aún no compite, no se pinta.
  const mineOut: { pos: number; entry: WeeklyEntry } | null =
    myIndex >= TOP
      ? { pos: myIndex + 1, entry: entries[myIndex] }
      : myIndex < 0 && standing && standing.xp > 0
        ? { pos: standing.rank, entry: { playerId: me, xp: standing.xp } }
        : null;

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
        <span className="text-[11px] font-mono text-neutral-300">🕒 {tr.liga.closes(fmtWeekClose(msToWeekClose()))}</span>
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
          {/* Que nadie del 4.º para abajo crea que cobra: la regla va antes
              del reparto, no en la letra pequeña de debajo. */}
          <p className="text-center font-display text-xs font-bold uppercase tracking-wider text-gold">
            🏆 {tr.liga.top3Only}
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

      {/* Línea de corte: lo que queda arriba cobra, lo de abajo no. Solo con
          premio de verdad; en temporada seca no hay zona que marcar. */}
      {conPremio && rest.length > 0 && <PrizeCut label={tr.liga.prizeCut} />}

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
      {mineOut && (
        <div className="mt-1.5 flex flex-col gap-1.5">
          <p className="text-center text-xs leading-none text-neutral-500" aria-hidden>
            ···
          </p>
          <RankRow pos={mineOut.pos} entry={toEntry(mineOut.entry, mineOut.pos - 1)} />
        </div>
      )}

      {/* --- Semana pasada ----------------------------------------------------
          Cierre de la semana anterior: prueba social de que la liga paga de
          verdad. Los 3 que cobraron van con medalla, borde dorado y su premio;
          el premio sale del pot registrado al cerrar × el reparto fijo del
          contrato, no del pot de hoy.

          Mientras el cierre no se haya registrado (entre las 00:00 y el cron,
          o si el cron falla) el podio se toma de las 3 primeras filas, que es
          el mismo orden que usa close-week, y se avisa de que el premio está
          por asignarse en vez de enseñar un monto que aún no existe. */}
      {last && (
        <div className="mt-3 flex flex-col gap-1.5 border-t border-lavender/20 pt-3">
          <div className="text-center">
            <h3 className="font-display text-sm font-bold text-white">🏆 {tr.liga.lastWeek}</h3>
            <p className="text-[11px] text-neutral-400">
              {Object.keys(last.winners).length > 0 ? tr.liga.lastWeekNote : tr.liga.lastWeekPending}
            </p>
          </div>
          <ol className="flex flex-col gap-1.5">
            {last.entries.map((e, i) => {
              const registrado = Object.keys(last.winners).length > 0;
              const win = last.winners[e.playerId.toLowerCase()];
              const place = registrado ? win?.place : i < MEDALS.length ? i + 1 : undefined;
              const base = toEntry(e, Infinity);
              const premio = win ? (Number(win.potRaw) / 1e6) * (WEEKLY_PODIUM_SHARE[win.place - 1] / 100) : 0;
              return (
                <Fragment key={e.playerId}>
                  {i === MEDALS.length && <PrizeCut label={tr.liga.prizeCut} as="li" />}
                  <RankRow
                    pos={i + 1}
                    entry={{
                      ...base,
                      winner: !!place,
                      badge: place ? <span aria-hidden>{MEDALS[place - 1]}</span> : undefined,
                      sub: win && premio > 0 ? fmt(premio) : undefined,
                    }}
                  />
                </Fragment>
              );
            })}
          </ol>
        </div>
      )}
    </section>
  );
}
