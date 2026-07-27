// ============================================================
//  Frontle — Genera los contornos simplificados para el arte del Home:
//  regiones (con departamentos/estados), siluetas del mundo y siluetas
//  de continente.
//
//  Los GeoJSON de public/maps/*.json pesan 1.1 MB entre los seis;
//  descargarlos para decorar una ficha de 84px sería absurdo. Este
//  script los proyecta una sola vez (misma geoMercator + fitExtent que
//  RegionMapPreview, para que la silueta sea LA MISMA que ve el jugador
//  al abrir el modo), los simplifica con Douglas-Peucker y escupe un
//  módulo TS con un único path por país que incluye TODAS las fronteras
//  internas de departamentos/estados — que es justo lo que se quiere ver.
//
//  Uso:  node scripts/gen-outlines.mjs  (necesita red: atlas mundial +
//  un dataset ISO numérico→alpha-2 para las siluetas de continente)
//  Reescribe app/lib/regionOutlines.ts, app/lib/countryOutlines.ts y
//  app/lib/continentOutlines.ts. Solo hay que volver a correrlo si
//  cambia un mapa, la lista de países o continents.ts.
// ============================================================
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { geoMercator } from "d3-geo";
import { feature as topoFeature, merge as topoMerge } from "topojson-client";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// Mismo atlas que lib/atlas.ts usa en runtime para el modo "Adivina el país":
// si el juego enseña esta silueta, el arte de la ficha debe ser la misma.
const ATLAS_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";
// El atlas solo trae el id ISO 3166-1 NUMÉRICO por país (p.ej. "170" =
// Colombia); continents.ts está indexado por alpha-2. Este dataset trae
// la conversión numérico→alpha-2 para las ~177 entradas del atlas.
const WORLD_COUNTRIES_URL = "https://cdn.jsdelivr.net/npm/world-countries@5/countries.json";

// Caja del viewBox del arte. 100x100 con margen: el CSS lo escala a la
// ficha, así que las unidades aquí son "porcentaje del arte".
const BOX = 100;
const PAD = 4;
// Tolerancia de Douglas-Peucker en unidades de la caja. 0.8 ≈ 0.7px a
// tamaño de ficha (84px): por debajo de eso el detalle es invisible y
// solo engorda el bundle.
const EPS = 0.8;
// Anillos más chicos que esto (lado del bounding box) se tiran: son islas
// y motas de costa que a este tamaño solo son ruido de un píxel.
const MIN_RING = 0.9;

// --- Douglas-Peucker sobre puntos ya proyectados ---
function dp(pts, eps) {
  if (pts.length < 3) return pts;
  const [ax, ay] = pts[0];
  const [bx, by] = pts[pts.length - 1];
  const dx = bx - ax;
  const dy = by - ay;
  const norm = Math.hypot(dx, dy);
  let far = 0;
  let idx = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const [px, py] = pts[i];
    // Distancia punto-recta; si el segmento es degenerado, distancia al punto.
    const d = norm === 0
      ? Math.hypot(px - ax, py - ay)
      : Math.abs(dy * px - dx * py + bx * ay - by * ax) / norm;
    if (d > far) { far = d; idx = i; }
  }
  if (far <= eps) return [pts[0], pts[pts.length - 1]];
  return [...dp(pts.slice(0, idx + 1), eps).slice(0, -1), ...dp(pts.slice(idx), eps)];
}

function ringsOf(geometry) {
  if (!geometry) return [];
  if (geometry.type === "Polygon") return geometry.coordinates;
  if (geometry.type === "MultiPolygon") return geometry.coordinates.flat();
  return [];
}

