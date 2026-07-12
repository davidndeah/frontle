// ============================================================
//  Frontle — Generador consolidado de regiones (países).
//  Dado un país en CONFIG, hace TODO en una corrida:
//   1. Descarga el GeoJSON ADM1 (geoBoundaries).
//   2. Deriva la adyacencia desde la geometría (fronteras compartidas).
//   3. Emite app/lib/regions/<id>.ts (RegionDef) y public/maps/<id>.json.
//   4. Descarga banderas: subdivisiones (Wikidata P41) + nacional (flagcdn).
//   5. Valida simetría y conectividad (BFS) del grafo.
//
//  Uso:  node gen-region.mjs <id>       (ej: node gen-region.mjs ar)
//  Los outputs van commiteados; el runtime no depende de CDNs.
// ============================================================
import { writeFileSync, readFileSync, mkdirSync, existsSync } from "fs";
import { geoArea, geoMercator, geoPath } from "d3-geo";

// Fuente: Natural Earth 1:10m admin_1 (completa y correcta; geoBoundaries
// tiene huecos p.ej. le falta Entre Ríos en Argentina). Se cachea local.
const NE_URL = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_1_states_provinces.geojson";
const NE_CACHE = "_ne_admin1.geojson";
async function loadNaturalEarth() {
  if (existsSync(NE_CACHE)) return JSON.parse(readFileSync(NE_CACHE, "utf-8"));
  console.log("descargando Natural Earth admin_1 (una vez, ~40MB)…");
  const geo = await (await fetch(NE_URL)).json();
  writeFileSync(NE_CACHE, JSON.stringify(geo));
  return geo;
}

// --- Config por país. iso3=geoBoundaries · qid=Wikidata · iso2=flagcdn --------
const CONFIG = {
  ar: { iso3: "ARG", qid: "Q414",  iso2: "ar", title: "Argentina", exportName: "ARGENTINA", nounKey: "province",   lang: "es" },
  ng: { iso3: "NGA", qid: "Q1033", iso2: "ng", title: "Nigeria",   exportName: "NIGERIA",   nounKey: "state",      lang: "en" },
  // Ghana: NE trae las 10 regiones pre-2019; geoBoundaries sí tiene las 16 actuales.
  gh: { iso3: "GHA", qid: "Q117",  iso2: "gh", title: "Ghana",     exportName: "GHANA",     nounKey: "region",     lang: "en", source: "gb" },
  br: { iso3: "BRA", qid: "Q155",  iso2: "br", title: "Brasil",    exportName: "BRASIL",    nounKey: "state",      lang: "pt" },
};

// Precisión/umbral de la derivación de adyacencia (tuneable):
//  PREC=100 → rejilla ~1.1 km; dos subdivisiones son vecinas si comparten
//  >= SHARE puntos de frontera en esa rejilla (borde real, no esquina suelta).
const PREC = 100;
const SHARE = 2;

const norm = (s) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/\b(provincia|province|estado|state|region|regiao|departamento|department|etat|of|the|el|la|los|las|de|del|do|da)\b/g, " ")
    .replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

const flagEmoji = (iso2) =>
  iso2.toUpperCase().replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));

// --- Adyacencia por puntos de frontera compartidos (cuantizados) -------------
function boundaryPoints(geom) {
  const pts = new Set();
  const addRing = (ring) => { for (const p of ring) pts.add(Math.round(p[0] * PREC) + "," + Math.round(p[1] * PREC)); };
  if (geom.type === "Polygon") geom.coordinates.forEach(addRing);
  else if (geom.type === "MultiPolygon") geom.coordinates.forEach((poly) => poly.forEach(addRing));
  return pts;
}
function deriveNeighbors(items) {
  const sets = items.map((it) => boundaryPoints(it.geometry));
  const nbrs = items.map(() => new Set());
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      let shared = 0;
      const [a, b] = sets[i].size < sets[j].size ? [sets[i], sets[j]] : [sets[j], sets[i]];
      for (const p of a) { if (b.has(p)) { shared++; if (shared >= SHARE) break; } }
      if (shared >= SHARE) { nbrs[i].add(items[j].name); nbrs[j].add(items[i].name); }
    }
  }
  return nbrs.map((s) => [...s].sort());
}

// --- Códigos slug únicos por subdivisión -------------------------------------
function makeCodes(names) {
  const used = new Set(); const map = {};
  for (const name of names) {
    const base = norm(name).replace(/\s/g, "") || "x";
    let code = base.slice(0, 3), n = 3;
    while (used.has(code)) { n++; code = n <= base.length ? base.slice(0, n) : base + (used.size); }
    used.add(code); map[name] = code;
  }
  return map;
}

// --- Conectividad (BFS) ------------------------------------------------------
function isConnected(names, nbrOf) {
  if (names.length === 0) return false;
  const seen = new Set([names[0]]); const q = [names[0]];
  while (q.length) { for (const nb of nbrOf[q.shift()] ?? []) if (!seen.has(nb)) { seen.add(nb); q.push(nb); } }
  return seen.size === names.length;
}

