// Medidas del icono 3D con borde neobrutal, compartidas entre el render
// (icons3d.ts, que usa three.js) y la app (Icon3D.tsx, que solo pinta el
// WebP). Separadas para que la app no importe three.js.
export const NEO_PX = 192; // lado del icono al renderizar (3x de 64 px)
export const NEO_BORDER = 0.035; // grosor del contorno, fracción del icono
export const NEO_SHADOW = 0.04; // desplazamiento de la sombra dura

/** Cuánto sobresale el WebP de la caja del icono, en fracción del lado. */
export function neoBox() {
  const b = Math.round(NEO_PX * NEO_BORDER);
  const sh = Math.round(NEO_PX * NEO_SHADOW);
  return { offset: b / NEO_PX, scale: (NEO_PX + 2 * b + sh) / NEO_PX };
}
