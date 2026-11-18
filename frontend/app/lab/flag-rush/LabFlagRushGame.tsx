"use client";

// Laboratorio: la pantalla de Flag Rush contra el simulador, con controles
// para probar los casos que en la vida real tardan horas (siguiente ventana,
// empezar de cero), y la escena de entrada a velocidad normal o cuadro por
// cuadro. Los textos de los controles van a mano: esto no es producción.

import { useState } from "react";
import FlagRushGame from "../../components/FlagRushGame";
import FlagRushIntro, { FLAG_RUSH_INTRO_MS } from "../../components/FlagRushIntro";
import { mockReset, mockRush, mockShiftSlot } from "../../lib/flagRush";
import { LOCALES, t, type Locale } from "../../lib/i18n";

// Rótulos de los controles del laboratorio. No son interfaz del juego (esta
// página no se enlaza ni se traduce), por eso viven aquí y no en i18n.ts.
const LAB = {
  tag: "LAB", locale: "Idioma", next: "Siguiente ventana ⏭", reset: "Reiniciar",
  scene: "Escena ▶", frames: "Cuadro a cuadro", close: "Cerrar", time: "Instante de la escena",
};
const SCENE_MS = FLAG_RUSH_INTRO_MS;

export default function LabFlagRushGame() {
  const [locale, setLocale] = useState<Locale>("es");
  const [run, setRun] = useState(0);
  // Escena suelta: null = cerrada · "live" = a velocidad normal · número = congelada en ese ms
  const [scene, setScene] = useState<null | "live" | number>(null);
  const [sceneRun, setSceneRun] = useState(0);
  const remount = () => setRun((n) => n + 1);
  const tr = t(locale);

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
        <button onClick={() => { setSceneRun((n) => n + 1); setScene("live"); }} className="rounded-lg bg-surface px-2.5 py-1.5 font-semibold text-white">
          {LAB.scene}
        </button>
        <button onClick={() => { setSceneRun((n) => n + 1); setScene(1600); }} className="rounded-lg bg-surface px-2.5 py-1.5 font-semibold text-white">
          {LAB.frames}
        </button>
      </div>
      <FlagRushGame key={`${run}-${locale}`} locale={locale} client={mockRush} onExit={remount} />

      {scene !== null && (
        <>
          <FlagRushIntro
            key={sceneRun}
            title={tr.rush.title}
            go={tr.go}
            skip={tr.challenge.skipIntro}
            scrub={scene === "live" ? null : scene}
            onDone={() => setScene(null)}
          />
          {scene !== "live" && (
            <div className="fixed inset-x-0 bottom-0 z-[70] flex items-center gap-2 border-t-2 border-deep bg-panel px-3 py-3 text-xs text-white">
              <input
                type="range"
                min={0}
                max={SCENE_MS}
                step={10}
                value={scene}
                onChange={(e) => setScene(Number(e.target.value))}
                aria-label={LAB.time}
                className="flex-1"
              />
              <span className="w-14 text-right font-mono tabular-nums">{scene} ms</span>
              <button onClick={() => setScene(null)} className="rounded-lg bg-surface px-2.5 py-1.5 font-semibold">{LAB.close}</button>
            </div>
          )}
        </>
      )}
    </main>
  );
}
