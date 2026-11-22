// ============================================================
//  FrontleIcon — iconos planos propios (reemplazan a los emojis).
//
//  Los emojis se ven distintos en cada teléfono y delatan una interfaz
//  armada a la carrera. Estos siguen las reglas del landing: forma rellena
//  con el color de la marca, borde oscuro grueso y sombra dura desplazada
//  (sin desenfoque), como sus botones y etiquetas.
//
//  · Cada icono se define una vez como partes (forma + color) y detalles
//    (trazos oscuros o brillos). La sombra sale sola de las partes.
//  · Cuadrícula de 32x32. Se ven bien de 16 px (en un texto) a 48 px.
//  · `mono` los pinta de un solo color (currentColor), sin sombra: para
//    meterlos en una línea de texto o en un botón ya coloreado.
//  · Para las fichas grandes (modos, premios) van los iconos 3D.
// ============================================================

import type { CSSProperties } from "react";

const TONE = {
  gold: "#fcff52",
  violet: "#7c3aed",
  lav: "#b79ced",
  cyan: "#22d3ee",
  pink: "#e879f9",
  green: "#34d399",
  red: "#f87171",
  orange: "#fb923c",
  white: "#f3edff",
  deep: "#0d0420",
} as const;
type Tone = keyof typeof TONE;

interface Part { d: string; fill: Tone }
interface Detail { d: string; fill?: Tone; stroke?: Tone; width?: number }
interface Def { parts: Part[]; details?: Detail[] }

// Brillo: un trazo blanco corto arriba a la izquierda de una forma.
const shine = (d: string): Detail => ({ d, stroke: "white", width: 1.6 });

