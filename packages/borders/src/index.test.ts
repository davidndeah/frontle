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
