// ============================================================
//  Exporta el banco de banderas de Flag Rush para el servidor.
//
//  Flag Rush lo arma Supabase (supabase/functions/game/rush.ts): elige las
//  banderas y los señuelos, así que necesita el mismo banco que los quiz del
//  cliente: los países del grafo (app/lib/countries.ts) más los insulares
//  (app/lib/islands.ts), cada uno con su nivel y su continente. Solo viaja
//  el código ISO: los nombres los pone el cliente con Intl.DisplayNames.
//
//  Uso (desde frontend/):  npx tsx scripts/export-flags-data.mts
//  Hay que volver a correrlo y desplegar `game` si se agrega un país.
// ============================================================

import { writeFileSync } from "node:fs";
import { COUNTRIES, COUNTRY_NAMES } from "../app/lib/countries";
import { ISLANDS } from "../app/lib/islands";
import { tierOf } from "../app/lib/game";
import { CONTINENT_OF } from "../app/lib/continents";

const flags: { code: string; tier: string; continent: string }[] = [];
const seen = new Set<string>();
function add(code: string, tier: string) {
  if (!/^[A-Z]{2}$/.test(code) || seen.has(code)) throw new Error(`código inválido o repetido: ${code}`);
  const continent = CONTINENT_OF[code];
  if (!continent) throw new Error(`sin continente: ${code}`);
  seen.add(code);
  flags.push({ code, tier, continent });
}
for (const name of COUNTRY_NAMES) add(COUNTRIES[name].code, tierOf(name) ?? "medium");
for (const i of ISLANDS) add(i.code, i.tier);
flags.sort((a, b) => (a.code < b.code ? -1 : 1));

const out = new URL("../../supabase/functions/_shared/flags-data.json", import.meta.url);
writeFileSync(out, JSON.stringify({ flags }) + "\n");
const by = (t: string) => flags.filter((f) => f.tier === t).length;
console.log(`ok: ${flags.length} banderas (fácil ${by("easy")}, medio ${by("medium")}, difícil ${by("hard")}) → ${out.pathname}`);
