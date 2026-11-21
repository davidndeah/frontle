"use client";

// ============================================================
//  Héroe de Flag Rush en la zona destacada de Inicio.
//
//  Hermano del héroe del reto diario: mismo esqueleto (título + reloj vivo
//  arriba, dato fuerte en medio, botón amarillo abajo) pero en azul
//  petróleo, el color de su ficha en Modos. El gancho no es plata sino XP
//  para la liga semanal, así que lo fuerte es la barra de XP de hoy y las
//  3 ventanas del día.
//
//  El reloj cuenta hasta `nextSlotAt`: si la ventana está abierta es lo que
//  le queda; si ya la jugó, lo que falta para la siguiente. Es el mismo
//  número en los dos casos.
//
//  Si el estado no llega (sin billetera, sin red, servidor sin desplegar)
//  el héroe se pinta igual, sin ventanas ni barra: Jugar abre Flag Rush y
//  ahí se explica lo que pase.
// ============================================================

import { useEffect, useState } from "react";
import { RUSH_XP_PER_GAME, rushClient, slotOf, slotStarts, type RushStatus } from "../lib/flagRush";
import type { Locale, t } from "../lib/i18n";
import Icon3D, { Ico } from "./icons/Icon3D";
import { useEstetica } from "../lib/estetica";

type Tr = ReturnType<typeof t>;

const pad = (n: number) => String(n).padStart(2, "0");
const clock = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
};

export default function FlagRushHero({ tr, locale, onPlay }: { tr: Tr; locale: Locale; onPlay: () => void }) {
  const { nueva } = useEstetica();
  const [status, setStatus] = useState<RushStatus | null>(null);
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    void rushClient().status().then((r) => { if (alive && r.ok) setStatus(r.data); });
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  // Cambió de ventana con la pantalla abierta: se vuelve a pedir el estado.
  const nextAt = status ? new Date(status.nextSlotAt).getTime() : null;
  const expired = nextAt !== null && now !== null && now >= nextAt;
  useEffect(() => {
    if (!expired) return;
    let alive = true;
    void rushClient().status().then((r) => { if (alive && r.ok) setStatus(r.data); });
    return () => { alive = false; };
  }, [expired]);

  const played = status?.state === "played";
  const left = nextAt !== null && now !== null ? clock(nextAt - now) : "--:--:--";

  return (
    <div className="brutal relative flex h-full flex-col overflow-hidden rounded-2xl bg-[#0e3b52] p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex min-w-0 items-center gap-2 font-display text-xl font-black leading-tight text-white">
          <Ico name="flag" emoji="🚩" size={26} className="ico-float" />
          <span className="truncate">{tr.rush.title}</span>
        </h2>
        <span
          className="flex flex-none items-center gap-1.5 rounded-full bg-black/35 px-2.5 py-1 font-mono text-xs font-bold text-white tabular-nums"
          aria-label={`${played ? tr.hub.rushNext : tr.rush.windowState.abierta}: ${left}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${played ? "bg-white/50" : "bg-gold animate-pulse"}`} />
          {left}
        </span>
      </div>
      <p className="mt-1 text-xs text-white/75">{tr.hub.rushRules}</p>

      {status && now !== null && (
        <>
          <Windows status={status} tr={tr} locale={locale} now={now} />
          <div className="mt-2.5 rounded-xl bg-black/25 px-3 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold text-white/80">{tr.rush.xpToday(status.xpToday, status.maxXpToday)}</span>
              <span className={nueva ? "est-xp" : "text-[11px] font-bold text-gold"}>
                {nueva && <Icon3D name="xp" size={12} />}
                {tr.dailyHero.xpBadge(RUSH_XP_PER_GAME)}
              </span>
            </div>
            <div className="mt-1.5 h-2.5 overflow-hidden rounded-full border border-white/15 bg-black/40">
              <div
                className="h-full w-full origin-left bg-gold"
                style={{ transform: `scaleX(${status.maxXpToday ? Math.min(1, status.xpToday / status.maxXpToday) : 0})` }}
              />
            </div>
          </div>
        </>
      )}

      {/* Separador elástico: en el carrusel las dos fichas miden lo mismo y
          el botón queda abajo, a la altura del Jugar del reto. */}
      <div className="min-h-3 flex-1" />
      <button
        type="button"
        onClick={onPlay}
        className={`brutal brutal-press w-full rounded-xl py-3.5 font-display text-lg font-black ${played ? "bg-surface text-white" : "bg-gold text-deep"}`}
      >
        {played ? tr.rush.practice : status?.state === "open" ? tr.rush.resume : tr.rush.play}
      </button>
    </div>
  );
}

/** Las 3 ventanas en fichas pequeñas: hora local de inicio y estado. */
function Windows({ status, tr, locale, now }: { status: RushStatus; tr: Tr; locale: Locale; now: number }) {
  const starts = slotStarts(new Date(now));
  const current = slotOf(new Date(now));
  const done = new Set(status.attempts.map((a) => a.slot));
  const fmt = new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" });
  return (
    <div className="mt-3 grid grid-cols-3 gap-1.5" aria-label={tr.rush.windows}>
      {starts.map((d, s) => {
        const st = done.has(s) || (s === current && status.state === "played") ? "jugada"
          : s === current ? "abierta"
          : s < current ? "pasada"
          : "pendiente";
        return (
          <div
            key={s}
            className={`rounded-xl border-2 px-2 py-1.5 text-center ${st === "abierta" ? "bg-gold text-deep" : "bg-black/25 text-white"} ${st === "pasada" ? "opacity-50" : ""}`}
            style={{ borderColor: st === "abierta" ? "var(--deep)" : "rgba(13,4,32,0.5)" }}
          >
            <div className="font-mono text-xs font-bold tabular-nums">{fmt.format(d)}</div>
            <div className={`text-[10px] font-semibold leading-tight ${st === "jugada" ? "text-[#86efac]" : st === "abierta" ? "" : "text-white/60"}`}>
              {st === "jugada" ? <><Ico name="check" emoji="✓" size={10} />{" "}</> : ""}{tr.rush.windowState[st]}
            </div>
          </div>
        );
      })}
    </div>
  );
}