// Fiji (y solo Fiji, de los países que este script toca) cruza el
// antimeridiano: su geometría en el atlas trae un anillo con puntos en
// AMBOS lados de 180°/-180° (ej. 179.4 seguido de -180.0). El intento
// obvio de arreglarlo — sumar 360° a las longitudes negativas para dejar
// la secuencia continua (179.4 → 180.2) — NO funciona: se probó y se
// confirmó con un test aislado que d3 normaliza CUALQUIER longitud de
// vuelta al rango (-180°,180°] dentro de su pipeline de proyección, sin
// importar preclip/rotate. O sea que geoMercator([180.2, y]) y
// geoMercator([-179.8, y]) proyectan al MISMO punto — el "arreglo" se
// deshace solo. Sin trabajar contra la proyección, la fábrica más simple
// y honesta es tirar el anillo problemático: es una ficha decorativa de
// 84px, no el mapa de juego, y ya se tiran islas chicas por MIN_RING —
// esto es lo mismo en espíritu. Cualquier anillo cuyo span de longitud
// cruda supere 180° (ningún país real de este script mide tanto — el
// otro caso, Rusia, ya se excluye antes de llegar aquí) se descarta
// entero en vez de intentar repararlo.
function dropAntimeridianRings(geometry) {
  if (!geometry) return geometry;
  const spanOf = (ring) => {
    const lons = ring.map((c) => c[0]);
    return Math.max(...lons) - Math.min(...lons);
  };
  if (geometry.type === "Polygon") {
    if (spanOf(geometry.coordinates[0]) > 180) return { ...geometry, coordinates: [] };
    return geometry;
  }
  if (geometry.type === "MultiPolygon") {
    return { ...geometry, coordinates: geometry.coordinates.filter((poly) => spanOf(poly[0]) <= 180) };
  }
  return geometry;
}

const r1 = (n) => {
  const v = Math.round(n * 10) / 10;
  return Object.is(v, -0) ? 0 : v;
};

function outlineFor(geo, minRing = MIN_RING) {
  // Antes de construir el fc para fitExtent: si se descarta DESPUÉS, el
  // fitExtent ya midió su bbox sobre la geometría cruda (con el anillo
  // que cruza el antimeridiano) y queda corrupto igual.
  const features = geo.features.map((f) => ({ ...f, geometry: dropAntimeridianRings(f.geometry) }));
  const fc = { type: "FeatureCollection", features };
  const proj = geoMercator().fitExtent([[PAD, PAD], [BOX - PAD, BOX - PAD]], fc);
  const subpaths = [];
  let ptsIn = 0;
  let ptsOut = 0;
  for (const f of features) {
    for (const ring of ringsOf(f.geometry)) {
      const projected = ring.map((c) => proj(c)).filter((p) => p && Number.isFinite(p[0]) && Number.isFinite(p[1]));
      if (projected.length < 4) continue;
      const xs = projected.map((p) => p[0]);
      const ys = projected.map((p) => p[1]);
      const side = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
      if (side < minRing) continue;
      ptsIn += projected.length;
      const simple = dp(projected, EPS);
      if (simple.length < 3) continue;
      ptsOut += simple.length;
      subpaths.push(simple);
    }
  }
  // Reencuadre final. fitExtent encuadró la geometría COMPLETA, pero después
  // tiramos islas y motas (MIN_RING), así que lo que queda puede no llenar la
  // caja ni quedar centrado (Brasil se iba 6 unidades a la izquierda por culpa
  // de Fernando de Noronha). Se reescala uniforme —mismo aspecto Mercator—
  // para que los seis ocupen lo mismo: en un ciclo, que uno se vea más chico
  // que el resto se lee como un fallo, no como que ese país sea más chico.
  const all = subpaths.flat();
  const xs = all.map((p) => p[0]);
  const ys = all.map((p) => p[1]);
  const [x0, x1] = [Math.min(...xs), Math.max(...xs)];
  const [y0, y1] = [Math.min(...ys), Math.max(...ys)];
  const inner = BOX - PAD * 2;
  const k = Math.min(inner / (x1 - x0), inner / (y1 - y0));
  const ox = (BOX - (x1 - x0) * k) / 2 - x0 * k;
  const oy = (BOX - (y1 - y0) * k) / 2 - y0 * k;
  const d = subpaths
    .map((ring) => ring.map(([x, y], i) => `${i === 0 ? "M" : "L"}${r1(x * k + ox)} ${r1(y * k + oy)}`).join("") + "Z")
    .join("");
  return { d, rings: subpaths.length, ptsIn, ptsOut };
}

