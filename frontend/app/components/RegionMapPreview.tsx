"use client";

// ============================================================
//  RegionMapPreview — vista previa del mapa completo de un país
//  para el selector de modo Regiones. Carga el GeoJSON local
//  /maps/<region>.json y dibuja TODAS las subdivisiones encuadradas
//  al país entero (sin estado de juego). Solo presentación.
// ============================================================

import { useEffect, useMemo, useState } from "react";
import { geoMercator, geoPath } from "d3-geo";
import type { Feature, Geometry, FeatureCollection } from "geojson";

type NamedFeature = Feature<Geometry, { name: string; code: string }>;

const W = 360;
const H = 220;
const PAD = 14;

export default function RegionMapPreview({
  regionId,
  loadingLabel,
}: {
  regionId: string;
  loadingLabel: string;
}) {
  const [features, setFeatures] = useState<NamedFeature[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    setFeatures(null);
    fetch(`/maps/${regionId}.json`)
      .then((r) => r.json())
      .then((geo: { features: NamedFeature[] }) => {
        if (!cancelled) setFeatures(geo.features);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [regionId]);

  const paths = useMemo(() => {
    if (!features || features.length === 0) return null;
    const fc: FeatureCollection = { type: "FeatureCollection", features };
    // geoMercator (conforme) preserva la forma de cada país; geoEqualEarth es
    // global y deforma una sola región. fitExtent centra y escala al recuadro.
    const projection = geoMercator().fitExtent([[PAD, PAD], [W - PAD, H - PAD]], fc as never);
    const pathGen = geoPath(projection);
    return features.map((f, i) => ({ d: pathGen(f) ?? "", key: f.properties?.name ?? "f" + i }));
  }, [features]);

  return (
    <div className="relative w-full rounded-2xl overflow-hidden bg-[#0f0524] border border-[#b79ced]/20">
      {!paths ? (
        <div className="h-[180px] flex items-center justify-center text-neutral-300 text-sm">
          {loadingLabel}
        </div>
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto block">
          {paths.map((p) => (
            <path
              key={p.key}
              d={p.d}
              fill="rgba(183,156,237,0.12)"
              stroke="rgba(183,156,237,0.55)"
              strokeWidth={0.5}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>
      )}
    </div>
  );
}
