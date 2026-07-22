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

// ------------------------------------------------------------
//  Tema de la app (paleta de MARCA). A diferencia del semáforo de arriba,
//  esto sí cambia: `default` (Violeta Prisma) o `premium` (Violeta Premium).
//  Los colores viven en globals.css bajo :root / :root[data-theme=premium];
//  aquí solo se decide y persiste cuál está activo. Mismo patrón simple que
//  i18n/music: localStorage con guard SSR + try/catch, sin contexto React.
// ------------------------------------------------------------

export type Theme = "default" | "premium";
const THEME_KEY = "frontle-theme";

export function savedTheme(): Theme {
  if (typeof localStorage === "undefined") return "default";
  try {
    return localStorage.getItem(THEME_KEY) === "premium" ? "premium" : "default";
  } catch {
    return "default";
  }
}

// Aplica el tema al <html> (data-theme) y lo persiste. `default` quita el
// atributo para caer en :root a secas.
export function applyTheme(theme: Theme): void {
  if (typeof document !== "undefined") {
    if (theme === "premium") document.documentElement.dataset.theme = "premium";
    else delete document.documentElement.dataset.theme;
  }
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {}
}

// Script que corre ANTES de pintar (inline en <head>): fija data-theme desde
// localStorage para que no haya destello del tema equivocado en la 1ª carga.
// Es una cadena porque se inyecta con dangerouslySetInnerHTML en el layout.
export const THEME_INIT_SCRIPT =
  `try{if(localStorage.getItem('${THEME_KEY}')==='premium')document.documentElement.dataset.theme='premium'}catch(e){}`;
