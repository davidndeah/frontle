// ============================================================
//  Frontle — Genera los contornos simplificados de las regiones
//  para el arte animado de la ficha "Regiones" del Home.
//
//  Los GeoJSON de public/maps/*.json pesan 1.1 MB entre los seis;
//  descargarlos para decorar una ficha de 84px sería absurdo. Este
//  script los proyecta una sola vez (misma geoMercator + fitExtent que
//  RegionMapPreview, para que la silueta sea LA MISMA que ve el jugador
//  al abrir el modo), los simplifica con Douglas-Peucker y escupe un
//  módulo TS con un único path por país que incluye TODAS las fronteras
//  internas de departamentos/estados — que es justo lo que se quiere ver.
//
//  Uso:  node scripts/gen-region-outlines.mjs
//  Reescribe app/lib/regionOutlines.ts. Solo hay que volver a correrlo
//  si cambia un public/maps/*.json.
// ============================================================
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { geoMercator } from "d3-geo";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

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

const r1 = (n) => {
  const v = Math.round(n * 10) / 10;
  return Object.is(v, -0) ? 0 : v;
};

function outlineFor(geo) {
  const fc = { type: "FeatureCollection", features: geo.features };
  const proj = geoMercator().fitExtent([[PAD, PAD], [BOX - PAD, BOX - PAD]], fc);
  const subpaths = [];
  let ptsIn = 0;
  let ptsOut = 0;
  for (const f of geo.features) {
    for (const ring of ringsOf(f.geometry)) {
      const projected = ring.map((c) => proj(c)).filter((p) => p && Number.isFinite(p[0]) && Number.isFinite(p[1]));
      if (projected.length < 4) continue;
      const xs = projected.map((p) => p[0]);
      const ys = projected.map((p) => p[1]);
      const side = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
      if (side < MIN_RING) continue;
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
console.log(`\nTotal: ${totalIn} → ${totalOut} puntos (${((1 - totalOut / totalIn) * 100).toFixed(1)}% menos), ${(bytes / 1024).toFixed(1)} KB de paths`);

const out = `// ============================================================
//  GENERADO — no editar a mano.
//  Fuente: public/maps/*.json  ·  Generador: scripts/gen-region-outlines.mjs
//  Regenerar con:  node scripts/gen-region-outlines.mjs
//
//  Un path por país, en un viewBox de ${BOX}x${BOX}, con TODAS las fronteras
//  internas de departamentos/estados (cada subdivisión es un subpath \`M…Z\`).
//  Misma proyección que RegionMapPreview (geoMercator + fitExtent), así que
//  la silueta del arte es la misma que el jugador ve al abrir el modo.
//  Simplificado con Douglas-Peucker (ε=${EPS} unidades de caja ≈ 0.4px en la
//  ficha): ${totalIn} → ${totalOut} puntos.
// ============================================================

export const REGION_OUTLINE_BOX = ${BOX};

export const REGION_OUTLINES: Record<string, string> = {
${entries.map((e) => `  // ${e.id} — ${e.subs} subdivisiones\n  ${e.id}: "${e.d}",`).join("\n")}
};
`;

writeFileSync(join(ROOT, "app/lib/regionOutlines.ts"), out, "utf8");
console.log("\n→ app/lib/regionOutlines.ts");
