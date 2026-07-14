// ============================================================
//  Frontle — Auditoría de visuales de TODOS los modos.
//  Detecta lo que se ve "roto" en producción sin abrir la app:
//   1. Banderas flagcdn ({code}.svg) de los países del grafo
//      (usadas por el mundial, práctica, quiz y tutorial).
//   2. Matching del atlas 110m (modo "Adivina el país" / contorno).
//   3. Cobertura de continents.ts (pista de continente del quiz).
//   4. Intl.DisplayNames en los 4 idiomas (nombres y resolución).
//   5. Banderas regionales locales (public/flags/<región>/<code>.webp).
//  Uso:  node scripts/check-visuals.mjs
//  Sale con código 1 si hay hallazgos rojos (útil para CI).
// ============================================================
import { readFileSync, existsSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");

// --- mismo algoritmo que countries.ts ---
function flagToCode(flag) {
  const cps = [...flag].map((c) => c.codePointAt(0) ?? 0);
  return cps
    .filter((cp) => cp >= 0x1f1e6 && cp <= 0x1f1ff)
    .map((cp) => String.fromCharCode(cp - 0x1f1e6 + 65))
    .join("");
}

// --- 1. países del grafo (countries.ts) + insulares (islands.ts) ---
const countriesSrc = read("app/lib/countries.ts");
const countryRe = /\{\s*name:\s*"([^"]+)",\s*flag:\s*"([^"]+)"/g;
const countries = [];
for (let m; (m = countryRe.exec(countriesSrc)); ) {
  countries.push({ name: m[1], flag: m[2], code: flagToCode(m[2]), outline: true });
}
console.log(`Países del grafo: ${countries.length}`);

const islandsSrc = read("app/lib/islands.ts");
const islandRe = /\{\s*name:\s*"([^"]+)",\s*flag:\s*"([^"]+)",\s*tier:\s*"(\w+)",\s*outline:\s*(true|false)/g;
let islandCount = 0;
for (let m; (m = islandRe.exec(islandsSrc)); ) {
  countries.push({ name: m[1], flag: m[2], code: flagToCode(m[2]), outline: m[4] === "true", island: true });
  islandCount++;
}
console.log(`Países insulares (quiz): ${islandCount}`);

const red = [];   // roto para el usuario
const warn = [];  // sospechoso / degradado

// Códigos malformados (el emoji no derivó 2 letras)
for (const c of countries) {
  if (!/^[A-Z]{2}$/.test(c.code)) red.push(`CÓDIGO malformado: ${c.name} → "${c.code}" (flag ${c.flag})`);
}

// --- red: helper HEAD con concurrencia ---
async function headOk(url) {
  try {
    const r = await fetch(url, { method: "HEAD" });
    return r.ok;
  } catch {
    return false;
  }
}
async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++;
        out[idx] = await fn(items[idx]);
      }
    })
  );
  return out;
}

// --- 2. flagcdn: {code}.svg por país ---
{
  const results = await mapLimit(countries, 16, async (c) => ({
    c,
    ok: await headOk(`https://flagcdn.com/${c.code.toLowerCase()}.svg`),
  }));
  for (const { c, ok } of results) {
    if (!ok) red.push(`FLAGCDN 404: ${c.name} → ${c.code.toLowerCase()}.svg (flag ${c.flag})`);
  }
  console.log("flagcdn (mundial/práctica/quiz): revisado");
}

