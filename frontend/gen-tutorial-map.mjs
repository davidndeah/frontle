// Genera app/lib/tutorialMap.ts: paths del mini-tablero demo del tutorial
// (Portugal → Alemania, error amarillo: Suiza) — misma proyección del video.
import { geoEqualEarth, geoPath, geoCentroid, geoGraticule } from "d3-geo";
import { feature } from "topojson-client";
import { writeFileSync } from "fs";

const topo = await (await fetch("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json")).json();
const world = feature(topo, topo.objects.countries);

const NAMES = { Portugal: "pt", Spain: "es", Switzerland: "ch", France: "fr", Germany: "de", Morocco: "ma" };
const featBy = {};
for (const f of world.features) if (f.properties.name in NAMES) featBy[f.properties.name] = f;

// Marruecos entra al encuadre para el ejemplo del semáforo rojo
const anchors = [featBy.Portugal, featBy.Germany, featBy.Morocco];
const fc = { type: "FeatureCollection", features: anchors };
const [lon] = geoCentroid(fc);
const proj = geoEqualEarth().rotate([-lon, 0]).fitExtent([[24, 20], [616, 340]], fc);
const pg = geoPath(proj);

// Siluetas de contexto: solo países visibles en el viewBox (bundle liviano)
const all = [];
for (const f of world.features) {
  const b = pg.bounds(f);
  if (!b || !isFinite(b[0][0])) continue;
  if (b[1][0] < -30 || b[0][0] > 670 || b[1][1] < -30 || b[0][1] > 390) continue;
  const d = pg(f);
  if (d) all.push(d);
}

const play = Object.entries(NAMES).map(([name, code]) => ({ name, code, d: pg(featBy[name]) || "" }));

// Graticule recortado al área visible (invierte las esquinas del viewBox)
const corners = [[0, 0], [640, 0], [0, 360], [640, 360], [320, 0], [320, 360]]
  .map((p) => proj.invert(p)).filter(Boolean);
const lons = corners.map((c) => c[0]), lats = corners.map((c) => c[1]);
const grat = pg(
  geoGraticule()
    .extent([[Math.min(...lons) - 5, Math.min(...lats) - 5], [Math.max(...lons) + 5, Math.max(...lats) + 5]])
    .step([10, 10])()
) || "";

const ts = `// Autogenerado por gen-tutorial-map.mjs — mini-mapa del tutorial (Portugal → Alemania)
export const TUTORIAL_MAP = {
  viewBox: "0 0 640 360",
  grat: ${JSON.stringify(grat)},
  all: ${JSON.stringify(all)},
  play: ${JSON.stringify(play)},
};
`;
writeFileSync("app/lib/tutorialMap.ts", ts, "utf-8");
console.log(`tutorialMap.ts: ${play.length} países del demo + ${all.length} siluetas (${Math.round(ts.length / 1024)}KB)`);
