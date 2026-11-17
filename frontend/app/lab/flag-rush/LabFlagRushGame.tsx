"use client";

// Laboratorio: la pantalla de Flag Rush contra el simulador, con controles
// para probar los casos que en la vida real tardan horas (siguiente ventana,
// empezar de cero). Los textos de los controles van a mano: esto no es
// producción.

import { useState } from "react";
import FlagRushGame from "../../components/FlagRushGame";
import { mockReset, mockRush, mockShiftSlot } from "../../lib/flagRush";
import { LOCALES, type Locale } from "../../lib/i18n";

// Rótulos de los controles del laboratorio. No son interfaz del juego (esta
// página no se enlaza ni se traduce), por eso viven aquí y no en i18n.ts.
const LAB = { tag: "LAB", locale: "Idioma", next: "Siguiente ventana ⏭", reset: "Reiniciar" };

export default function LabFlagRushGame() {
  const [locale, setLocale] = useState<Locale>("es");
  const [run, setRun] = useState(0);
  const remount = () => setRun((n) => n + 1);

  return (
    <main className="mx-auto flex min-h-dvh max-w-[420px] flex-col gap-4 px-4 py-5">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border-2 border-deep bg-panel p-2 text-xs">
        <span className="font-bold text-gold">{LAB.tag}</span>
        <select
          value={locale}
          onChange={(e) => setLocale(e.target.value as Locale)}
          aria-label={LAB.locale}
          className="rounded-lg bg-surface px-2 py-1.5 text-white"
        >
          {LOCALES.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
        <button onClick={() => { mockShiftSlot(); remount(); }} className="rounded-lg bg-surface px-2.5 py-1.5 font-semibold text-white">
          {LAB.next}
        </button>
        <button onClick={() => { mockReset(); remount(); }} className="rounded-lg bg-surface px-2.5 py-1.5 font-semibold text-white">
          {LAB.reset}
        </button>
      </div>
      <FlagRushGame key={`${run}-${locale}`} locale={locale} client={mockRush} onExit={remount} />
    </main>
  );
}