// --- Limpieza de coordenadas para el mapa committeado ------------------------
function rewind(geometry) {
  const fix = (poly) => { if (geoArea({ type: "Polygon", coordinates: poly }) > Math.PI) for (const r of poly) r.reverse(); return poly; };
  if (geometry.type === "Polygon") fix(geometry.coordinates);
  else if (geometry.type === "MultiPolygon") geometry.coordinates.forEach(fix);
  return geometry;
}
const round = (x) => Math.round(x * 1e4) / 1e4;
const thinRing = (r) => (r.length > 80 ? r.filter((_, i) => i % 2 === 0 || i === r.length - 1) : r);
function shrink(coords) {
  if (typeof coords[0] === "number") return coords.map(round);
  if (typeof coords[0][0] === "number") return thinRing(coords).map((p) => p.map(round));
  return coords.map(shrink);
}

// --- Wikidata: banderas de subdivisiones (P41) -------------------------------
async function wikidataFlags(qid, lang) {
  const q = `SELECT ?itemLabel ?flag WHERE { ?item wdt:P17 wd:${qid} ; wdt:P41 ?flag ; wdt:P131 wd:${qid} .
    SERVICE wikibase:label { bd:serviceParam wikibase:language "${lang},en". } }`;
  const r = await fetch("https://query.wikidata.org/sparql?format=json&query=" + encodeURIComponent(q),
    { headers: { "User-Agent": "Frontle/1.0 (regions)", Accept: "application/json" } });
  const j = await r.json();
  return j.results.bindings.map((b) => ({ label: b.itemLabel.value, flag: b.flag.value }));
}
async function fetchRetry(url, tries = 5) {
  for (let i = 0; i < tries; i++) {
    const res = await fetch(url, { headers: { "User-Agent": "Frontle/1.0 (regions flags)" } });
    if (res.ok) return res;
    if (res.status === 429) { await new Promise((r) => setTimeout(r, Number(res.headers.get("retry-after")) * 1000 || 1500 * (i + 1))); continue; }
    return res;
  }
  return null;
}