const ICONS = {
  // Flag Rush: dos banderas de cuadros cruzadas en X, como en la meta de
  // una carrera. Ninguna es de un país. Trazos generados con la onda de la
  // tela (scratchpad flags_x.py).
  flag: {
    parts: [
      { d: "M22.74 28.97 20.26 30.03 9.36 4.73 11.84 3.67z", fill: "lav" },
      { d: "M11.74 30.03 9.26 28.97 20.16 3.67 22.64 4.73z", fill: "lav" },
      { d: "M9.36 4.73C6.49 3.9 3.63 7.87 0.76 7.03L4.79 16.4C7.66 17.23 10.53 13.26 13.39 14.1z", fill: "white" },
      { d: "M22.64 4.73C25.51 3.9 28.37 7.87 31.24 7.03L27.21 16.4C24.34 17.23 21.47 13.26 18.61 14.1z", fill: "white" },
      { d: "M10.12 2.2a.9.9 0 1 1 0 1.8a.9.9 0 1 1 0-1.8z", fill: "gold" },
      { d: "M21.88 2.2a.9.9 0 1 1 0 1.8a.9.9 0 1 1 0-1.8z", fill: "gold" },
    ],
    details: [
      // Cuadros de la bandera izquierda. Corridos en x (+1.1 esta, +0.7 la otra): van más altos
      // que la tela y la perspectiva del render 3D los empuja a la izquierda.
      { d: "M10.14 5.28 9.52 5.3 8.91 5.42 8.29 5.62 7.68 5.89 8.11 6.9 8.54 7.91 9.16 7.64 9.77 7.43 10.39 7.31 11.01 7.29 10.57 6.29z", fill: "deep" },
      { d: "M5.21 7.18 4.59 7.45 3.98 7.66 3.36 7.78 2.74 7.8 3.18 8.8 3.61 9.81 4.23 9.79 4.84 9.67 5.46 9.47 6.08 9.2 5.64 8.19z", fill: "deep" },
      { d: "M8.54 7.91 7.93 8.22 7.31 8.55 6.69 8.89 6.08 9.2 6.51 10.2 6.94 11.21 7.56 10.9 8.18 10.56 8.79 10.23 9.41 9.92 8.98 8.91z", fill: "deep" },
      { d: "M11.87 9.31 11.26 9.32 10.64 9.44 10.03 9.65 9.41 9.92 9.84 10.93 10.28 11.93 10.89 11.66 11.51 11.46 12.13 11.33 12.74 11.32 12.31 10.31z", fill: "deep" },
      { d: "M6.94 11.21 6.33 11.48 5.71 11.69 5.1 11.81 4.48 11.82 4.91 12.83 5.35 13.84 5.96 13.82 6.58 13.7 7.19 13.49 7.81 13.22 7.38 12.22z", fill: "deep" },
      { d: "M10.28 11.93 9.66 12.24 9.04 12.58 8.43 12.91 7.81 13.22 8.24 14.23 8.68 15.24 9.29 14.92 9.91 14.59 10.53 14.26 11.14 13.94 10.71 12.94z", fill: "deep" },
      // Cuadros de la bandera derecha.
      { d: "M23.66 5.28 24.28 5.3 24.89 5.42 25.51 5.62 26.12 5.89 25.69 6.9 25.26 7.91 24.64 7.64 24.03 7.43 23.41 7.31 22.79 7.29 23.23 6.29z", fill: "deep" },
      { d: "M28.59 7.18 29.21 7.45 29.82 7.66 30.44 7.78 31.06 7.8 30.62 8.8 30.19 9.81 29.57 9.79 28.96 9.67 28.34 9.47 27.72 9.2 28.16 8.19z", fill: "deep" },
      { d: "M25.26 7.91 25.87 8.22 26.49 8.55 27.11 8.89 27.72 9.2 27.29 10.2 26.86 11.21 26.24 10.9 25.62 10.56 25.01 10.23 24.39 9.92 24.82 8.91z", fill: "deep" },
      { d: "M21.93 9.31 22.54 9.32 23.16 9.44 23.77 9.65 24.39 9.92 23.96 10.93 23.52 11.93 22.91 11.66 22.29 11.46 21.67 11.33 21.06 11.32 21.49 10.31z", fill: "deep" },
      { d: "M26.86 11.21 27.47 11.48 28.09 11.69 28.7 11.81 29.32 11.82 28.89 12.83 28.45 13.84 27.84 13.82 27.22 13.7 26.61 13.49 25.99 13.22 26.42 12.22z", fill: "deep" },
      { d: "M23.52 11.93 24.14 12.24 24.76 12.58 25.37 12.91 25.99 13.22 25.56 14.23 25.12 15.24 24.51 14.92 23.89 14.59 23.27 14.26 22.66 13.94 23.09 12.94z", fill: "deep" },
    ],
  },
  // Reto diario: el globo.
  globe: {
    parts: [{ d: "M16 4a12 12 0 1 1 0 24a12 12 0 1 1 0-24z", fill: "violet" }],
    details: [
      { d: "M9 10.5c2-1.6 4.6-.6 6 .8 1.2 1.2 3 1 3.6 2.6.5 1.4-1 2.4-.4 4 .5 1.3 1.6 2.3.8 3.6-1 1.6-3.4.8-4.2-.8-.8-1.6-2.6-1.8-3.6-3.2-1.2-1.7-4.4-3.8-2.2-7z", fill: "lav" },
      { d: "M20.5 7.5c1.6.4 3.4 1.6 4 3.4-1.2.4-2.6-.2-3.4-1-.6-.6-1-1.4-.6-2.4z", fill: "lav" },
      // Meridiano y ecuador: sin ellos parecía una pelota con una mancha.
      { d: "M16 4c-3.6 3.2-5.4 7.4-5.4 12s1.8 8.8 5.4 12M4.4 13.4c3.6 1.2 7.4 1.8 11.6 1.8s8-.6 11.6-1.8", stroke: "deep", width: 1.1 },
      shine("M9.5 8.2c1.2-1.1 2.6-1.9 4.1-2.3"),
    ],
  },
  // Regiones: mapa plegado.
  map: {
    parts: [
      { d: "M4 8.5 12 5.5l8 3 8-3v18l-8 3-8-3-8 3z", fill: "cyan" },
    ],
    details: [
      { d: "M12 5.5v18M20 8.5v18", stroke: "deep", width: 1.6 },
      { d: "M14.6 12.2c0-1.6 1.2-2.8 2.7-2.8s2.7 1.2 2.7 2.8c0 2.2-2.7 4.8-2.7 4.8s-2.7-2.6-2.7-4.8z", fill: "red", stroke: "deep", width: 1.4 },
    ],
  },
  // Adivina el país: lupa sobre una silueta.
  search: {
    parts: [
      { d: "M5 21c-.6-3 1.6-4 1.2-6.4-.4-2.4 1.4-4.6 4-4.4 2.2.2 3 2.2 5 2 2.4-.2 3.4 1.8 2.6 4-.8 2.4 1 3.4-.2 5.4-1.2 2-4 1-5.8 1.4-2.4.6-6.2 1-6.8-2z", fill: "green" },
      { d: "M18 4.5a7 7 0 1 1 0 14a7 7 0 1 1 0-14z", fill: "white" },
      { d: "m22.6 17.2 2.2-2.2 5 5-2.2 2.2z", fill: "lav" },
    ],
    details: [shine("M14.6 9.4c.6-1.4 1.8-2.4 3.2-2.8")],
  },
  // Práctica: birrete.
  cap: {
    parts: [
      { d: "M9 15.5v5.5c0 2.2 3.2 3.8 7 3.8s7-1.6 7-3.8v-5.5z", fill: "violet" },
      { d: "M16 6 30 12.5 16 19 2 12.5z", fill: "violet" },
    ],
    details: [
      { d: "M16 12.5 25 15v6", stroke: "gold", width: 1.8 },
      { d: "M25 21a1.6 1.6 0 1 1 0 3.2a1.6 1.6 0 1 1 0-3.2z", fill: "gold", stroke: "deep", width: 1.2 },
      shine("M10 11.2 15.4 8.7"),
    ],
  },
  // XP: rayo.
  xp: {
    parts: [{ d: "M18.5 3 7 18h8l-2 11L25 13.5h-8z", fill: "gold" }],
    details: [shine("M16.6 6.5 11 14")],
  },
  // Monedas: moneda con la F de Frontle.
  coin: {
    parts: [{ d: "M16 4a12 12 0 1 1 0 24a12 12 0 1 1 0-24z", fill: "gold" }],
    details: [
      { d: "M16 7.6a8.4 8.4 0 1 1 0 16.8a8.4 8.4 0 1 1 0-16.8z", stroke: "deep", width: 1.4 },
      { d: "M13.6 21.5V10.5h5.6M13.6 15.6h4.4", stroke: "deep", width: 2.4 },
      shine("M8.6 12.4c.8-2 2.4-3.6 4.4-4.4"),
    ],
  },
  // Racha: llama.
  streak: {
    parts: [
      { d: "M16 3c1.4 5 8.6 7.2 8.6 15.4a8.6 8.6 0 0 1-17.2 0c0-4.4 2.6-6.4 3.8-9.4 1 2.6 2.6 3.8 2.6 3.8 0-3.8.6-6.8 2.2-9.8z", fill: "orange" },
      { d: "M16 15c1 2.4 4 3.4 4 6.6a4 4 0 0 1-8 0c0-2.4 1.6-3.4 2.2-5 .6 1 1.4 1.4 1.4 1.4 0-1.2.1-2 .4-3z", fill: "gold" },
    ],
  },
  // Premios: trofeo.
  trophy: {
    parts: [
      { d: "M11 24h10v4H11z", fill: "violet" },
      { d: "M14.4 19h3.2v5h-3.2z", fill: "gold" },
      { d: "M9 4.5h14v7.5a7 7 0 0 1-14 0z", fill: "gold" },
    ],
    details: [
      { d: "M9 7H5.6v2.4c0 2.4 1.8 4 4 4.2M23 7h3.4v2.4c0 2.4-1.8 4-4 4.2", stroke: "deep", width: 1.8 },
      shine("M12 7.2v4.4"),
    ],
  },
  // Tiempo: reloj.
  clock: {
    parts: [{ d: "M16 4a12 12 0 1 1 0 24a12 12 0 1 1 0-24z", fill: "white" }],
    details: [
      { d: "M16 9v7.4l4.6 2.8", stroke: "deep", width: 2.2 },
      { d: "M16 5.8v1.6M26.2 16h-1.6M16 26.2v-1.6M5.8 16h1.6", stroke: "deep", width: 1.4 },
    ],
  },
  // Aviso: triángulo con exclamación.
  warning: {
    parts: [{ d: "M16 3.8 29.4 27H2.6z", fill: "gold" }],
    details: [
      { d: "M16 11.5v7.5", stroke: "deep", width: 2.6 },
      { d: "M16 21.6a1.6 1.6 0 1 1 0 3.2a1.6 1.6 0 1 1 0-3.2z", fill: "deep" },
    ],
  },
  // Acierto.
  check: {
    parts: [{ d: "M16 4a12 12 0 1 1 0 24a12 12 0 1 1 0-24z", fill: "green" }],
    details: [{ d: "m10.4 16.4 3.8 3.8 7.6-8", stroke: "deep", width: 2.8 }],
  },
  // Fallo.
  cross: {
    parts: [{ d: "M16 4a12 12 0 1 1 0 24a12 12 0 1 1 0-24z", fill: "red" }],
    details: [{ d: "m11.4 11.4 9.2 9.2m0-9.2-9.2 9.2", stroke: "deep", width: 2.8 }],
  },
  // Otra vez.
  retry: {
    parts: [{ d: "M16 4a12 12 0 1 1 0 24a12 12 0 1 1 0-24z", fill: "lav" }],
    details: [
      { d: "M21.6 13.2a6.2 6.2 0 1 0 .3 4.2", stroke: "deep", width: 2.4 },
      { d: "M22.6 8.6v5.2h-5.2", stroke: "deep", width: 2.4 },
    ],
  },
  // Pista: bombillo.
  hint: {
    parts: [
      { d: "M12.6 22h6.8v3.6a2 2 0 0 1-2 2h-2.8a2 2 0 0 1-2-2z", fill: "lav" },
      { d: "M16 3.6a8.6 8.6 0 0 1 5 15.6c-1 .8-1.6 1.6-1.6 2.8h-6.8c0-1.2-.6-2-1.6-2.8A8.6 8.6 0 0 1 16 3.6z", fill: "gold" },
    ],
    details: [
      { d: "M13 25h6", stroke: "deep", width: 1.4 },
      shine("M11.2 9.4c.8-1.8 2.4-3 4.2-3.4"),
    ],
  },
  // Regalo.
  gift: {
    parts: [
      { d: "M6 14h20v14H6z", fill: "pink" },
      { d: "M4.5 9.5h23V14h-23z", fill: "pink" },
    ],
    details: [
      { d: "M16 9.5V28", stroke: "gold", width: 3.2 },
      { d: "M16 9.5c-2.4-4.4-7.2-4.2-6.4-1.2.6 2 4.6 1.2 6.4 1.2zm0 0c2.4-4.4 7.2-4.2 6.4-1.2-.6 2-4.6 1.2-6.4 1.2z", fill: "gold", stroke: "deep", width: 1.4 },
    ],
  },
  // Bloqueado.
  lock: {
    parts: [{ d: "M7.5 14h17v13h-17z", fill: "gold" }],
    details: [
      { d: "M11 14v-3.4a5 5 0 0 1 10 0V14", stroke: "deep", width: 2.4 },
      { d: "M16 18.4v4", stroke: "deep", width: 2.4 },
    ],
  },
  // Diana: puntería, meta.
  target: {
    parts: [{ d: "M16 4a12 12 0 1 1 0 24a12 12 0 1 1 0-24z", fill: "white" }],
    details: [
      { d: "M16 8a8 8 0 1 1 0 16a8 8 0 1 1 0-16z", fill: "red", stroke: "deep", width: 1.4 },
      { d: "M16 12a4 4 0 1 1 0 8a4 4 0 1 1 0-8z", fill: "white", stroke: "deep", width: 1.4 },
      { d: "M16 14.6a1.4 1.4 0 1 1 0 2.8a1.4 1.4 0 1 1 0-2.8z", fill: "red" },
    ],
  },
  // Volver.
  back: {
    parts: [{ d: "M16 4a12 12 0 1 1 0 24a12 12 0 1 1 0-24z", fill: "violet" }],
    details: [{ d: "M18.4 10.4 12.8 16l5.6 5.6", stroke: "white", width: 2.8 }],
  },

  // Inicio de la barra: el globo ya existe ("globe"). Modos: cuatro fichas.
  modes: {
    parts: [
      { d: "M5 5h9.4v9.4H5z", fill: "cyan" },
      { d: "M17.6 5H27v9.4h-9.4z", fill: "gold" },
      { d: "M5 17.6h9.4V27H5z", fill: "pink" },
      { d: "M17.6 17.6H27V27h-9.4z", fill: "green" },
    ],
  },
  // Ranking: podio.
  podium: {
    parts: [
      { d: "M3.5 17h8.4v10H3.5z", fill: "lav" },
      { d: "M11.9 10.5h8.2V27h-8.2z", fill: "gold" },
      { d: "M20.1 20h8.4v7h-8.4z", fill: "orange" },
    ],
    details: [{ d: "M16 15v5.6", stroke: "deep", width: 2.2 }],
  },
  // Perfil: la cabeza de Bordy (visor prisma y antena).
  bordy: {
    parts: [
      { d: "M15 3.8h2v4h-2z", fill: "deep" },
      { d: "M16 1.8a1.9 1.9 0 1 1 0 3.8a1.9 1.9 0 1 1 0-3.8z", fill: "gold" },
      { d: "M9.6 7.6h12.8a6 6 0 0 1 6 6v6.6a7.6 7.6 0 0 1-7.6 7.6h-9.6a7.6 7.6 0 0 1-7.6-7.6v-6.6a6 6 0 0 1 6-6z", fill: "deep" },
      { d: "M8 12.6h16a2.2 2.2 0 0 1 2.2 2.2v2.6a2.2 2.2 0 0 1-2.2 2.2H8a2.2 2.2 0 0 1-2.2-2.2v-2.6A2.2 2.2 0 0 1 8 12.6z", fill: "cyan" },
    ],
    details: [
      { d: "M12 14.6a1.5 1.5 0 1 1 0 3a1.5 1.5 0 1 1 0-3zM20 14.6a1.5 1.5 0 1 1 0 3a1.5 1.5 0 1 1 0-3z", fill: "deep" },
      { d: "M13.6 22.6c1.4 1.2 3.4 1.2 4.8 0", stroke: "lav", width: 1.8 },
    ],
  },
  // Tienda: bolsa.
  bag: {
    parts: [{ d: "M6.5 10.5h19l-1.6 16.8H8.1z", fill: "pink" }],
    details: [
      { d: "M11.6 13V9.4a4.4 4.4 0 0 1 8.8 0V13", stroke: "deep", width: 2.2 },
      { d: "M14 19.4h4", stroke: "deep", width: 2.2 },
    ],
  },
  // Ajustes: engranaje.
  gear: {
    parts: [{ d: "M16.00 6.40 L18.44 3.74 L20.78 4.45 L21.33 8.02 L22.79 9.21 L26.39 9.06 L27.55 11.22 L25.42 14.13 L25.60 16.00 L28.26 18.44 L27.55 20.78 L23.98 21.33 L22.79 22.79 L22.94 26.39 L20.78 27.55 L17.87 25.42 L16.00 25.60 L13.56 28.26 L11.22 27.55 L10.67 23.98 L9.21 22.79 L5.61 22.94 L4.45 20.78 L6.58 17.87 L6.40 16.00 L3.74 13.56 L4.45 11.22 L8.02 10.67 L9.21 9.21 L9.06 5.61 L11.22 4.45 L14.13 6.58Z", fill: "lav" }],
    details: [{ d: "M16 11.6a4.4 4.4 0 1 1 0 8.8a4.4 4.4 0 1 1 0-8.8z", fill: "deep" }],
  },
  // Compartir: tres nodos unidos (red de amigos).
  share: {
    parts: [
      { d: "M23 4.5a4 4 0 1 1 0 8a4 4 0 1 1 0-8z", fill: "cyan" },
      { d: "M23 19.5a4 4 0 1 1 0 8a4 4 0 1 1 0-8z", fill: "pink" },
      { d: "M9 12a4 4 0 1 1 0 8a4 4 0 1 1 0-8z", fill: "gold" },
    ],
    details: [{ d: "M12.6 14.2l6.8-4M12.6 17.8l6.8 4", stroke: "deep", width: 2 }],
  },

  // --- Tanda de Inicio (estética nueva, 19-nov) ---
  // Cómo se juega: brújula.
  compass: {
    parts: [{ d: "M16 4a12 12 0 1 1 0 24a12 12 0 1 1 0-24z", fill: "cyan" }],
    details: [
      { d: "M16 7.4a8.6 8.6 0 1 1 0 17.2a8.6 8.6 0 1 1 0-17.2z", fill: "white", stroke: "deep", width: 1.4 },
      // Aguja en dos mitades que no se pisan (antes la blanca tapaba la roja).
      { d: "M22 10 17.8 17.8 14.2 14.2z", fill: "red", stroke: "deep", width: 1.4 },
      { d: "M17.8 17.8 10 22 14.2 14.2z", fill: "violet", stroke: "deep", width: 1.4 },
      { d: "M16 14.8a1.2 1.2 0 1 1 0 2.4a1.2 1.2 0 1 1 0-2.4z", fill: "deep" },
    ],
  },
  // Nivel fácil: brote.
  sprout: {
    parts: [
      { d: "M14.8 15h2.4v13h-2.4z", fill: "green" },
      { d: "M15.6 16.4C9.6 17.4 5 13.6 4.6 7.4c6-.6 10.6 2.6 11 9z", fill: "green" },
      { d: "M16.4 19C17 11.6 21.8 7.6 28 8c-.2 6.6-4.8 11.2-11.6 11z", fill: "green" },
    ],
    details: [
      { d: "M8 10.4c2.6 1.4 4.8 3.4 6.4 5.6M24.6 11.2c-2.6 1.6-4.8 3.8-6.4 6.4", stroke: "deep", width: 1.3 },
    ],
  },
  // Nivel medio: rayo (cian, para no confundirlo con el XP dorado).
  bolt: {
    parts: [{ d: "M18.5 3 7 18h8l-2 11L25 13.5h-8z", fill: "cyan" }],
    details: [shine("M16.6 6.5 11 14")],
  },
  // Nivel difícil: calavera.
  skull: {
    parts: [
      { d: "M16 3.6c6.6 0 11 4.4 11 10.2 0 3.6-1.6 6-4 7.4v4.2a1.8 1.8 0 0 1-1.8 1.8H10.8A1.8 1.8 0 0 1 9 25.4v-4.2c-2.4-1.4-4-3.8-4-7.4C5 8 9.4 3.6 16 3.6z", fill: "white" },
    ],
    details: [
      { d: "M11.4 12.4a2.8 2.8 0 1 1 0 5.6a2.8 2.8 0 1 1 0-5.6zM20.6 12.4a2.8 2.8 0 1 1 0 5.6a2.8 2.8 0 1 1 0-5.6z", fill: "deep" },
      { d: "M16 18.6l1.4 2.4h-2.8z", fill: "deep" },
      { d: "M13.4 23.6v3.4M16 23.6v3.4M18.6 23.6v3.4", stroke: "deep", width: 1.4 },
    ],
  },
  // Esperando: reloj de arena.
  hourglass: {
    parts: [
      { d: "M9.4 6.6h13.2c0 4.6-3.4 7-5.2 9.4 1.8 2.4 5.2 4.8 5.2 9.4H9.4c0-4.6 3.4-7 5.2-9.4-1.8-2.4-5.2-4.8-5.2-9.4z", fill: "lav" },
      { d: "M7 3.8h18v3H7zM7 25.2h18v3H7z", fill: "violet" },
    ],
    details: [
      { d: "M12.2 9.8h7.6c-.8 2-2.6 3.4-3.8 4.6-1.2-1.2-3-2.6-3.8-4.6zM11.8 24.2c.6-2.4 2.6-3.8 4.2-5 1.6 1.2 3.6 2.6 4.2 5z", fill: "gold" },
    ],
  },
  // Reto del día: calendario.
  calendar: {
    parts: [
      { d: "M5.5 9h21v18h-21z", fill: "white" },
      { d: "M5.5 6.6h21V12h-21z", fill: "red" },
    ],
    details: [
      { d: "M11 4v5M21 4v5", stroke: "deep", width: 2.4 },
      { d: "M10 16.4h3M14.5 16.4h3M19 16.4h3M10 21.4h3M14.5 21.4h3", stroke: "deep", width: 2 },
      { d: "M19 21.4h3", stroke: "violet", width: 2.6 },
    ],
  },
  // Tutorial completo: destellos.
  sparkles: {
    parts: [
      { d: "M13 4c.9 5.4 3.2 7.8 8.6 8.6-5.4.9-7.7 3.3-8.6 8.6-.9-5.3-3.2-7.7-8.6-8.6C9.8 11.8 12.1 9.4 13 4z", fill: "gold" },
      { d: "M23.6 17.4c.5 3 1.8 4.4 4.8 4.8-3 .5-4.3 1.9-4.8 4.8-.5-2.9-1.8-4.3-4.8-4.8 3-.4 4.3-1.8 4.8-4.8z", fill: "pink" },
    ],
  },

  // --- Tanda de Modos (estética nueva, 21-nov) ---
  // Estrellas del resultado.
  star: {
    parts: [{ d: "M16.00 4.00 L19.29 12.27 L28.17 12.84 L21.33 18.53 L23.52 27.16 L16.00 22.40 L8.48 27.16 L10.67 18.53 L3.83 12.84 L12.71 12.27Z", fill: "gold" }],
    details: [shine("M12.6 11.6l1.6-3.4")],
  },
  // Pista: la inicial del país (ficha con una A).
  letters: {
    parts: [{ d: "M9 4.5h14a4.5 4.5 0 0 1 4.5 4.5v14a4.5 4.5 0 0 1-4.5 4.5H9A4.5 4.5 0 0 1 4.5 23V9A4.5 4.5 0 0 1 9 4.5z", fill: "cyan" }],
    details: [
      { d: "M10.6 22.6 16 9.4l5.4 13.2M12.6 18h6.8", stroke: "deep", width: 2.6 },
    ],
  },
  // Pista: la silueta del siguiente país.
  silhouette: {
    // Contorno anguloso de un país cualquiera (con una península abajo):
    // la versión redondeada se leía como una nube.
    parts: [{ d: "M6.5 9.5 11.5 6l4 2.2L21 5.4l2.6 4.2 4.2 1.2-1.4 5.2 2 3.8-4.2 2.6-.4 3.6-3.6-.4-1.6 4.2-2.4-3-1.4-4-4.4-1.2-3.2-3.2 1.6-3.4z", fill: "lav" }],
    details: [
      { d: "M12 12.4a2 2 0 1 1 0 4a2 2 0 1 1 0-4z", fill: "gold" },
      shine("M9.6 9c1-1 2.2-1.6 3.6-1.8"),
    ],
  },
} satisfies Record<string, Def>;

