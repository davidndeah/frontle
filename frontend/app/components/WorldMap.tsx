"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { geoEqualEarth, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { Feature, Geometry } from "geojson";
import { COUNTRY_NAMES } from "../lib/countries";
import type { Status } from "../lib/game";

const ATLAS_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

// Colores del semáforo + prisma
const COLORS: Record<Status, string> = {
  start: "#22d3ee", // cyan
  end: "#e879f9", // fucsia
  green: "#22c55e",
  yellow: "#eab308",
  red: "#ef4444",
};
const LAND_DEFAULT = "#161b2e";
const LAND_STROKE = "#0a0e1a";

// Normaliza nombres para emparejar Natural Earth ↔ nuestros nombres.
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

// Alias explícitos: nombre Natural Earth (normalizado) → nuestro nombre
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

// Índice: nombre normalizado → nuestro nombre canónico
const NAME_INDEX: Record<string, string> = (() => {
  const idx: Record<string, string> = {};
  for (const n of COUNTRY_NAMES) idx[norm(n)] = n;
  for (const k in NE_ALIAS) idx[k] = NE_ALIAS[k];
  return idx;
})();

interface Props {
  statusByCountry: Record<string, Status>;
}

export default function WorldMap({ statusByCountry }: Props) {
  const [features, setFeatures] = useState<Feature<Geometry, { name: string }>[] | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(ATLAS_URL)
      .then((r) => r.json())
      .then((topo) => {
        if (cancelled) return;
        const geo = feature(topo, topo.objects.countries) as unknown as {
          features: Feature<Geometry, { name: string }>[];
        };
        setFeatures(geo.features);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const W = 360;
  const H = 200;

  const paths = useMemo(() => {
    if (!features) return [];
    const projection = geoEqualEarth().fitSize([W, H], {
      type: "FeatureCollection",
      features,
    } as never);
    const pathGen = geoPath(projection);
    return features.map((f) => {
      const myName = NAME_INDEX[norm(f.properties?.name ?? "")];
      const status = myName ? statusByCountry[myName] : undefined;
      return {
        d: pathGen(f) ?? "",
        fill: status ? COLORS[status] : LAND_DEFAULT,
        known: !!status,
        key: (f.properties?.name ?? "") + Math.random().toString(36).slice(2, 6),
      };
    });
  }, [features, statusByCountry]);

  return (
    <div ref={ref} className="w-full rounded-2xl overflow-hidden bg-[#080b16] border border-white/5">
      {!features ? (
        <div className="h-[200px] flex items-center justify-center text-slate-600 text-sm">
          Cargando mapa…
        </div>
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto block">
          {paths.map((p) => (
            <path
              key={p.key}
              d={p.d}
              fill={p.fill}
              stroke={LAND_STROKE}
              strokeWidth={0.3}
              style={p.known ? { filter: "drop-shadow(0 0 3px " + p.fill + ")" } : undefined}
            />
          ))}
        </svg>
      )}
    </div>
  );
}
