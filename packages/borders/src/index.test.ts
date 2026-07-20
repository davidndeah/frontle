// Tests del motor (node:test, sin dependencias). Corre con `npm test`
// tras `npm run build` (importa desde dist).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  shortestPath,
  distance,
  areNeighbors,
  resolveCountry,
  dailyChallenge,
  connectsThroughKnown,
  tryGuess,
  usesExoticEdge,
  CONTINENT_OF,
  COUNTRIES,
  COUNTRY_NAMES,
} from "../dist/index.js";

test("el grafo es simétrico", () => {
  for (const name of COUNTRY_NAMES) {
    for (const nb of COUNTRIES[name].neighbors) {
      assert.ok(COUNTRIES[nb], `vecino inexistente: ${name} → ${nb}`);
      assert.ok(COUNTRIES[nb].neighbors.includes(name), `asimetría: ${name} ↔ ${nb}`);
    }
  }
});

test("shortestPath / distance coherentes", () => {
  const p = shortestPath("Portugal", "Germany");
  assert.ok(p && p[0] === "Portugal" && p[p.length - 1] === "Germany");
  assert.equal(distance("Portugal", "Germany"), (p?.length ?? 1) - 1);
  assert.equal(distance("France", "Germany"), 1); // vecinos directos
});

test("fronteras vía territorio (fix BUG-1)", () => {
  assert.ok(areNeighbors("Spain", "Morocco"));   // Ceuta/Melilla
  assert.ok(areNeighbors("Brazil", "France"));    // Guayana Francesa
});

test("resolveCountry normaliza y acepta alias (no i18n: eso vive en el frontend)", () => {
  assert.equal(resolveCountry("  Brazil "), "Brazil");
  assert.equal(resolveCountry("UNITED STATES"), "United States");
  assert.equal(resolveCountry("no-such-place"), null);
});

test("dailyChallenge es determinista por semilla", () => {
  const a = dailyChallenge(12345, "medium");
  const b = dailyChallenge(12345, "medium");
  assert.deepEqual(a, b);
  assert.ok(a.optimal >= 1 && a.path.length >= 2);
});

// --- Rebalanceo de niveles (desde 2026-07-20) ---------------------------
// El nivel fácil dejó de armarse sobre conocimiento de nicho. Las aristas
// siguen existiendo y siendo jugables (ver el test de BUG-1 arriba); lo que
// cambia es sobre qué se CONSTRUYE el reto.

// Días reales, no semillas inventadas: `dailyChallenge` se guarda por fecha.
const DIAS = Array.from({ length: 366 }, (_, i) => {
  const d = new Date(Date.UTC(2026, 6, 20));
  d.setUTCDate(d.getUTCDate() + i);
  return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
});

// Región del filtro: continente, pero América es UNA (México→Colombia por
// tierra no es un salto intercontinental para nadie).
const region = (name: string) => {
  const c = CONTINENT_OF[COUNTRIES[name]?.code ?? ""];
  return c === "NA" || c === "SA" ? "AM" : c;
};

test("fácil no se arma sobre aristas exóticas (ultramar / cruces marítimos)", () => {
  for (const dia of DIAS) {
    const c = dailyChallenge(dia, "easy");
    assert.ok(!usesExoticEdge(c.path), `${dia}: ${c.path.join(" → ")}`);
  }
});

test("fácil no cruza de región", () => {
  for (const dia of DIAS) {
    const c = dailyChallenge(dia, "easy");
    assert.equal(region(c.start), region(c.end), `${dia}: ${c.start} → ${c.end}`);
  }
});

test("los tres niveles progresan en longitud", () => {
  const cap = { easy: 3, medium: 5, hard: 7 } as const;
  for (const dia of DIAS) {
    for (const lv of ["easy", "medium", "hard"] as const) {
      const { optimal } = dailyChallenge(dia, lv);
      assert.ok(optimal >= 2 && optimal <= cap[lv], `${dia} ${lv}: ${optimal} intermedios`);
    }
  }
});

test("los retos anteriores al corte NO cambian (protege ranking y pot)", () => {
  // Si esto falla, se reescribió un reto ya jugado: el ranking de ese día y
  // el pot on-chain dejan de corresponder al reto que la gente resolvió.
  // Valores capturados del motor previo al rebalanceo.
  const congelados = [
    [20260502, "easy", "Chile>Poland"],
    [20260504, "easy", "Spain>Lebanon"],
    [20260506, "easy", "Mexico>North Korea"],
    [20260719, "easy", "Brazil>Hungary"], // el último fácil del régimen viejo
    [20260715, "medium", "Georgia>Slovenia"],
    [20260715, "hard", "Sierra Leone>Luxembourg"],
  ] as const;
  for (const [dia, lv, esperado] of congelados) {
    const c = dailyChallenge(dia, lv);
    assert.equal(`${c.start}>${c.end}`, esperado, `el reto del ${dia} (${lv}) cambió`);
  }
});

test("tryGuess conecta y declara victoria", () => {
  // Reto trivial: dos vecinos con un intermedio conocido.
  const state = {
    challenge: { start: "Portugal", end: "France", optimal: 1, path: ["Portugal", "Spain", "France"], level: "medium" as const },
    chain: [],
    solved: false,
  };
  const res = tryGuess(state, "Spain", "Spain");
  assert.ok(res.ok && res.solved, "conectar Portugal→España→Francia gana");
  assert.ok(connectsThroughKnown("Portugal", "France", new Set(["Portugal", "France", "Spain"])));
});
