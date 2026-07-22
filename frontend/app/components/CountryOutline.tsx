"use client";

// ============================================================
//  CountryOutline — silueta de UN país (modo "Adivina el contorno").
//  Relleno del tema sobre fondo neutro, sin fronteras internas ni
//  etiquetas. Proyección Mercator encuadrada al país (como los previews
//  de regiones). El atlas se comparte vía lib/atlas (una descarga).
// ============================================================

import { useEffect, useMemo, useState } from "react";
import { geoMercator, geoPath } from "d3-geo";
import { featureForCountry, type AtlasFeature } from "../lib/atlas";

const W = 360;
const H = 240;
const PAD = 28;

export default function CountryOutline({ country, loadingLabel }: { country: string; loadingLabel: string }) {
  const [feat, setFeat] = useState<AtlasFeature | null>(null);

  useEffect(() => {
    let cancelled = false;
    setFeat(null);
    featureForCountry(country).then((f) => { if (!cancelled) setFeat(f); });
    return () => { cancelled = true; };
  }, [country]);

  const d = useMemo(() => {
    if (!feat) return null;
    const projection = geoMercator().fitExtent([[PAD, PAD], [W - PAD, H - PAD]], feat as never);
    return geoPath(projection)(feat) ?? null;
  }, [feat]);

  return (
    <div className="relative w-full rounded-2xl overflow-hidden bg-panel border border-lavender/20">
      {!d ? (
        <div className="h-[240px] flex items-center justify-center text-neutral-300 text-sm">{loadingLabel}</div>
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto block">
          <path
            d={d}
            fill="rgba(183,156,237,0.35)"
            stroke="var(--lavender)"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
            style={{ filter: "drop-shadow(0 0 8px rgba(183,156,237,0.45))" }}
          />
        </svg>
      )}
    </div>
  );
}
