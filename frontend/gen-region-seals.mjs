// ============================================================
//  Frontle — Escudos/sellos de respaldo para subdivisiones SIN bandera.
//  Decisión de David: modo mixto — quien tiene bandera la usa; quien no,
//  su escudo (P94) o sello/logo (P154) de Wikidata. Descarga solo los
//  faltantes en public/flags/<id>/. Uso: node gen-region-seals.mjs ng gh
// ============================================================
import { readFileSync, writeFileSync, existsSync } from "fs";

const QID = { ng: "Q1033", gh: "Q117" };
const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
  .replace(/\b(state|region|of|the)\b/g, " ").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

async function fetchRetry(url, tries = 5) {
  for (let i = 0; i < tries; i++) {
    const res = await fetch(url, { headers: { "User-Agent": "Frontle/1.0 (region seals)" } });
    if (res.ok) return res;
    if (res.status === 429) { await new Promise((r) => setTimeout(r, 1500 * (i + 1))); continue; }
    return res;
  }
  return null;
}

for (const id of process.argv.slice(2)) {
  const qid = QID[id];
  if (!qid) { console.log(`sin QID para ${id}`); continue; }
  const ts = readFileSync(`app/lib/regions/${id}.ts`, "utf-8");
  const ents = [...ts.matchAll(/\{ name: "([^"]+)", code: "([^"]+)"/g)].map((m) => ({ name: m[1], code: m[2] }));
  const missing = ents.filter((e) => !existsSync(`public/flags/${id}/${e.code}.png`));
  console.log(`\n=== ${id}: ${missing.length}/${ents.length} sin imagen ===`);
  // P94 = coat of arms image · P154 = logo image (fallback)
  const q = `SELECT ?itemLabel ?img WHERE { ?item wdt:P17 wd:${qid} ; wdt:P131 wd:${qid} .
    OPTIONAL { ?item wdt:P94 ?coa. } OPTIONAL { ?item wdt:P154 ?logo. }
    BIND(COALESCE(?coa, ?logo) AS ?img) FILTER(BOUND(?img))
    SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } }`;
  const r = await fetch("https://query.wikidata.org/sparql?format=json&query=" + encodeURIComponent(q),
    { headers: { "User-Agent": "Frontle/1.0", Accept: "application/json" } });
  const rows = (await r.json()).results.bindings.map((b) => ({ label: b.itemLabel.value, img: b.img.value }));
  const byNorm = new Map(rows.map((x) => [norm(x.label), x]));
  let got = 0;
  for (const e of missing) {
    const row = byNorm.get(norm(e.name));
    if (!row) { console.log(`  sin escudo en Wikidata: ${e.name}`); continue; }
    const sep = row.img.includes("?") ? "&" : "?";
    const res = await fetchRetry(row.img + sep + "width=120");
    if (res?.ok) {
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length > 200) { writeFileSync(`public/flags/${id}/${e.code}.png`, buf); got++; process.stdout.write("."); }
    }
    await new Promise((r2) => setTimeout(r2, 400));
  }
  console.log(`\n${id}: +${got} escudos/sellos descargados`);
}
