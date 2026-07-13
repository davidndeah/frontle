// ============================================================
//  Frontle — Motor de los modos quiz (Adivina la bandera / el contorno).
//  Escalera de pistas (PLAN-MODOS-QUIZ.md §1): culturales autoradas +
//  estructurales derivadas (continente, fronteras, inicial, cruce de
//  modos). Selección de país aleatoria por dificultad (tierOf).
// ============================================================
import { COUNTRY_NAMES, getCountry } from "./countries";
import { tierOf, type Difficulty } from "./game";
import { countryName, type Locale } from "./i18n";
import { continentOf } from "./continents";
import { factsFor } from "./countryFacts";

export type QuizMode = "flag" | "outline";

// Un peldaño de la escalera. "cross" no lleva texto: el componente
// renderiza el visual del OTRO modo (contorno en flag, bandera en outline).
export interface QuizHint {
  kind: "fact" | "continent" | "borders" | "initial" | "cross";
  text?: string;
}

// País aleatorio del pool del nivel (excluye el anterior para no repetir).
export function randomQuizCountry(level: Difficulty, exclude?: string): string {
  const pool = COUNTRY_NAMES.filter((n) => tierOf(n) === level && n !== exclude);
  return pool[Math.floor(Math.random() * pool.length)];
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
  const facts = factsFor(getCountry(country)?.code ?? "", locale);

  if (facts[0]) hints.push({ kind: "fact", text: facts[0] });

  const cont = continentOf(getCountry(country)?.code ?? "");
  if (cont) hints.push({ kind: "continent", text: cont }); // el texto final lo arma la UI con tr.continents

  const nbs = getCountry(country)?.neighbors.length ?? 0;
  hints.push({ kind: "borders", text: nbs > 0 ? tr.bordersHint(nbs) : tr.islandHint });

  if (facts[1]) hints.push({ kind: "fact", text: facts[1] });

  hints.push({ kind: "initial", text: tr.initialHint(countryName(country, locale).charAt(0)) });
  hints.push({ kind: "cross" });
  return hints;
}