// ============================================================
//  1) Regiones — países jugables con sus departamentos/estados
// ============================================================
const ids = readdirSync(join(ROOT, "public/maps"))
  .filter((f) => f.endsWith(".json"))
  .map((f) => f.replace(/\.json$/, ""))
  .sort();

const entries = [];
let totalIn = 0;
let totalOut = 0;
for (const id of ids) {
  const geo = JSON.parse(readFileSync(join(ROOT, `public/maps/${id}.json`), "utf8"));
  const { d, rings, ptsIn, ptsOut } = outlineFor(geo);
  totalIn += ptsIn;
  totalOut += ptsOut;
  entries.push({ id, d, subs: geo.features.length });
  console.log(`${id}: ${geo.features.length} subdivisiones, ${rings} anillos, ${ptsIn} → ${ptsOut} puntos, ${(d.length / 1024).toFixed(1)} KB`);
}

const bytes = entries.reduce((s, e) => s + e.d.length, 0);
console.log(`\nRegiones: ${totalIn} → ${totalOut} puntos (${((1 - totalOut / totalIn) * 100).toFixed(1)}% menos), ${(bytes / 1024).toFixed(1)} KB de paths`);

writeFileSync(join(ROOT, "app/lib/regionOutlines.ts"), `// ============================================================
//  GENERADO — no editar a mano.
//  Fuente: public/maps/*.json  ·  Generador: scripts/gen-outlines.mjs
//  Regenerar con:  node scripts/gen-outlines.mjs
//
//  Un path por país, en un viewBox de ${BOX}x${BOX}, con TODAS las fronteras
//  internas de departamentos/estados (cada subdivisión es un subpath \`M…Z\`).
//  Misma proyección que RegionMapPreview (geoMercator + fitExtent), así que
//  la silueta del arte es la misma que el jugador ve al abrir el modo.
//  Simplificado con Douglas-Peucker (ε=${EPS} unidades de caja ≈ 0.7px en la
//  ficha): ${totalIn} → ${totalOut} puntos.
// ============================================================

export const REGION_OUTLINE_BOX = ${BOX};

export const REGION_OUTLINES: Record<string, string> = {
${entries.map((e) => `  // ${e.id} — ${e.subs} subdivisiones\n  ${e.id}: "${e.d}",`).join("\n")}
};
`, "utf8");
console.log("→ app/lib/regionOutlines.ts");

// ============================================================
//  2) Siluetas del mundo — arte de la ficha "Adivina el país"
// ============================================================
//  Seis siluetas muy reconocibles y deliberadamente FUERA de las seis
//  regiones jugables: las dos fichas van en fase, así que si repitieran
//  país se vería la misma silueta dos veces a la vez.
//  Nombres tal cual los trae Natural Earth (properties.name); si alguno
//  dejara de existir, el script revienta en vez de emitir un hueco.
//  Chile se probó y se descartó: su silueta real es un w/h de 0.18, o sea
//  una astilla de 11px en la ficha. Auténtico, pero rompe el ritmo del
//  ciclo — al lado de las otras cinco se lee como un fallo de render.
const WORLD = ["Italy", "India", "Japan", "Australia", "Madagascar", "United Kingdom"];

const atlasRaw = await fetch(ATLAS_URL).then((r) => {
  if (!r.ok) throw new Error(`atlas HTTP ${r.status}`);
  return r.json();
});
const world = topoFeature(atlasRaw, atlasRaw.objects.countries);

const worldEntries = [];
let wIn = 0;
let wOut = 0;
for (const name of WORLD) {
  const f = world.features.find((x) => x.properties?.name === name);
  if (!f) throw new Error(`país no encontrado en el atlas: ${name}`);
  // Una sola "subdivisión": aquí no hay fronteras internas, es la silueta.
  const { d, rings, ptsIn, ptsOut } = outlineFor({ features: [f] });
  wIn += ptsIn;
  wOut += ptsOut;
  worldEntries.push({ name, d });
  console.log(`${name}: ${rings} anillos, ${ptsIn} → ${ptsOut} puntos, ${(d.length / 1024).toFixed(1)} KB`);
}

const wBytes = worldEntries.reduce((s, e) => s + e.d.length, 0);
console.log(`\nMundo: ${wIn} → ${wOut} puntos (${((1 - wOut / wIn) * 100).toFixed(1)}% menos), ${(wBytes / 1024).toFixed(1)} KB de paths`);

writeFileSync(join(ROOT, "app/lib/countryOutlines.ts"), `// ============================================================
//  GENERADO — no editar a mano.
//  Fuente: ${ATLAS_URL}
//  Generador: scripts/gen-outlines.mjs (necesita red para bajar el atlas)
//  Regenerar con:  node scripts/gen-outlines.mjs
//
//  Siluetas de países en un viewBox de ${BOX}x${BOX}, sin fronteras internas
//  — el mismo atlas 110m que usa CountryOutline en el modo de juego.
//  Simplificado con Douglas-Peucker: ${wIn} → ${wOut} puntos.
// ============================================================

