"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { geoEqualEarth, geoPath, geoCentroid, geoGraticule } from "d3-geo";
import { feature } from "topojson-client";
import type { Feature, Geometry, FeatureCollection } from "geojson";
import { COUNTRY_NAMES } from "../lib/countries";
import type { Status } from "../lib/game";
import { STATUS_COLORS as COLORS } from "../lib/theme";

const ATLAS_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";


function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/\brep\.?\b/g, "republic")
    .replace(/\bdem\.?\b/g, "democratic")
    .replace(/\bw\.?\s/g, "western ")
    .replace(/\beq\.?\s/g, "equatorial ")
    .replace(/\bs\.?\s/g, "south ")
    .replace(/[.'’\-]/g, "")
    .replace(/[^a-z\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const NE_ALIAS: Record<string, string> = {
  "united states of america": "United States",
  "democratic republic of the congo": "Democratic Republic of the Congo",
  "democratic republic congo": "Democratic Republic of the Congo",
  "congo": "Republic of the Congo",
  "republic of the congo": "Republic of the Congo",
  "cote divoire": "Ivory Coast",
  "ivory coast": "Ivory Coast",
  "czechia": "Czech Republic",
  "bosnia and herzegovina": "Bosnia and Herzegovina",
  "bosnia and herz": "Bosnia and Herzegovina",
  "western sahara": "Western Sahara",
  "equatorial guinea": "Equatorial Guinea",
  "central african republic": "Central African Republic",
  "timorleste": "East Timor",
  "east timor": "East Timor",
  "lao pdr": "Laos",
  "laos": "Laos",
  "korea": "South Korea",
  "republic of korea": "South Korea",
  "south korea": "South Korea",
  "democratic peoples republic of korea": "North Korea",
  "north korea": "North Korea",
  "macedonia": "North Macedonia",
  "north macedonia": "North Macedonia",
  "republic of serbia": "Serbia",
  "serbia": "Serbia",
  "united republic of tanzania": "Tanzania",
  "tanzania": "Tanzania",
  "brunei darussalam": "Brunei",
  "swaziland": "Eswatini",
  "eswatini": "Eswatini",
};

const NAME_INDEX: Record<string, string> = (() => {
  const idx: Record<string, string> = {};
  for (const n of COUNTRY_NAMES) idx[norm(n)] = n;
  for (const k in NE_ALIAS) idx[k] = NE_ALIAS[k];
  return idx;
})();

interface Props {
  statusByCountry: Record<string, Status>;
  loadingLabel: string;
  silhouettes?: string[];
  showAllOutlines?: boolean;
  resetKey?: string; // al cambiar, reinicia el encuadre (nuevo reto)
  controls?: { zoomIn: string; zoomOut: string; recenter: string };
}

const EN_CONTROLS = { zoomIn: "Zoom in", zoomOut: "Zoom out", recenter: "Recenter" };

type NamedFeature = Feature<Geometry, { name: string }>;

const W = 360;
const H = 220;
const PAD = 24;

// Área aproximada (shoelace, en grados²) de un anillo. Solo sirve para
// comparar los polígonos de un MISMO país entre sí, no como área real.
function ringArea(ring: number[][]): number {
  let sum = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[i + 1];
    sum += x1 * y2 - x2 * y1;
  }
  return Math.abs(sum) / 2;
}

// Se queda con el polígono más grande de un MultiPolygon (ver comentario en
// `render`). Los países con un solo polígono pasan intactos.
function mainPolygon(f: NamedFeature): NamedFeature {
  if (f.geometry.type !== "MultiPolygon") return f;
  const polys = f.geometry.coordinates;
  if (polys.length <= 1) return f;
  let best = 0;
  let bestArea = -1;
  polys.forEach((poly, i) => {
    const a = ringArea(poly[0]);
    if (a > bestArea) {
      bestArea = a;
      best = i;
    }
  });
  return { ...f, geometry: { type: "Polygon", coordinates: polys[best] } };
}

export default function WorldMap({
  statusByCountry,
  loadingLabel,
  silhouettes = [],
  showAllOutlines = false,
  resetKey = "",
  controls = EN_CONTROLS,
}: Props) {
  const [features, setFeatures] = useState<NamedFeature[] | null>(null);
  const [view, setView] = useState({ k: 1, x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(ATLAS_URL)
      .then((r) => r.json())
      .then((topo) => {
        if (cancelled) return;
        const geo = feature(topo, topo.objects.countries) as unknown as { features: NamedFeature[] };
        setFeatures(geo.features);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Reiniciar encuadre al cambiar de reto
  useEffect(() => setView({ k: 1, x: 0, y: 0 }), [resetKey]);

  const silSet = useMemo(() => new Set(silhouettes), [silhouettes]);

  const render = useMemo(() => {
    if (!features) return null;
    const tagged = features.map((f) => ({ f, name: NAME_INDEX[norm(f.properties?.name ?? "")] }));
    const known = tagged.filter((x) => x.name && statusByCountry[x.name]);
    const sil = tagged.filter((x) => x.name && !statusByCountry[x.name] && silSet.has(x.name));

    // Extent FIJO a los países del reto (origen + destino). Revelar países o
    // mostrar contornos NO cambia el zoom — solo el usuario (pan/zoom) lo altera.
    const anchor = known.filter(
      (x) => statusByCountry[x.name!] === "start" || statusByCountry[x.name!] === "end"
    );
    // Para el ENCUADRE (no para el relleno) usamos solo el polígono principal
    // de cada país: algunos (Francia + Guayana Francesa, en el mismo
    // MultiPolygon del atlas) traen un territorio de ultramar a miles de km
    // del cuerpo principal. Con el feature completo, fitExtent se abre para
    // mostrar ambos y el zoom queda descuadrado (p.ej. Francia "trae" a
    // Sudamérica al cuadro aunque el reto sea puramente europeo). No es el
    // mismo bug que Rusia/antimeridiano (ahí el país es uno solo partido por
    // la proyección) — aquí son dos territorios real y genuinamente separados.
    const fitFeatures = (anchor.length ? anchor : [...known, ...sil]).map((k) => mainPolygon(k.f));
    if (fitFeatures.length === 0) return { graticule: "", outlines: [], silhouettes: [], known: [] };

    const fc: FeatureCollection = { type: "FeatureCollection", features: fitFeatures };
    // Rotar la proyección al centroide de la región: evita que países que
    // cruzan el antimeridiano (p.ej. Rusia/Chukotka) aparezcan partidos con
    // un fragmento fantasma al otro lado del mapa.
    const [lon] = geoCentroid(fc as never);
    const projection = geoEqualEarth()
      .rotate([Number.isFinite(lon) ? -lon : 0, 0])
      .fitExtent([[PAD, PAD], [W - PAD, H - PAD]], fc as never);
    const pathGen = geoPath(projection);

    return {
      // Paralelos y meridianos: dan textura de "mapa" aunque no haya países revelados
      graticule: pathGen(geoGraticule().step([10, 10])()) ?? "",
      outlines: showAllOutlines ? features.map((f, i) => ({ d: pathGen(f) ?? "", key: "o" + i })) : [],
      silhouettes: sil.map((k) => ({ d: pathGen(k.f) ?? "", key: "s" + k.name })),
      known: known.map((k) => ({ d: pathGen(k.f) ?? "", fill: COLORS[statusByCountry[k.name!]], key: k.name! })),
    };
  }, [features, statusByCountry, silSet, showAllOutlines]);

  // Convierte coords de cliente a coords del viewBox
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

  // Wheel con preventDefault (listener no pasivo)
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
    "w-7 h-7 rounded-md bg-surface/80 border border-lavender/30 text-white text-base leading-none flex items-center justify-center active:scale-90 transition";

  return (
    <div className="relative w-full rounded-2xl overflow-hidden bg-panel border border-lavender/20">
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
          {/* Controles de zoom */}
          <div className="absolute top-2 right-2 flex flex-col gap-1">
            <button className={btn} onClick={() => zoomAt(1.4, W / 2, H / 2)} title={controls.zoomIn} aria-label={controls.zoomIn}>+</button>
            <button className={btn} onClick={() => zoomAt(1 / 1.4, W / 2, H / 2)} title={controls.zoomOut} aria-label={controls.zoomOut}>−</button>
            <button className={btn} onClick={() => setView({ k: 1, x: 0, y: 0 })} title={controls.recenter} aria-label={controls.recenter}>⌖</button>
          </div>
        </>
      )}
    </div>
  );
}
