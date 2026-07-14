// Descarga las banderas de las subdivisiones (departamentos/estados) desde
// Wikidata (propiedad P41 = flag image) y las guarda como WebP locales en
// public/flags/<region>/<code>.webp (MiniPay solo admite SVG o WebP; la fuente
// sirve PNG). Escalable a cualquier país (solo el Q-id del "tipo de
// subdivisión"). Se corre una vez; los WebP van commiteados.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import sharp from "sharp";

async function writeWebp(dest, buf) {
  const [lossless, lossy] = await Promise.all([
    sharp(buf).webp({ lossless: true, effort: 6 }).toBuffer(),
    sharp(buf).webp({ quality: 90, effort: 6 }).toBuffer(),
  ]);
  writeFileSync(dest, lossless.length <= lossy.length ? lossless : lossy);
}

async function fetchRetry(url, tries = 5) {
  for (let i = 0; i < tries; i++) {
    const res = await fetch(url, { headers: { "User-Agent": "Frontle/1.0 (regions flags; contact @frontle_app)" } });
    if (res.ok) return res;
    if (res.status === 429) {
      const wait = Number(res.headers.get("retry-after")) * 1000 || 1500 * (i + 1);
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    return res;
  }
  return null;
}

const norm = (s) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/\b(department|departamento|state|province|of|de|del)\b/g, "")
    .replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ").trim();

function canonical(path) {
  const src = readFileSync(path, "utf-8");
  return [...src.matchAll(/\{ name: "([^"]+)", code: "([^"]+)"/g)].map((m) => ({ name: m[1], code: m[2] }));
}

// Consulta Wikidata: subdivisiones de <countryQid> con bandera (P41).
// Genérico por país: primer nivel = ubicado directamente en el país (P131).
// El intruso ocasional (una ciudad, un ejército) lo filtra el name-match.
async function wikidata(countryQid, lang) {
  const q = `
    SELECT ?itemLabel ?flag WHERE {
      ?item wdt:P17 wd:${countryQid} ; wdt:P41 ?flag ; wdt:P131 wd:${countryQid} .
      SERVICE wikibase:label { bd:serviceParam wikibase:language "${lang},en". }
    }`;
  const url = "https://query.wikidata.org/sparql?format=json&query=" + encodeURIComponent(q);
  const r = await fetch(url, { headers: { "User-Agent": "Frontle/1.0 (regions flags)", Accept: "application/json" } });
  const j = await r.json();
  return j.results.bindings.map((b) => ({ label: b.itemLabel.value, flag: b.flag.value }));
}

// El valor P41 es una URL de Commons Special:FilePath; agregando ?width=N
// devuelve un PNG rasterizado (sirve para SVG y para bitmaps).
function pngUrl(flagValue, width = 120) {
  // flagValue: http://commons.wikimedia.org/wiki/Special:FilePath/Flag...svg
  const sep = flagValue.includes("?") ? "&" : "?";
  return flagValue + sep + "width=" + width;
}

// Bandera (P41) de un item Wikidata puntual (para casos que el query general no trae).
async function flagOf(itemQid) {
  const q = `SELECT ?flag WHERE { wd:${itemQid} wdt:P41 ?flag. } LIMIT 1`;
  const r = await fetch("https://query.wikidata.org/sparql?format=json&query=" + encodeURIComponent(q),
    { headers: { "User-Agent": "Frontle/1.0", Accept: "application/json" } });
  const j = await r.json();
  return j.results.bindings[0]?.flag?.value ?? null;
}

async function build(regionId, countryQid, lang, tsPath, extras = {}) {
  const wanted = canonical(tsPath);
  const wantedByNorm = new Map(wanted.map((w) => [norm(w.name), w]));
  const rows = await wikidata(countryQid, lang);
  // casos especiales por código: { <code>: <itemQid> }
  for (const [code, qid] of Object.entries(extras)) {
    const flag = await flagOf(qid);
    if (flag) rows.push({ label: `__extra_${code}`, flag, __code: code });
  }
  mkdirSync(`public/flags/${regionId}`, { recursive: true });

  const got = new Set();
  for (const row of rows) {
    const c = row.__code ? wanted.find((w) => w.code === row.__code) : wantedByNorm.get(norm(row.label));
    if (!c || got.has(c.code)) continue;
    const dest = `public/flags/${regionId}/${c.code}.webp`;
    if (existsSync(dest)) { got.add(c.code); continue; } // resume
    try {
      const res = await fetchRetry(pngUrl(row.flag, 120));
      if (!res || !res.ok) { console.log(`  [${regionId}] ${c.name}: HTTP ${res?.status ?? "err"}`); continue; }
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 200) { console.log(`  [${regionId}] ${c.name}: archivo vacio`); continue; }
      await writeWebp(dest, buf);
      got.add(c.code);
      process.stdout.write(".");
    } catch (e) {
      console.log(`  [${regionId}] ${c.name}: ${e.message}`);
    }
    await new Promise((r) => setTimeout(r, 400)); // más cortés
  }
  process.stdout.write("\n");
  const missing = wanted.filter((w) => !got.has(w.code));
  console.log(`[${regionId}] ${got.size}/${wanted.length} banderas` + (missing.length ? ` · faltan: ${missing.map((m) => m.name).join(", ")}` : " ✓"));
  return missing;
}

// Country Q-ids: Colombia = Q739 · United States = Q30.
// extras: entidades que el query general no trae (Bogotá Q2841 es distrito capital).
const missCO = await build("co", "Q739", "es", "app/lib/regions/colombia.ts", { bog: "Q2841" });
const missUS = await build("us", "Q30", "en", "app/lib/regions/usa.ts");
writeFileSync("public/flags/_missing.json", JSON.stringify({ co: missCO, us: missUS }, null, 2));
