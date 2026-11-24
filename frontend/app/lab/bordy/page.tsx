"use client";

// Laboratorio (no enlazado): Bordy de hoy contra el rig v2, lado a lado, al
// tamaño del botón flotante del juego (96x114) y en grande. Cámara lenta con
// playbackRate de las animaciones CSS, para revisar cuadro por cuadro.

import { useEffect, useRef, useState } from "react";
import Bordy, { type BordyMood } from "../../components/Bordy";

const MOODS: { m: BordyMood; label: string }[] = [
  { m: "acierto", label: "Acierto" },
  { m: "desvio", label: "Desvío" },
  { m: "fallo", label: "Fallo" },
  { m: "racha", label: "Racha" },
  { m: "pensando", label: "Pensando" },
  { m: "idle", label: "Reposo" },
];

// Igual que DURACION en Bordy.tsx: cuánto dura el estado antes de volver a reposo.
const DUR: Partial<Record<BordyMood, number>> = { acierto: 850, desvio: 550, fallo: 1600, racha: 1700 };

export default function LabBordy() {
  const [mood, setMood] = useState<BordyMood>("idle");
  const [rate, setRate] = useState(1);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const play = (m: BordyMood) => {
    if (timer.current) clearTimeout(timer.current);
    setMood("idle");
    // Un cuadro en reposo para que repetir el mismo estado lo vuelva a disparar.
    requestAnimationFrame(() => {
      setMood(m);
      const ms = DUR[m];
      // `?hold` deja el estado puesto, para revisar cuadros sueltos.
      const hold = new URLSearchParams(window.location.search).has("hold");
      if (ms && !hold) timer.current = setTimeout(() => setMood("idle"), ms / rate);
    });
  };

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      document.getAnimations().forEach((a) => { a.playbackRate = rate; });
    });
    return () => cancelAnimationFrame(id);
  }, [mood, rate]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const col = (v2: boolean) => (
    <div className="flex flex-col items-center gap-6">
      <p className="text-xs font-bold uppercase tracking-widest text-white/60">{v2 ? "Nuevo" : "Hoy"}</p>
      <div className="w-[96px] h-[114px]">
        <Bordy mood={mood} v2={v2} className="w-full h-full" imgClassName="drop-shadow-xl" />
      </div>
      <div className="w-[200px] h-[238px]">
        <Bordy mood={mood} v2={v2} className="w-full h-full" imgClassName="drop-shadow-xl" />
      </div>
    </div>
  );

  return (
    <main className="min-h-dvh bg-gradient-to-b from-[#2a1257] to-[#150a2e] px-4 py-8 text-white">
      <h1 className="text-center text-lg font-bold">Bordy: reacciones</h1>
      <div className="mx-auto mt-8 grid max-w-md grid-cols-2 gap-4">
        {col(false)}
        {col(true)}
      </div>
      <div className="mx-auto mt-10 grid max-w-md grid-cols-3 gap-2">
        {MOODS.map(({ m, label }) => (
          <button
            key={m}
            onClick={() => play(m)}
            className={`rounded-xl border-2 px-2 py-3 text-sm font-bold transition-transform active:scale-95 ${mood === m ? "border-[#fcff52] bg-white/15" : "border-white/20 bg-white/5"}`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="mx-auto mt-4 flex max-w-md justify-center gap-2">
        {[1, 0.25, 0.1].map((r) => (
          <button
            key={r}
            onClick={() => setRate(r)}
            className={`rounded-full border-2 px-4 py-2 text-xs font-bold ${rate === r ? "border-[#fcff52] bg-white/15" : "border-white/20"}`}
          >
            {r === 1 ? "Normal" : `${r}x`}
          </button>
        ))}
      </div>
    </main>
  );
}