export const COUNTRY_OUTLINES: [name: string, d: string][] = [
${worldEntries.map((e) => `  ["${e.name}", "${e.d}"],`).join("\n")}
];
`, "utf8");
console.log("→ app/lib/countryOutlines.ts");

// ============================================================
//  3) Siluetas de continente — cartas selladas del reto diario
// ============================================================
//  Un solo path por continente (6), fusionando TODOS los países de
//  CONTINENT_OF con sus fronteras internas dissueltas: topojson-client
//  `merge()` está hecho justo para esto (dos países vecinos comparten
//  arco en la topología, así que la línea entre ellos desaparece sola,
//  sin necesitar un algoritmo de unión geométrico).
//
//  El continente de cada país se PARSEA de continents.ts (no se duplica
//  a mano): así nunca se desincroniza con las pistas de quiz/logros.
//  El atlas solo da el id numérico ISO por país, así que hace falta
//  convertirlo a alpha-2 vía WORLD_COUNTRIES_URL antes de mirar la tabla.
//
//  DOS excepciones, solo para esta silueta decorativa — CONTINENT_OF y
//  toda la lógica real de juego (pistas, logros, niveles) quedan intactas:
//   · Rusia queda FUERA de "EU". Su propio territorio se extiende de
//     Portugal a Kamchatka; incluirlo encoge la Europa reconocible
//     (España↔Ucrania) a una astilla en la esquina de un mapa dominado
//     por Siberia — lo contrario de "reconocible" en una ficha de 84px.
//     Efecto colateral aceptado: Escandinavia se separa del resto de
//     Europa en la silueta, porque su único enlace terrestre real es vía
//     Rusia — "Europa" queda en 2 piezas en vez de 1, pero las dos se
//     siguen leyendo bien.
//   · A Francia se le quita el anillo de la Guayana Francesa: su propia
//     geometría en el atlas la trae como una pieza en Sudamérica
//     (lon -54..-51) — un territorio de ultramar, no el continente real
//     donde vive el resto de Francia.
const CONTINENT_OF = (() => {
  const src = readFileSync(join(ROOT, "app/lib/continents.ts"), "utf8");
  const re = /^\s*([A-Z]{2}):\s*"([A-Z]{2})",?\s*$/gm;
  const out = {};
  let m;
  while ((m = re.exec(src))) out[m[1]] = m[2];
  return out;
})();
console.log(`\ncontinents.ts: ${Object.keys(CONTINENT_OF).length} países con continente asignado`);

const wcRaw = await fetch(WORLD_COUNTRIES_URL).then((r) => {
  if (!r.ok) throw new Error(`world-countries HTTP ${r.status}`);
  return r.json();
});
const ccn3ToCca2 = {};
for (const c of wcRaw) if (c.ccn3) ccn3ToCca2[c.ccn3] = c.cca2;

// Territorios cuyo id en el atlas no resuelve a un alpha-2 vía
// WORLD_COUNTRIES_URL (disputados, o el dataset no los trae con ccn3):
// continente asignado a mano por geografía real. "010" Antártida y "260"
// Tierras Australes Francesas quedan FUERA a propósito — ninguno de los
// 6 continentes del juego las cubre.
const ID_OVERRIDES = { "238": "SA", "304": "NA", "630": "NA", "275": "AS", "540": "OC" };

const allGeoms = atlasRaw.objects.countries.geometries;

const franceIdx = allGeoms.findIndex((g) => g.properties?.name === "France");
if (franceIdx < 0) throw new Error("Francia no está en el atlas (necesaria para recortar Guayana Francesa)");
const franceFeat = topoFeature(atlasRaw, allGeoms[franceIdx]);
const guianaRingIdx = franceFeat.geometry.coordinates.findIndex((poly) => poly[0].every((c) => c[0] < -40));
if (guianaRingIdx < 0) throw new Error("no se encontró el anillo de Guayana Francesa en Francia — ¿cambió el atlas?");
const franceSinGuayana = { ...allGeoms[franceIdx], arcs: allGeoms[franceIdx].arcs.filter((_, i) => i !== guianaRingIdx) };

// Piso de "ruido" más alto que el de países/regiones (0.9): un continente
// tiene mucha más área total, así que motas de costa que allá eran
// invisibles aquí siguen siendo visibles — y hay muchas más (islas del
// Caribe, del Pacífico...). Sin subir el piso la silueta queda con
// decenas de puntitos ilegibles a 84px.
const CONTINENT_MIN_RING = 4;

const continentGroups = { AF: [], EU: [], AS: [], NA: [], SA: [], OC: [] };
let sinContinente = 0;
for (const g of allGeoms) {
  if (g.properties?.name === "Russia") continue; // ver nota arriba
  const cca2 = ccn3ToCca2[g.id];
  const code = ID_OVERRIDES[g.id] ?? (cca2 ? CONTINENT_OF[cca2] : undefined);
  if (!code) { sinContinente++; continue; }
  continentGroups[code].push(g.properties?.name === "France" ? franceSinGuayana : g);
}
console.log(`${sinContinente} entradas del atlas sin continente asignado (disputadas/Antártida — se ignoran)`);

const continentEntries = [];
let contIn = 0;
let contOut = 0;
for (const [code, list] of Object.entries(continentGroups)) {
  const merged = topoMerge(atlasRaw, list);
  const { d, rings, ptsIn, ptsOut } = outlineFor({ features: [{ type: "Feature", geometry: merged, properties: {} }] }, CONTINENT_MIN_RING);
  contIn += ptsIn;
  contOut += ptsOut;
  continentEntries.push({ code, d, countries: list.length });
  console.log(`${code}: ${list.length} países, ${rings} anillos, ${ptsIn} → ${ptsOut} puntos, ${(d.length / 1024).toFixed(1)} KB`);
}

const contBytes = continentEntries.reduce((s, e) => s + e.d.length, 0);
console.log(`\nContinentes: ${contIn} → ${contOut} puntos (${((1 - contOut / contIn) * 100).toFixed(1)}% menos), ${(contBytes / 1024).toFixed(1)} KB de paths`);

writeFileSync(join(ROOT, "app/lib/continentOutlines.ts"), `// ============================================================
//  GENERADO — no editar a mano.
//  Fuentes: ${ATLAS_URL}
//           ${WORLD_COUNTRIES_URL} (numérico ISO → alpha-2)
//           app/lib/continents.ts (país → continente, parseado en build)
//  Generador: scripts/gen-outlines.mjs (necesita red)
//  Regenerar con:  node scripts/gen-outlines.mjs
//
//  Silueta de cada continente (fronteras entre países ya dissueltas vía
//  topojson merge()) en un viewBox de ${BOX}x${BOX}. Rusia queda fuera de
//  "EU" y Francia pierde su anillo de Guayana Francesa — ver la nota
//  larga en el generador. Simplificado con Douglas-Peucker (piso de
//  ruido más alto que países/regiones: ${CONTINENT_MIN_RING} vs ${MIN_RING}):
//  ${contIn} → ${contOut} puntos.
// ============================================================

export const CONTINENT_OUTLINE_BOX = ${BOX};

export const CONTINENT_OUTLINES: Record<"AF" | "EU" | "AS" | "NA" | "SA" | "OC", string> = {
${continentEntries.map((e) => `  // ${e.code} — ${e.countries} países fusionados\n  ${e.code}: "${e.d}",`).join("\n")}
};
`, "utf8");
console.log("→ app/lib/continentOutlines.ts");
