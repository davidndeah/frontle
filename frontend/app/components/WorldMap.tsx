"use client";

import { useEffect, useMemo, useState } from "react";
import { geoEqualEarth, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { Feature, Geometry, FeatureCollection } from "geojson";
import { COUNTRY_NAMES } from "../lib/countries";
import type { Status } from "../lib/game";

const ATLAS_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

// Colores del semáforo + origen/destino
const COLORS: Record<Status, string> = {
  start: "#22d3ee",
  end: "#e879f9",
  green: "#22c55e",
  yellow: "#eab308",
  red: "#ef4444",
};

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
  silhouettes?: string[]; // países a mostrar como contorno (pista)
  showAllOutlines?: boolean; // mostrar el contorno de todos los países (pista)
}

type NamedFeature = Feature<Geometry, { name: string }>;

export default function WorldMap({
  statusByCountry,
  loadingLabel,
  silhouettes = [],
  showAllOutlines = false,
}: Props) {
  const [features, setFeatures] = useState<NamedFeature[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(ATLAS_URL)
      .then((r) => r.json())
      .then((topo) => {
        if (cancelled) return;
        const geo = feature(topo, topo.objects.countries) as unknown as {
          features: NamedFeature[];
        };
        setFeatures(geo.features);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const W = 360;
  const H = 220;
  const PAD = 24;

  const silSet = useMemo(() => new Set(silhouettes), [silhouettes]);

  const render = useMemo(() => {
    if (!features) return null;
    const tagged = features.map((f) => ({ f, name: NAME_INDEX[norm(f.properties?.name ?? "")] }));
    const known = tagged.filter((x) => x.name && statusByCountry[x.name]);
    const sil = tagged.filter((x) => x.name && !statusByCountry[x.name] && silSet.has(x.name));

    // Encuadre: a todo el mundo si se muestran todos los contornos;
    // si no, a los conocidos + siluetas.
    const fitFeatures = showAllOutlines
      ? features
      : [...known, ...sil].map((k) => k.f);
    if (fitFeatures.length === 0) return { outlines: [], silhouettes: [], known: [] };

    const fc: FeatureCollection = { type: "FeatureCollection", features: fitFeatures };
    const projection = geoEqualEarth().fitExtent([[PAD, PAD], [W - PAD, H - PAD]], fc as never);
    const pathGen = geoPath(projection);

    return {
      outlines: showAllOutlines ? features.map((f, i) => ({ d: pathGen(f) ?? "", key: "o" + i })) : [],
      silhouettes: sil.map((k) => ({ d: pathGen(k.f) ?? "", key: "s" + k.name })),
      known: known.map((k) => ({ d: pathGen(k.f) ?? "", fill: COLORS[statusByCountry[k.name!]], key: k.name! })),
    };
  }, [features, statusByCountry, silSet, showAllOutlines]);

  return (
    <div className="w-full rounded-2xl overflow-hidden bg-black border border-white/15">
      {!render ? (
        <div className="h-[220px] flex items-center justify-center text-neutral-400 text-sm">
          {loadingLabel}
        </div>
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto block">
          {render.outlines.map((p) => (
            <path key={p.key} d={p.d} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth={0.3} />
          ))}
          {render.silhouettes.map((p) => (
            <path key={p.key} d={p.d} fill="rgba(255,255,255,0.14)" stroke="rgba(255,255,255,0.5)" strokeWidth={0.5} />
          ))}
          {render.known.map((p) => (
            <path
              key={p.key}
              d={p.d}
              fill={p.fill}
              stroke="#000"
              strokeWidth={0.4}
              style={{ filter: `drop-shadow(0 0 4px ${p.fill})` }}
            />
          ))}
        </svg>
      )}
    </div>
  );
}
