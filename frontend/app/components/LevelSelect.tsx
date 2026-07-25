"use client";

// ============================================================
//  LevelSelect — selector de dificultad (fácil/medio/difícil).
//  Extraído de page.tsx para compartirlo con las pantallas previas
//  de los modos Bandera/Contorno y Práctica: así elegir nivel se ve
//  y se siente igual en todos lados que en el reto diario.
// ============================================================

import { type Difficulty } from "../lib/game";
import { t } from "../lib/i18n";

export default function LevelSelect({
  tr,
  level,
  onChange,
}: {
  tr: ReturnType<typeof t>;
  level: Difficulty;
  onChange: (l: Difficulty) => void;
}) {
  // Cada nivel con su identidad: icono + color (estética Violeta Prisma)
  const META: Record<Difficulty, { icon: string; color: string }> = {
    easy: { icon: "🌱", color: "#22c55e" },
    medium: { icon: "⚡", color: "var(--gold)" },
    hard: { icon: "💀", color: "#e879f9" },
  };
  const opts: Difficulty[] = ["easy", "medium", "hard"];
  return (
    <div className="flex flex-col items-center gap-1.5">
      <span className="text-[10px] uppercase tracking-[0.2em] text-neutral-400">{tr.chooseLevel}</span>
      <div className="grid grid-cols-3 gap-2 w-full">
        {opts.map((l) => {
          const on = level === l;
          const m = META[l];
          return (
            <button
              key={l}
              type="button"
              onClick={() => onChange(l)}
              aria-pressed={on}
              className={`brutal-shadow brutal-press flex flex-col items-center gap-0.5 rounded-2xl border-2 px-2 py-2.5 backdrop-blur-sm ${
                on ? "bg-surface/80" : "bg-surface/35 opacity-60"
              }`}
              style={{ borderColor: on ? m.color : "rgba(183,156,237,0.2)" }}
            >
              <span className="text-xl leading-none">{m.icon}</span>
              <span className="font-display text-[12.5px] font-bold" style={{ color: on ? m.color : "#c3cbdd" }}>
                {tr.levels[l]}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
