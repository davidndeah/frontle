// ============================================================
//  Frontle — Atlas mundial compartido (world-atlas 110m).
//  Carga el TopoJSON UNA vez (caché en memoria) y resuelve el feature
//  de un país por su nombre canónico (mismo matching que WorldMap).
//  Lo usan los modos quiz (CountryOutline) sin duplicar la descarga.
// ============================================================
import { feature } from "topojson-client";
import type { Feature, Geometry } from "geojson";
import { COUNTRY_NAMES } from "./countries";
import { ISLAND_NAMES } from "./islands";

const ATLAS_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

export type AtlasFeature = Feature<Geometry, { name: string }>;

function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/\brep\.?\b/g, "republic")
    .replace(/\bdem\.?\b/g, "democratic")
    .replace(/\bw\.?\s/g, "western ")
    .replace(/\bs\.?\s/g, "south ")
    .replace(/[.'’\-]/g, "")
    .replace(/[^a-z\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Alias del dataset Natural Earth → nombre canónico del juego (== WorldMap).
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
  "solomon is": "Solomon Islands",
};

const NAME_INDEX: Record<string, string> = (() => {
  const idx: Record<string, string> = {};
  for (const n of COUNTRY_NAMES) idx[norm(n)] = n;
  for (const n of ISLAND_NAMES) idx[norm(n)] = n; // insulares (modos quiz)
  for (const k in NE_ALIAS) idx[k] = NE_ALIAS[k];
  return idx;
})();

// Caché de módulo: una sola descarga por sesión, compartida entre modos.
let cache: Map<string, AtlasFeature> | null = null;
let inflight: Promise<Map<string, AtlasFeature>> | null = null;

export async function loadAtlas(): Promise<Map<string, AtlasFeature>> {
  if (cache) return cache;
  if (inflight) return inflight;
  inflight = (async () => {
    const topo = await (await fetch(ATLAS_URL)).json();
    const geo = feature(topo, topo.objects.countries) as unknown as { features: AtlasFeature[] };
    const map = new Map<string, AtlasFeature>();
    for (const f of geo.features) {
      const canonical = NAME_INDEX[norm(String(f.properties?.name ?? ""))];
      if (canonical && !map.has(canonical)) map.set(canonical, f);
    }
    cache = map;
    return map;
  })();
  return inflight;
}

// Feature de un país por nombre canónico (null si el atlas no lo trae).
export async function featureForCountry(name: string): Promise<AtlasFeature | null> {
  const map = await loadAtlas();
  return map.get(name) ?? null;
}
