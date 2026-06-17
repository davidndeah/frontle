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
}

type NamedFeature = Feature<Geometry, { name: string }>;

export default function WorldMap({ statusByCountry, loadingLabel }: Props) {
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

  // Solo los países conocidos (origen, destino y los que el usuario ingresó)
  const known = useMemo(() => {
    if (!features) return [];
    return features
      .map((f) => ({ f, name: NAME_INDEX[norm(f.properties?.name ?? "")] }))
      .filter((x) => x.name && statusByCountry[x.name]);
  }, [features, statusByCountry]);

  const paths = useMemo(() => {
    if (known.length === 0) return [];
    const fc: FeatureCollection = {
      type: "FeatureCollection",
      features: known.map((k) => k.f),
    };
    const projection = geoEqualEarth().fitExtent(
      [
        [PAD, PAD],
        [W - PAD, H - PAD],
      ],
      fc as never
    );
    const pathGen = geoPath(projection);
    return known.map((k) => ({
      d: pathGen(k.f) ?? "",
      fill: COLORS[statusByCountry[k.name!]],
      key: k.name!,
    }));
  }, [known, statusByCountry]);

  return (
    <div className="w-full rounded-2xl overflow-hidden bg-black border border-white/10">
      {!features ? (
        <div className="h-[220px] flex items-center justify-center text-neutral-600 text-sm">
          {loadingLabel}
        </div>
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto block">
          {paths.map((p) => (
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
