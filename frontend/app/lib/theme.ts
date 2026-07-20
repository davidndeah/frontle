// ============================================================
//  Frontle — Tokens de color
//
//  Fuente única de los colores con SIGNIFICADO. Antes el semáforo estaba
//  copiado a mano en tres sitios (WorldMap, RegionMap y la imagen
//  compartible), con los mismos valores por casualidad: cambiar el verde
//  obligaba a acordarse de los tres, y la score card podía quedar diciendo
//  un color distinto al del mapa que la generó.
//
//  Van en TypeScript y no en CSS porque los tres consumidores son JS: dos
//  pintan SVG por props y el tercero pinta sobre <canvas>, donde una
//  variable CSS no llega.
// ============================================================

import type { Status } from "./game";

/**
 * El semáforo del juego y los dos extremos del reto.
 *  green  — en la ruta óptima
 *  yellow — desvío pequeño
 *  red    — te alejas del destino
 */
export const STATUS_COLORS: Record<Status, string> = {
  start: "#22d3ee",
  end: "#e879f9",
  green: "#22c55e",
  yellow: "#eab308",
  red: "#ef4444",
};