// --- 3. atlas 110m (modo contorno) — misma norm + alias que atlas.ts ---
function norm(s) {
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
{
  // Los alias y exclusiones se leen del propio atlas.ts para no divergir.
  const atlasSrc = read("app/lib/atlas.ts");
  const aliasBlock = atlasSrc.match(/NE_ALIAS[^{]*\{([\s\S]*?)\n\};/)?.[1] ?? "";
  const alias = {};
  for (const m of aliasBlock.matchAll(/"([^"]+)":\s*"([^"]+)"/g)) alias[m[1]] = m[2];
  const missingBlock = atlasSrc.match(/ATLAS_MISSING = new Set<string>\(\[([\s\S]*?)\]\)/)?.[1] ?? "";
  const knownMissing = new Set([...missingBlock.matchAll(/"([^"]+)"/g)].map((m) => m[1]));

  const topo = await (await fetch("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json")).json();
  const neNames = topo.objects.countries.geometries.map((g) => String(g.properties?.name ?? ""));
  const matched = new Set();
  for (const ne of neNames) {
    const canonical = alias[norm(ne)] ?? null;
    if (canonical) matched.add(canonical);
  }
  const canonSet = new Set(countries.map((c) => c.name));
  for (const ne of neNames) {
    const n = norm(ne);
    const viaAlias = alias[n];
    const direct = [...canonSet].find((c) => norm(c) === n);
    if (viaAlias) matched.add(viaAlias);
    else if (direct) matched.add(direct);
  }
  for (const c of countries) {
    // Solo es rojo si el modo contorno lo usaría: islas con outline:false
    // y países en ATLAS_MISSING están excluidos del pool a propósito.
    const expected = c.island ? c.outline : !knownMissing.has(c.name);
    if (!matched.has(c.name) && expected) red.push(`ATLAS sin feature (contorno roto): ${c.name}`);
    if (matched.has(c.name) && c.island && !c.outline) warn.push(`ATLAS sí trae ${c.name}: podría marcarse outline:true`);
    if (matched.has(c.name) && knownMissing.has(c.name)) warn.push(`ATLAS sí trae ${c.name}: sobra en ATLAS_MISSING`);
  }
  console.log("atlas 110m (contorno): revisado");
}

// --- 4. continents.ts: cobertura de códigos ---
{
  const contSrc = read("app/lib/continents.ts");
  const covered = new Set([...contSrc.matchAll(/^\s{2}([A-Z]{2}):\s*"/gm)].map((m) => m[1]));
  for (const c of countries) {
    if (!covered.has(c.code)) warn.push(`CONTINENTE faltante (pista sin continente): ${c.name} (${c.code})`);
  }
  console.log(`continents.ts: ${covered.size} códigos`);
}

// --- 5. Intl.DisplayNames en es/en/fr/pt ---
{
  for (const loc of ["es", "en", "fr", "pt"]) {
    const dn = new Intl.DisplayNames([loc], { type: "region" });
    for (const c of countries) {
      let name = null;
      try { name = dn.of(c.code); } catch { /* código inválido */ }
      if (!name || name === c.code) warn.push(`DISPLAYNAME (${loc}) sin nombre: ${c.name} (${c.code}) — cae al inglés`);
    }
  }
  console.log("Intl.DisplayNames (4 locales): revisado");
}

// --- 6. banderas regionales locales ---
{
  const regionFiles = { co: "colombia.ts", us: "usa.ts", ar: "ar.ts", br: "br.ts", ng: "ng.ts", gh: "gh.ts" };
  for (const [id, file] of Object.entries(regionFiles)) {
    const src = read(`app/lib/regions/${file}`);
    const ents = [...src.matchAll(/\{\s*name:\s*"([^"]+)",\s*code:\s*"([^"]+)"/g)].map((m) => ({ name: m[1], code: m[2] }));
    let missing = 0, tiny = 0;
    for (const e of ents) {
      const p = join(ROOT, "public", "flags", id, `${e.code}.webp`);
      if (!existsSync(p)) { missing++; continue; }
      // No vale un umbral de bytes: una bandera plana en WebP baja de 70B y
      // seguiría siendo válida. Lo que delata una descarga rota es que no
      // empiece por la cabecera RIFF....WEBP.
      const head = readFileSync(p).subarray(0, 12);
      if (head.toString("ascii", 0, 4) !== "RIFF" || head.toString("ascii", 8, 12) !== "WEBP") {
        tiny++; warn.push(`FLAG regional corrupta (no es WebP): ${id}/${e.code}.webp (${e.name})`);
      }
    }
    // Faltantes: el marcador de respaldo los cubre (decisión FLAGS-13) → warn, no red.
    if (missing > 0) warn.push(`FLAGS ${id}: ${missing}/${ents.length} sin imagen (usan marcador)`);
    console.log(`región ${id}: ${ents.length} entidades, ${missing} sin imagen${tiny ? `, ${tiny} sospechosas` : ""}`);
  }
}

// --- resumen ---
console.log("\n════════ RESULTADO ════════");
if (red.length === 0 && warn.length === 0) console.log("✅ Sin hallazgos.");
if (red.length) {
  console.log(`\n🔴 ROTO (${red.length}):`);
  for (const r of red) console.log("  - " + r);
}
if (warn.length) {
  console.log(`\n🟡 AVISOS (${warn.length}):`);
  for (const w of warn) console.log("  - " + w);
}
process.exit(red.length ? 1 : 0);
