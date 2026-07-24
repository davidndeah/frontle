"use client";

// ============================================================
//  Frontle v2 — Aviso de XP al ganar en los modos libres
//  (Regiones, Bandera/Contorno y Práctica; el reto diario tiene su propia
//  pantalla de victoria con premio, así que no lo usa.)
//
//  Responde lo único que el jugador quiere saber al ganar: cuánto XP se
//  llevó y en qué puesto de la liga semanal lo deja. La posición se lee
//  DESPUÉS de insertar el evento, para que ya lo cuente.
//
//  Se apoya en Sheet (Escape, foco y aria ya resueltos ahí).
// ============================================================

import { useState } from "react";
import type { t } from "../lib/i18n";
import { getWeeklyStanding, type WeeklyStanding } from "../lib/xp";
import Sheet from "./Sheet";

interface XpWin {
  open: boolean;
  xp: number;
  standing: WeeklyStanding | null;
  loading: boolean;
}

// Encadena "otorgar XP → leer posición → abrir el aviso". Cada modo le pasa su
// propia promesa de otorgamiento (awardRegionWin, awardQuizCorrect…).
export function useXpWin() {
  const [win, setWin] = useState<XpWin>({ open: false, xp: 0, standing: null, loading: false });

  function celebrate(award: Promise<number>) {
    setWin({ open: true, xp: 0, standing: null, loading: true });
    void award
      .then(async (xp) => {
        const standing = await getWeeklyStanding();
        setWin({ open: true, xp, standing, loading: false });
      })
      // El XP nunca debe romper la victoria: si algo falla, se cierra y ya.
      .catch(() => setWin({ open: false, xp: 0, standing: null, loading: false }));
  }

  const close = () => setWin((w) => ({ ...w, open: false }));

  return { win, celebrate, close };
}

export default function XpGainPopup({
  tr,
  win,
  onClose,
}: {
  tr: ReturnType<typeof t>;
  win: XpWin;
  onClose: () => void;
}) {
  if (!win.open) return null;

  return (
    <Sheet onClose={onClose} label={tr.xpWin.title} z={70} className="pop-in">
      <div className="flex flex-col items-center gap-3 py-2 text-center">
        {win.loading ? (
          <p className="text-sm text-neutral-300 py-6">{tr.xpWin.loading}</p>
        ) : (
          <>
            {win.xp > 0 ? (
              <p className="font-display text-4xl font-black text-gold">{tr.xpWin.gained(win.xp)}</p>
            ) : (
              // Sin XP no es un fallo: el jugador agotó su cupo del día y las
              // rondas de más son entrenamiento, no liga. Hay que decirlo sin
              // que parezca un error.
              <p className="max-w-xs text-sm text-neutral-200">{tr.xpWin.capped}</p>
            )}

            {win.standing ? (
              <div className="w-full rounded-xl border border-lavender/25 bg-base px-4 py-3">
                <p className="font-display text-lg font-bold text-white">
                  {tr.xpWin.rank(win.standing.rank, win.standing.players)}
                </p>
                <p className="mt-0.5 font-mono text-xs text-amber-200">{tr.xpWin.total(win.standing.xp)}</p>
              </div>
            ) : (
              <p className="text-[11px] text-neutral-400">{tr.xpWin.needWallet}</p>
            )}
          </>
        )}

        <button
          onClick={onClose}
          className="brutal-sm brutal-press mt-1 w-full rounded-xl bg-gold px-6 py-3 font-bold text-surface"
        >
          {tr.xpWin.close}
        </button>
      </div>
    </Sheet>
  );
}
