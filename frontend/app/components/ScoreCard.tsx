"use client";

// ============================================================
//  ScoreCard — preview del canvas compartible + botón de compartir.
//  Un solo componente para todos los modos: recibe los datos, dibuja la
//  tarjeta (visible, spoiler-free) y comparte el PNG en un tap.
// ============================================================

import { useEffect, useRef, useState } from "react";
import { drawScoreCard, shareCanvas, type ScoreCardData } from "../lib/scoreCard";

export default function ScoreCard({
  data,
  shareText,
  label,
  copiedLabel,
}: {
  data: ScoreCardData;
  shareText: string;
  label: string;       // "Compartir resultado"
  copiedLabel: string; // "¡Copiado!"
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (canvasRef.current) drawScoreCard(canvasRef.current, data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(data)]);

  async function share() {
    if (!canvasRef.current) return;
    const res = await shareCanvas(canvasRef.current, shareText);
    if (res === "downloaded") { setDone(true); setTimeout(() => setDone(false), 2200); }
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <canvas
        ref={canvasRef}
        className="w-full max-w-[280px] rounded-2xl border border-lavender/25 shadow-xl"
      />
      <button
        onClick={share}
        className="brutal-sm brutal-press w-full rounded-xl bg-gold px-6 py-3 font-bold text-surface"
      >
        {done ? copiedLabel : `📤 ${label}`}
      </button>
    </div>
  );
}
