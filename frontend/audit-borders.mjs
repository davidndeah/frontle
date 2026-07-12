// ============================================================
//  Frontle — Auditoría del grafo mundial de fronteras (BUG-1).
//  Deriva la adyacencia país↔país desde la geometría de Natural Earth
//  (subdivisiones admin_1 agrupadas por país; dos países son vecinos si
//  alguna subdivisión de uno comparte puntos de frontera con una del otro,
//  cuantizados a rejilla — misma técnica que gen-region.mjs) y hace DIFF
//  contra COUNTRIES (countries.ts):
//    · FALTAN: aristas que la geometría ve y el grafo no tiene (candidatas
//      a fronteras reales omitidas → el bug de "conecté y no gané").
//    · SOBRAN: aristas del grafo que la geometría no ve (sospechosas, a
//      revisar a mano; puentes/causeways pueden ser legítimos).
//  Uso: node audit-borders.mjs
// ============================================================
import { readFileSync } from "fs";

const PREC = 100; // rejilla ~1.1 km (igual que gen-region.mjs)
const SHARE = 2;  // mínimo de puntos compartidos para contar frontera

// --- Grafo actual (countries.ts) ---
const src = readFileSync("app/lib/countries.ts", "utf-8");
const G = {};
const codeOf = {}; // name -> ISO2 (desde el emoji de bandera)
for (const m of src.matchAll(/name:\s*"([^"]+)",\s*flag:\s*"([^"]+)",\s*neighbors:\s*\[([^\]]*)\]/g)) {
  const name = m[1];
  const flag = m[2];
  G[name] = [...m[3].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
  const cps = [...flag].map((c) => c.codePointAt(0) ?? 0).filter((cp) => cp >= 0x1f1e6 && cp <= 0x1f1ff);
  codeOf[name] = cps.map((cp) => String.fromCharCode(cp - 0x1f1e6 + 65)).join("");
}
for (const [a, nbs] of Object.entries(G)) for (const b of nbs) if (G[b] && !G[b].includes(a)) G[b].push(a);
const nameByCode = Object.fromEntries(Object.entries(codeOf).map(([n, c]) => [c, n]));
console.log(`grafo actual: ${Object.keys(G).length} países`);

// --- Geometría NE admin_1 agrupada por país (iso_a2) ---
console.log("cargando Natural Earth admin_1 (cache)…");
const ne = JSON.parse(readFileSync("_ne_admin1.geojson", "utf-8"));
const boundaryByCountry = new Map(); // iso2 -> Set("x,y")
let skipped = 0;
for (const f of ne.features) {
  let iso2 = f.properties?.iso_a2;
  if (!iso2 || iso2 === "-99") { skipped++; continue; }
  iso2 = iso2.toUpperCase();
  if (!nameByCode[iso2]) continue; // país que el juego no tiene (islas, etc.)
  let set = boundaryByCountry.get(iso2);
  if (!set) boundaryByCountry.set(iso2, (set = new Set()));
  const addRing = (ring) => { for (const p of ring) set.add(Math.round(p[0] * PREC) + "," + Math.round(p[1] * PREC)); };
  const g = f.geometry;
  if (!g) continue;
  if (g.type === "Polygon") g.coordinates.forEach(addRing);
  else if (g.type === "MultiPolygon") g.coordinates.forEach((poly) => poly.forEach(addRing));
}
console.log(`países con geometría: ${boundaryByCountry.size} (features sin iso2 saltadas: ${skipped})`);

// --- Adyacencia geométrica país↔país ---
const codes = [...boundaryByCountry.keys()];
const geoAdj = new Map(); // iso2 -> Set(iso2)
for (const c of codes) geoAdj.set(c, new Set());
for (let i = 0; i < codes.length; i++) {
  for (let j = i + 1; j < codes.length; j++) {
    const A = boundaryByCountry.get(codes[i]);
    const B = boundaryByCountry.get(codes[j]);
    const [small, big] = A.size < B.size ? [A, B] : [B, A];
    let shared = 0;
    for (const p of small) { if (big.has(p)) { shared++; if (shared >= SHARE) break; } }
    if (shared >= SHARE) { geoAdj.get(codes[i]).add(codes[j]); geoAdj.get(codes[j]).add(codes[i]); }
  }
}

// --- DIFF ---
const missing = []; // geometría los ve vecinos, grafo no
const extra = [];   // grafo los tiene, geometría no los ve
for (const [a2, nbs] of geoAdj) {
  const aName = nameByCode[a2];
  for (const b2 of nbs) {
    if (a2 >= b2) continue;
    const bName = nameByCode[b2];
    if (!G[aName]?.includes(bName)) missing.push(`${aName} ↔ ${bName}`);
  }
}
for (const [aName, nbs] of Object.entries(G)) {
  const a2 = codeOf[aName];
  for (const bName of nbs) {
    const b2 = codeOf[bName];
    if (aName >= bName) continue;
    if (!boundaryByCountry.has(a2) || !boundaryByCountry.has(b2)) continue; // sin geometría, no opinamos
    if (!geoAdj.get(a2)?.has(b2)) extra.push(`${aName} ↔ ${bName}`);
  }
}

console.log(`\n=== FALTAN en el grafo (la geometría los ve vecinos): ${missing.length} ===`);
missing.sort().forEach((x) => console.log("  + " + x));
console.log(`\n=== SOBRAN según la geometría (revisar a mano; puentes pueden ser legítimos): ${extra.length} ===`);
extra.sort().forEach((x) => console.log("  ? " + x));
