// ============================================================
//  Exporta el grafo del juego para el motor del servidor.
//
//  El reto diario lo genera Supabase (supabase/functions/_shared/engine.ts)
//  y necesita EXACTAMENTE el mismo grafo, la misma dificultad por país y las
//  mismas aristas exóticas que el cliente. La fuente de verdad sigue siendo
//  app/lib/countries.ts + game.ts; esto vuelca lo necesario a JSON.
//
//  Uso (desde frontend/):  npx tsx scripts/export-engine-data.mts
//  Hay que volver a correrlo y desplegar `game` si se toca el grafo.
// ============================================================

import { writeFileSync } from "node:fs";
import { COUNTRIES, COUNTRY_NAMES, usesExoticEdge } from "../app/lib/countries";
import { tierOf } from "../app/lib/game";
import { CONTINENT_OF } from "../app/lib/continents";

const countries: Record<string, { code: string; neighbors: string[]; tier: string; continent: string }> = {};
const exotic: [string, string][] = [];
for (const name of COUNTRY_NAMES) {
  const c = COUNTRIES[name];
  countries[name] = {
    code: c.code,
    neighbors: [...c.neighbors].sort(),
    tier: tierOf(name) ?? "medium",
    continent: CONTINENT_OF[c.code] ?? "",
  };
  for (const nb of c.neighbors) if (name < nb && usesExoticEdge([name, nb])) exotic.push([name, nb]);
}

const out = new URL("../../supabase/functions/_shared/engine-data.json", import.meta.url);
writeFileSync(out, JSON.stringify({ countries, exotic }) + "\n");
console.log(`ok: ${COUNTRY_NAMES.length} países, ${exotic.length} aristas exóticas → ${out.pathname}`);
