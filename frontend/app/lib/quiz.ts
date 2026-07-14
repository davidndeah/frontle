// ============================================================
//  Frontle — Motor de los modos quiz (Adivina la bandera / el contorno).
//  Escalera de pistas (PLAN-MODOS-QUIZ.md §1): culturales autoradas +
//  estructurales derivadas (continente, fronteras, inicial, cruce de
//  modos). Selección de país aleatoria por dificultad (tierOf).
//  El pool incluye los países insulares (islands.ts): no están en el
//  grafo de fronteras pero un quiz de banderas los necesita (Japón,
//  Reino Unido, Cuba…). En modo contorno solo entran los que tienen
//  silueta en el atlas 110m.
// ============================================================
import { COUNTRY_NAMES, getCountry } from "./countries";
import { ISLANDS, ISLAND_NAMES, getIsland } from "./islands";
import { ATLAS_MISSING } from "./atlas";
import { tierOf, normalize, type Difficulty } from "./game";
import { countryName, makeLocalizedResolver, suggestLocalized, type Locale } from "./i18n";
import { continentOf } from "./continents";
import { factsFor } from "./countryFacts";

export type QuizMode = "flag" | "outline";

// Un peldaño de la escalera. "cross" no lleva texto: el componente
// renderiza el visual del OTRO modo (contorno en flag, bandera en outline).
export interface QuizHint {
  kind: "fact" | "continent" | "borders" | "initial" | "cross";
  text?: string;
}

// Pistas culturales (countryFacts) desactivadas hasta que David revise su
// exactitud (PR #22). Para activarlas: poner en true.
const INCLUDE_FACTS = false;

// Datos mínimos de un país del quiz, venga del grafo o de las islas.
export function quizCountryInfo(name: string): { code: string; flag: string; borders: number } | null {
  const g = getCountry(name);
  if (g) return { code: g.code, flag: g.flag, borders: g.neighbors.length };
  const i = getIsland(name);
  if (i) return { code: i.code, flag: i.flag, borders: 0 };
  return null;
}

// Pool del nivel según el modo: bandera = grafo + islas; contorno = solo
// los que tienen silueta en el atlas 110m (fuera microestados e islas
// pequeñas — su ronda quedaría en "Cargando mapa…" para siempre).
function poolFor(level: Difficulty, mode: QuizMode): string[] {
  const graph = COUNTRY_NAMES.filter(
    (n) => tierOf(n) === level && (mode === "flag" || !ATLAS_MISSING.has(n))
  );
  const islands = ISLANDS.filter((i) => i.tier === level && (mode === "flag" || i.outline)).map((i) => i.name);
  return [...graph, ...islands];
}

// País aleatorio del pool del nivel (excluye el anterior para no repetir).
export function randomQuizCountry(level: Difficulty, exclude?: string, mode: QuizMode = "flag"): string {
  const pool = poolFor(level, mode).filter((n) => n !== exclude);
  return pool[Math.floor(Math.random() * pool.length)];
}

// --- Resolución de la respuesta (grafo + islas, en los 4 idiomas) ---
export const QUIZ_COUNTRY_NAMES: string[] = [...COUNTRY_NAMES, ...ISLAND_NAMES];

// Apodos frecuentes que Intl no cubre.
const QUIZ_ALIASES: Record<string, string> = {
  uk: "United Kingdom",
  "great britain": "United Kingdom",
  "gran bretana": "United Kingdom",
  england: "United Kingdom",
  inglaterra: "United Kingdom",
  "nueva zelandia": "New Zealand",
};

const resolveQuizLocalized = makeLocalizedResolver(QUIZ_COUNTRY_NAMES);

export function resolveQuizCountry(input: string): string | null {
  return resolveQuizLocalized(input) ?? QUIZ_ALIASES[normalize(input)] ?? null;
}

export function suggestQuizCountries(input: string, locale: Locale, limit = 6): string[] {
  return suggestLocalized(input, locale, limit, QUIZ_COUNTRY_NAMES);
}

// Escalera ordenada de vaga → obvia. Los textos van localizados; las
// etiquetas ("Está en…", "Limita con N…") las arma el llamador con tr.
export function quizHints(
  country: string,
  locale: Locale,
  tr: {
    continentHint: (name: string) => string;
    bordersHint: (n: number) => string;
    islandHint: string;
    initialHint: (letter: string) => string;
  }
): QuizHint[] {
  const hints: QuizHint[] = [];
  const info = quizCountryInfo(country);
  const facts = INCLUDE_FACTS ? factsFor(info?.code ?? "", locale) : [];

  if (facts[0]) hints.push({ kind: "fact", text: facts[0] });

  const cont = continentOf(info?.code ?? "");
  if (cont) hints.push({ kind: "continent", text: cont }); // el texto final lo arma la UI con tr.continents

  const nbs = info?.borders ?? 0;
  hints.push({ kind: "borders", text: nbs > 0 ? tr.bordersHint(nbs) : tr.islandHint });

  if (facts[1]) hints.push({ kind: "fact", text: facts[1] });

  hints.push({ kind: "initial", text: tr.initialHint(countryName(country, locale).charAt(0)) });
  hints.push({ kind: "cross" });
  return hints;
}
