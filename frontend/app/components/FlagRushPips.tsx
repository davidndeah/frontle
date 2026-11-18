"use client";

// ============================================================
//  Los 3 puntos de las ventanas de Flag Rush en la ficha de Modos.
//
//  Misma pastilla que el "nuevo" de Regiones. Verde = ventana jugada,
//  amarillo que late = abierta y sin jugar, apagado = más tarde o pasada.
//  Si el estado no llega (sin billetera, sin red, servidor sin desplegar) no
//  se pinta nada: la ficha sigue funcionando igual.
// ============================================================

import { useEffect, useState } from "react";
import { rushClient, slotOf, type RushStatus } from "../lib/flagRush";

export default function FlagRushPips() {
  const [status, setStatus] = useState<RushStatus | null>(null);

  useEffect(() => {
    let alive = true;
    void rushClient().status().then((r) => { if (alive && r.ok) setStatus(r.data); });
    return () => { alive = false; };
  }, []);

  if (!status) return null;
  const current = slotOf(new Date());
  const played = new Set(status.attempts.map((a) => a.slot));
  return (
    <span className="absolute top-1.5 right-1.5 flex items-center gap-1 rounded-full border border-white/15 bg-black/55 px-1.5 py-1" aria-hidden="true">
      {[0, 1, 2].map((s) => {
        const done = played.has(s) || (s === current && status.state === "played");
        const open = !done && s === current;
        return (
          <span
            key={s}
            className={`h-1.5 w-1.5 rounded-full ${done ? "bg-[#86efac]" : open ? "bg-gold rush-pip-open" : "bg-white/25"}`}
          />
        );
      })}
    </span>
  );
}
