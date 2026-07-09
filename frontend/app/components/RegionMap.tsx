"use client";

// ============================================================
//  RegionMap — mapa del modo Regiones (departamentos/estados).
//  Gemelo de WorldMap pero carga el GeoJSON local /maps/<region>.json.
//  El match es directo por properties.name (ya canónico = grafo), sin
//  aliasing. Mantiene graticule, glow del semáforo, pan/zoom y encuadre
//  fijo a origen+destino.
// ============================================================

import { useEffect, useMemo, useRef, useState } from "react";
import { geoEqualEarth, geoPath, geoGraticule } from "d3-geo";
import type { Feature, Geometry, FeatureCollection } from "geojson";
import type { Status } from "../lib/game";

const COLORS: Record<Status, string> = {
  start: "#22d3ee",
  end: "#e879f9",
  green: "#22c55e",
  yellow: "#eab308",
  red: "#ef4444",
};

interface Props {
  regionId: string;
  statusByEntity: Record<string, Status>;
  loadingLabel: string;
  silhouettes?: string[];
  showAllOutlines?: boolean;
  resetKey?: string;
}

type NamedFeature = Feature<Geometry, { name: string; code: string }>;

const W = 360;
const H = 220;
const PAD = 20;

export default function RegionMap({
  regionId,
  statusByEntity,
  loadingLabel,
  silhouettes = [],
  showAllOutlines = false,
  resetKey = "",
}: Props) {
  const [features, setFeatures] = useState<NamedFeature[] | null>(null);
  const [view, setView] = useState({ k: 1, x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);

  // Cargar el GeoJSON de la región (cambia al cambiar de país)
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

  useEffect(() => setView({ k: 1, x: 0, y: 0 }), [resetKey]);

  const silSet = useMemo(() => new Set(silhouettes), [silhouettes]);

  const render = useMemo(() => {
    if (!features) return null;
    const tagged = features.map((f) => ({ f, name: f.properties?.name }));
    const known = tagged.filter((x) => x.name && statusByEntity[x.name]);
    const sil = tagged.filter((x) => x.name && !statusByEntity[x.name] && silSet.has(x.name));

    // Encuadre FIJO a origen+destino (revelar entidades no cambia el zoom).
    const anchor = known.filter(
      (x) => statusByEntity[x.name!] === "start" || statusByEntity[x.name!] === "end"
    );
    const fitFeatures = (anchor.length ? anchor : [...known, ...sil]).map((k) => k.f);
    if (fitFeatures.length === 0) return { graticule: "", outlines: [], silhouettes: [], known: [] };

    const fc: FeatureCollection = { type: "FeatureCollection", features: fitFeatures };
    const projection = geoEqualEarth().fitExtent([[PAD, PAD], [W - PAD, H - PAD]], fc as never);
    const pathGen = geoPath(projection);

    return {
      graticule: pathGen(geoGraticule().step([2, 2])()) ?? "",
      outlines: showAllOutlines ? features.map((f, i) => ({ d: pathGen(f) ?? "", key: "o" + i })) : [],
      silhouettes: sil.map((k) => ({ d: pathGen(k.f) ?? "", key: "s" + k.name })),
      known: known.map((k) => ({ d: pathGen(k.f) ?? "", fill: COLORS[statusByEntity[k.name!]], key: k.name! })),
    };
  }, [features, statusByEntity, silSet, showAllOutlines]);

  function toSvg(clientX: number, clientY: number) {
    const r = svgRef.current!.getBoundingClientRect();
    return { x: ((clientX - r.left) / r.width) * W, y: ((clientY - r.top) / r.height) * H };
  }

  function zoomAt(factor: number, cx: number, cy: number) {
    setView((v) => {
      const k = Math.min(8, Math.max(1, v.k * factor));
      const f = k / v.k;
      return { k, x: cx - (cx - v.x) * f, y: cy - (cy - v.y) * f };
    });
  }

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const p = toSvg(e.clientX, e.clientY);
      zoomAt(e.deltaY < 0 ? 1.2 : 1 / 1.2, p.x, p.y);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [features]);

  function onPointerDown(e: React.PointerEvent) {
    drag.current = { x: e.clientX, y: e.clientY };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current) return;
    const r = svgRef.current!.getBoundingClientRect();
    const dx = ((e.clientX - drag.current.x) / r.width) * W;
    const dy = ((e.clientY - drag.current.y) / r.height) * H;
    drag.current = { x: e.clientX, y: e.clientY };
    setView((v) => ({ ...v, x: v.x + dx, y: v.y + dy }));
  }
  function onPointerUp() {
    drag.current = null;
  }

  const btn =
    "w-7 h-7 rounded-md bg-[#1c0b3e]/80 border border-[#b79ced]/30 text-white text-base leading-none flex items-center justify-center active:scale-90 transition";

  return (
    <div className="relative w-full rounded-2xl overflow-hidden bg-[#0f0524] border border-[#b79ced]/20">
      {!render ? (
        <div className="h-[220px] flex items-center justify-center text-neutral-300 text-sm">
          {loadingLabel}
        </div>
      ) : (
        <>
          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${H}`}
            className="w-full h-auto block touch-none cursor-grab active:cursor-grabbing"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
          >
            <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
              {render.graticule && (
                <path d={render.graticule} fill="none" stroke="rgba(183,156,237,0.16)" strokeWidth={0.5} vectorEffect="non-scaling-stroke" />
              )}
              {render.outlines.map((p) => (
                <path key={p.key} d={p.d} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth={0.3} vectorEffect="non-scaling-stroke" />
              ))}
              {render.silhouettes.map((p) => (
                <path key={p.key} d={p.d} fill="rgba(255,255,255,0.14)" stroke="rgba(255,255,255,0.5)" strokeWidth={0.6} vectorEffect="non-scaling-stroke" />
              ))}
              {render.known.map((p) => (
                <path key={p.key} d={p.d} fill={p.fill} stroke="#000" strokeWidth={0.5} vectorEffect="non-scaling-stroke" style={{ filter: `drop-shadow(0 0 3px ${p.fill})` }} />
              ))}
            </g>
          </svg>
          <div className="absolute top-2 right-2 flex flex-col gap-1">
            <button className={btn} onClick={() => zoomAt(1.4, W / 2, H / 2)} aria-label="Acercar">+</button>
            <button className={btn} onClick={() => zoomAt(1 / 1.4, W / 2, H / 2)} aria-label="Alejar">−</button>
            <button className={btn} onClick={() => setView({ k: 1, x: 0, y: 0 })} aria-label="Reencuadrar">⌖</button>
          </div>
        </>
      )}
    </div>
  );
}
