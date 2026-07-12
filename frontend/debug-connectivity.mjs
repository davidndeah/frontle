// ============================================================
//  Frontle — Harness de reproducción de BUG-1 (victoria que no dispara).
//  Dado un reto y la cadena del jugador, imprime:
//   - los componentes conexos del conjunto "conocido" (start+end+cadena)
//   - si origen y destino quedan conectados (== victoria)
//   - qué pares de la cadena NO son vecinos en el grafo (aristas faltantes
//     candidatas si el jugador jura que en la realidad sí limitan)
//  Uso:  node debug-connectivity.mjs "Start" "End" "País1,País2,..."
// ============================================================
import { readFileSync } from "fs";

// Grafo de countries.ts sin compilar TS (mismo regex que otros scripts)
const src = readFileSync("app/lib/countries.ts", "utf-8");
const G = {};
for (const m of src.matchAll(/name:\s*"([^"]+)"[\s\S]*?neighbors:\s*\[([^\]]*)\]/g)) {
  G[m[1]] = [...m[2].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
}
// simetría defensiva (buildGraph hace lo mismo en runtime)
for (const [a, nbs] of Object.entries(G)) for (const b of nbs) {
  if (G[b] && !G[b].includes(a)) G[b].push(a);
}

const [start, end, chainRaw] = process.argv.slice(2);
if (!start || !end) {
  console.log('uso: node debug-connectivity.mjs "Start" "End" "País1,País2,..."');
  process.exit(1);
}
const chain = (chainRaw || "").split(",").map((s) => s.trim()).filter(Boolean);
const known = new Set([start, end, ...chain]);

for (const c of known) if (!G[c]) console.log(`⚠ "${c}" no existe en el grafo (¿nombre canónico?)`);

// Componentes conexos dentro de known
const seen = new Set();
const comps = [];
for (const c of known) {
  if (seen.has(c) || !G[c]) continue;
  const comp = [c]; seen.add(c);
  const q = [c];
  while (q.length) {
    const cur = q.shift();
    for (const nb of G[cur] ?? []) if (known.has(nb) && !seen.has(nb)) { seen.add(nb); comp.push(nb); q.push(nb); }
  }
  comps.push(comp);
}
console.log(`\ncomponentes conexos del conjunto conocido (${known.size} países):`);
comps.forEach((c, i) => console.log(`  [${i + 1}] ${c.join(" — ")}`));
const win = comps.some((c) => c.includes(start) && c.includes(end));
console.log(`\nvictoria (start y end en el mismo componente): ${win ? "SÍ ✓" : "NO ✗"}`);

if (!win) {
  console.log("\npares de conocidos que NO son vecinos en el grafo (aristas candidatas):");
  const arr = [...known];
  for (let i = 0; i < arr.length; i++) for (let j = i + 1; j < arr.length; j++) {
    const a = arr[i], b = arr[j];
    if (G[a] && G[b] && !G[a].includes(b)) console.log(`  ${a} ↔ ${b}`);
  }
}
