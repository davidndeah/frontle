"use client";

// Laboratorio de la prueba de Bordy 3D: dos Bordys lado a lado (el de
// siempre, por piezas, y el de three.js) y los cuadros por segundo del 3D.
// three.js se carga aparte con dynamic(): solo pesa si se abre esta página.

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import Bordy from "../../components/Bordy";
import { flagCardCanvas } from "../../components/bordy3d/model";

// Muestra de tarjetas: formas que no son el rectángulo 3:2 de siempre.
const CARD_CODES = ["NP", "CH", "VA", "CO"];
function CardSamples() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.innerHTML = "";
    for (const code of CARD_CODES) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const c = flagCardCanvas(img);
        c.style.width = "84px";
        el.appendChild(c);
      };
      img.src = `https://flagcdn.com/w160/${code.toLowerCase()}.png`;
    }
  }, []);
  return <div ref={ref} className="flex flex-wrap gap-2 rounded-2xl bg-[#5b21b6] p-3" />;
}

const Bordy3D = dynamic(() => import("./Bordy3D"), { ssr: false });

const LAB = { pieces: "Por piezas (hoy)", three: "three.js (prueba)", fps: "cuadros por segundo", flag: "Bandera en el visor" };

export default function LabBordy3D() {
  const [fps, setFps] = useState<number[]>([]);
  const [flag, setFlag] = useState(false);
  const onFps = useCallback((f: number) => setFps((xs) => [...xs.slice(-9), f]), []);
  const avg = fps.length ? Math.round(fps.reduce((a, b) => a + b, 0) / fps.length) : 0;

  return (
    <main className="mx-auto flex min-h-dvh max-w-[420px] flex-col gap-4 px-4 py-5 text-white">
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col items-center gap-2 rounded-2xl border-2 border-deep bg-surface p-3">
          <span className="text-xs font-bold text-lavender">{LAB.pieces}</span>
          <div className="h-[200px] w-[150px]">
            <Bordy mood="idle" float className="h-full" alt="" />
          </div>
        </div>
        <div className="flex flex-col items-center gap-2 rounded-2xl border-2 border-deep bg-surface p-3">
          <span className="text-xs font-bold text-gold">{LAB.three}</span>
          <div className="h-[200px] w-[150px]">
            <Bordy3D key={String(flag)} flagCode={flag ? "NP" : undefined} onFps={onFps} />
          </div>
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={flag} onChange={(e) => setFlag(e.target.checked)} />
        {LAB.flag}
      </label>
      <CardSamples />
      <p className="font-mono text-sm">
        <span id="fps-avg">{avg}</span> {LAB.fps} <span className="text-neutral-400">({fps.join(" · ")})</span>
      </p>
    </main>
  );
}