// ============================================================
async function build(id) {
  const cfg = CONFIG[id];
  if (!cfg) throw new Error(`país sin config: ${id}. Añádelo a CONFIG.`);
  console.log(`\n=== ${cfg.title} (${id}) ===`);

  // 1. GeoJSON ADM1: Natural Earth por defecto; source:"gb" usa geoBoundaries
  // (mejor para países cuya división cambió hace poco, p.ej. Ghana 2019).
  let items;
  if (cfg.source === "gb") {
    const meta = await (await fetch(`https://www.geoboundaries.org/api/current/gbOpen/${cfg.iso3}/ADM1/`)).json();
    const geo = await (await fetch(meta.simplifiedGeometryGeoJSON ?? meta.gjDownloadURL)).json();
    items = geo.features
      .map((f) => ({ name: String(f.properties?.shapeName ?? "").replace(/\s+Region$/i, "").trim(), geometry: f.geometry }))
      .filter((it) => it.name);
  } else {
    const ne = await loadNaturalEarth();
    items = ne.features
      .filter((f) => f.properties?.adm0_a3 === cfg.iso3)
      .map((f) => ({ name: String(f.properties?.name ?? "").trim(), geometry: f.geometry }))
      .filter((it) => it.name);
  }
  console.log(`subdivisiones: ${items.length}`);
  if (items.length === 0) throw new Error(`la fuente no trae subdivisiones para ${cfg.iso3}.`);

  // 2. Adyacencia
  const nbrsArr = deriveNeighbors(items);
  items.forEach((it, i) => (it.neighbors = nbrsArr[i]));

  // Islas/exclaves sin vecinos: se excluyen (rompen el grafo del reto).
  const islands = items.filter((it) => it.neighbors.length === 0).map((it) => it.name);
  let kept = items.filter((it) => it.neighbors.length > 0);
  if (islands.length) console.log(`⚠ sin vecinos (excluidos): ${islands.join(", ")}`);

  // 3. Códigos + validación
  const codes = makeCodes(kept.map((it) => it.name));
  const keptNames = new Set(kept.map((it) => it.name));
  kept.forEach((it) => (it.neighbors = it.neighbors.filter((n) => keptNames.has(n)))); // no apuntar a excluidos
  const nbrOf = Object.fromEntries(kept.map((it) => [it.name, it.neighbors]));
  const connected = isConnected([...keptNames], nbrOf);
  console.log(`entidades finales: ${kept.length} · conexo: ${connected ? "sí ✓" : "NO ✗ (revisar PREC/SHARE)"}`);

  // 4. Emitir .ts
  kept.sort((a, b) => a.name.localeCompare(b.name));
  const entLines = kept.map((it) => {
    const nb = it.neighbors.map((n) => JSON.stringify(n)).join(", ");
    return `  { name: ${JSON.stringify(it.name)}, code: ${JSON.stringify(codes[it.name])}, neighbors: [${nb}] },`;
  }).join("\n");
  const ts = `// ============================================================
//  Frontle — Región: ${cfg.title} ${flagEmoji(cfg.iso2)}
//  ${kept.length} subdivisiones (${cfg.nounKey}). Adyacencia derivada de la geometría
//  (Natural Earth 10m admin_1) por gen-region.mjs. Revisar bordes dudosos a mano.
// ============================================================
import type { RegionDef, RegionEntity } from "./types";

const E: RegionEntity[] = [
${entLines}
];

export const ${cfg.exportName}: RegionDef = {
  id: ${JSON.stringify(id)},
  title: ${JSON.stringify(cfg.title)},
  flag: ${JSON.stringify(flagEmoji(cfg.iso2))},
  nounKey: ${JSON.stringify(cfg.nounKey)},
  entities: E,
};
`;
  writeFileSync(`app/lib/regions/${id}.ts`, ts, "utf-8");
  console.log(`app/lib/regions/${id}.ts ✓`);

  // 5. Mapa (GeoJSON limpio, properties.name/code canónicos)
  mkdirSync("public/maps", { recursive: true });
  const feats = kept.map((it) => {
    const g = JSON.parse(JSON.stringify(it.geometry));
    g.coordinates = shrink(g.coordinates); rewind(g);
    return { type: "Feature", properties: { name: it.name, code: codes[it.name] }, geometry: g };
  });
  const mapJson = JSON.stringify({ type: "FeatureCollection", features: feats });
  writeFileSync(`public/maps/${id}.json`, mapJson, "utf-8");
  console.log(`public/maps/${id}.json (${Math.round(mapJson.length / 1024)}KB) ✓`);

  // 5b. Chequeo de render: misma proyección que RegionMapPreview; ningún
  // path puede salir vacío (detecta winding/geometría rota sin navegador).
  {
    const fc = { type: "FeatureCollection", features: feats };
    const proj = geoMercator().fitExtent([[14, 14], [346, 206]], fc);
    const pg = geoPath(proj);
    const empty = feats.filter((f) => !pg(f)).map((f) => f.properties.name);
    console.log(empty.length ? `⚠ paths vacíos al proyectar: ${empty.join(", ")}` : "render check (Mercator) ✓");
  }

  // 6. Bandera nacional (flagcdn)
  mkdirSync("public/flags/national", { recursive: true });
  const natRes = await fetchRetry(`https://flagcdn.com/w160/${cfg.iso2}.png`);
  if (natRes?.ok) { writeFileSync(`public/flags/national/${id}.png`, Buffer.from(await natRes.arrayBuffer())); console.log("bandera nacional ✓"); }

  // 7. Banderas de subdivisiones (Wikidata)
  mkdirSync(`public/flags/${id}`, { recursive: true });
  const rows = await wikidataFlags(cfg.qid, cfg.lang);
  const byNorm = new Map(kept.map((it) => [norm(it.name), it]));
  let got = 0;
  for (const row of rows) {
    const it = byNorm.get(norm(row.label));
    if (!it) continue;
    const dest = `public/flags/${id}/${codes[it.name]}.png`;
    if (existsSync(dest)) { got++; continue; }
    const sep = row.flag.includes("?") ? "&" : "?";
    const res = await fetchRetry(row.flag + sep + "width=120");
    if (res?.ok) { const buf = Buffer.from(await res.arrayBuffer()); if (buf.length > 200) { writeFileSync(dest, buf); got++; process.stdout.write("."); } }
    await new Promise((r) => setTimeout(r, 400));
  }
  process.stdout.write("\n");
  console.log(`banderas subdivisiones: ${got}/${kept.length} (las que faltan caen a marcador de 2 letras)`);

  // 8. Auto-registro en index.ts (idempotente)
  registerRegion(id, cfg.exportName);

  console.log(`\n✔ ${cfg.title} listo (datos + mapa + banderas + registro).`);
  if (!connected) console.log("⚠ Grafo NO conexo: ajustar PREC/SHARE o revisar a mano antes de usar.");
}

// Inserta el import y la entrada en REGIONS de index.ts si no existen ya.
function registerRegion(id, exportName) {
  const path = "app/lib/regions/index.ts";
  let src = readFileSync(path, "utf-8");
  if (src.includes(`from "./${id}"`)) { console.log("index.ts: ya estaba registrado"); return; }
  const imports = [...src.matchAll(/^import \{ \w+ \} from "\.\/\w+";\r?$/gm)];
  const last = imports[imports.length - 1];
  const cut = last.index + last[0].length;
  src = src.slice(0, cut) + `\nimport { ${exportName} } from "./${id}";` + src.slice(cut);
  src = src.replace(/(export const REGIONS: Record<string, RegionDef> = \{[^}]*)\}/, `$1  ${id}: ${exportName},\n}`);
  writeFileSync(path, src, "utf-8");
  console.log("index.ts: registrado ✓");
}

const id = process.argv[2];
if (!id) { console.error("uso: node gen-region.mjs <id>   (ids: " + Object.keys(CONFIG).join(", ") + ")"); process.exit(1); }
await build(id);
