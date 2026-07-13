// ============================================================
//  @frontle/borders — API pública del motor de fronteras.
//  Reexporta el grafo (countries) y la lógica de juego (game).
//  Todo es puro: sin DOM, sin React, sin dependencias.
// ============================================================
export {
  COUNTRIES,
  COUNTRY_NAMES,
  getCountry,
  areNeighbors,
  flagToCode,
  type Country,
} from "./countries";

export {
  // grafo / rutas
  shortestPath,
  distance,
  // retos
  dailyChallenge,
  dailyChallenges,
  randomChallenge,
  dateSeed,
  msUntilNextDailyUTC,
  tierOf,
  DIFFICULTIES,
  type Difficulty,
  type DailyChallenge,
  // juego
  tryGuess,
  countryQuality,
  connectsThroughKnown,
  knownSet,
  nextHintCountry,
  // resolución de input
  resolveCountry,
  suggest,
  normalize,
  // tipos
  type Quality,
  type Status,
  type ChainItem,
  type PlayState,
  type GuessReason,
  type GuessResult,
} from "./game";
