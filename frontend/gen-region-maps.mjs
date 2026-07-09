// Genera public/maps/{co,us}.json: TopoJSON por región con
// properties.name = nombre canónico de regions/*.ts (match exacto con el juego).
// Se corre una vez y los outputs van commiteados (runtime no depende de CDNs).
import { feature } from "topojson-client";
import { geoArea } from "d3-geo";
import { writeFileSync, readFileSync } from "fs";

// geoBoundaries trae winding RFC7946 (planar); d3 usa winding esférico.
// Si un polígono "cubre" más de media esfera, hay que invertir sus anillos.
function rewind(geometry) {
  const fix = (poly) => {
    const test = { type: "Polygon", coordinates: poly };
    if (geoArea(test) > Math.PI) for (const ring of poly) ring.reverse();
    return poly;
  };
  if (geometry.type === "Polygon") fix(geometry.coordinates);
  else if (geometry.type === "MultiPolygon") geometry.coordinates.forEach(fix);
  return geometry;
}

// nombres canónicos desde los .ts (regex, sin compilar TS)
function canonicalNames(path) {
  const src = readFileSync(path, "utf-8");
  return [...src.matchAll(/\{ name: "([^"]+)", code: "([^"]+)"/g)].map((m) => ({ name: m[1], code: m[2] }));
}
const CO = canonicalNames("app/lib/regions/colombia.ts");
const US = canonicalNames("app/lib/regions/usa.ts");

const norm = (s) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/\bdepartment\b|\bdepartamento( del?)?\b/g, "")
    .replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ").trim();

// Alias de los datasets → canónico
const CO_ALIAS = {
  "santafe de bogota": "Bogotá D.C.",
  "bogota capital district": "Bogotá D.C.",
  "bogota": "Bogotá D.C.",
  "bogota d c": "Bogotá D.C.",
  "distrito capital de bogota": "Bogotá D.C.",
  "norte de santander": "Norte de Santander",
  "valle del cauca": "Valle del Cauca",
  "la guajira": "La Guajira",
  "guajira": "La Guajira",
  "narino": "Nariño",
  "choco": "Chocó",
  "atlantico": "Atlántico",
  "bolivar": "Bolívar",
  "boyaca": "Boyacá",
  "caqueta": "Caquetá",
  "cordoba": "Córdoba",
  "guainia": "Guainía",
  "quindio": "Quindío",
  "vaupes": "Vaupés",
};

async function build(regionId, url, wanted, aliasMap, objectKeyHint, kind = "topo") {
  const data = await (await fetch(url)).json();
  let geo;
  if (kind === "topo") {
    const objKey = objectKeyHint ?? Object.keys(data.objects)[0];
    geo = feature(data, data.objects[objKey]);
  } else {
    geo = data; // GeoJSON FeatureCollection directo
  }

  const wantedByNorm = new Map(wanted.map((w) => [norm(w.name), w]));
  const out = [];
  const seen = new Set();
  for (const f of geo.features) {
    const raw = String(
      f.properties?.name ?? f.properties?.NAME ?? f.properties?.shapeName ?? f.properties?.NOMBRE_DPT ?? f.properties?.NAME_1 ?? ""
    );
    const n = norm(raw);
    const canonical = aliasMap?.[n] ? wantedByNorm.get(norm(aliasMap[n])) : wantedByNorm.get(n);
    if (!canonical || seen.has(canonical.name)) continue;
    seen.add(canonical.name);
    out.push({ type: "Feature", properties: { name: canonical.name, code: canonical.code }, geometry: f.geometry });
  }
  const missing = wanted.filter((w) => !seen.has(w.name));
  console.log(`[${regionId}] ${out.length}/${wanted.length} matcheados`, missing.length ? `FALTAN: ${missing.map((m) => m.name).join(", ")}` : "✓");
  // guardamos GeoJSON directo (simple de consumir); precisión 4 decimales (~11m)
  const round = (x) => Math.round(x * 1e4) / 1e4;
  // adelgaza anillos largos (1 de cada 2 vértices) — es un mapa de relleno, no de agrimensura
  const thinRing = (ring) =>
    ring.length > 80 ? ring.filter((_, i) => i % 2 === 0 || i === ring.length - 1) : ring;
  const shrink = (coords, depth = 0) => {
    if (typeof coords[0] === "number") return coords.map(round);
    // un "ring" es un array de pares [x,y]
    if (typeof coords[0][0] === "number") return thinRing(coords).map((p) => p.map(round));
    return coords.map((c) => shrink(c, depth + 1));
  };
  for (const f of out) {
    f.geometry.coordinates = shrink(f.geometry.coordinates);
    rewind(f.geometry);
  }
  const fc = { type: "FeatureCollection", features: out };
  const json = JSON.stringify(fc);
  writeFileSync(`public/maps/${regionId}.json`, json, "utf-8");
  console.log(`[${regionId}] public/maps/${regionId}.json (${Math.round(json.length / 1024)}KB)`);
  return missing.length === 0;
}

import { mkdirSync } from "fs";
mkdirSync("public/maps", { recursive: true });

const okUS = await build(
  "us",
  "https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json",
  US,
  null,
  "states"
);
// Colombia: geoBoundaries ADM1 (open data). La API da el link del GeoJSON simplificado.
const meta = await (await fetch("https://www.geoboundaries.org/api/current/gbOpen/COL/ADM1/")).json();
const coUrl = meta.simplifiedGeometryGeoJSON ?? meta.gjDownloadURL;
console.log("[co] fuente:", coUrl);
const okCO = await build("co", coUrl, CO, CO_ALIAS, null, "geo");
process.exit(okUS && okCO ? 0 : 1);