export type IconName = keyof typeof ICONS;
export type IconTone = Tone;
export type IconDef = Def;
/** Las siluetas y colores de cada icono (los usa el render 3D). */
export const ICON_DEFS: Record<IconName, Def> = ICONS;
export const ICON_TONES = TONE;
export const ICON_NAMES = Object.keys(ICONS) as IconName[];

export default function FrontleIcon({
  name, size = 24, mono = false, className = "", style, title,
}: {
  name: IconName;
  size?: number;
  /** Un solo color (currentColor) y sin sombra: para usar dentro de un texto. */
  mono?: boolean;
  className?: string;
  style?: CSSProperties;
  /** Si el icono dice algo por sí solo (sin texto al lado), su nombre. */
  title?: string;
}) {
  const def: Def = ICONS[name];
  // Borde y sombra más finos en tamaños chicos: a 16 px un borde de 2 tapa el dibujo.
  const stroke = size <= 18 ? 1.6 : 2;
  const off = size <= 18 ? 1.2 : 1.8;
  const col = (t: Tone) => (mono ? "currentColor" : TONE[t]);
  return (
    <svg
      width={size}
      height={size}
      viewBox="-1 -1 34 34"
      className={className}
      style={style}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {title && <title>{title}</title>}
      {!mono && (
        <g transform={`translate(${off} ${off})`} fill={TONE.deep} stroke={TONE.deep} strokeWidth={stroke}>
          {def.parts.map((p, i) => <path key={i} d={p.d} />)}
        </g>
      )}
      {def.parts.map((p, i) => (
        <path key={i} d={p.d} fill={mono ? "none" : TONE[p.fill]} stroke={mono ? "currentColor" : TONE.deep} strokeWidth={stroke} />
      ))}
      {(def.details ?? []).map((d, i) => {
        if (mono && d.stroke === "white") return null; // los brillos sobran en un solo color
        return (
          <path
            key={`d${i}`}
            d={d.d}
            fill={d.fill ? col(d.fill) : "none"}
            stroke={d.stroke ? col(d.stroke) : "none"}
            strokeWidth={d.width ?? stroke}
          />
        );
      })}
    </svg>
  );
}
